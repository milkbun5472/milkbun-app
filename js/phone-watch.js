// ============================================================
// 看他玩 —— 手机那一屏的另一面（她 2026-09-09 提，2026-09-10 定案）
//
// 「查手机」原来只有一种玩法：他不在，我翻他的手机。
// 这里加的是反过来那一面：**他在，我旁观他自己玩手机**。
// 屏幕就是他的手机，只有一个触控圆点在动——点微信、翻朋友圈、打了几个字又删掉、
// 点开我的头像停一会儿、锁屏。没有旁白，show not tell 直接做成机制。
//
// 三条定下来的话（她拍的）：
//  ① 这不是旁路，**它本身就是一次刷新**：他真刷了外卖，外卖那一屏就该变成他刷完的样子。
//    ——所以落盘走【现成的】savePhoneApp，一个字都不另开路径：
//      ♻️ 那几栏本来就是整份换（＝她要的「顶掉旧的」），📚 那几栏本来就是累积
//      （＝他新发的消息接在后面，历史不会被一段两分钟的录像抹掉）。分层名单在 phone.js。
//  ② 动作分三类，代价差一个量级：
//      看（点开一张已有的照片）＝零写入零生成；改（备忘录划掉重写）＝改已有的；
//      加/搜（发消息、下单）＝新增。**大部分时候他只是在闲翻**，别每次都非得产出点什么。
//  ③ 「他的想法」浮在屏幕上是这个功能的命根子：第一人称一句、不是旁白、
//    **一整段最多 4 句**（代码兜死，不靠提示词——模型高兴起来能每个动作配一句）。
//
// ⚠️动作词表和落盘只此一份。二十一个 app 各写一套的话，改一处另外二十处必然落单
//   （施工规则/one-public-mechanism.md）。
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PhoneWatch = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // 一整段里几句心声。
  // ⚠️「三四句就够」是我自己编的，还写成了她的原话——她从没说过（她 2026-09-10 当场指出来）。
  //   她定的是这一条：**每点开一样东西，就想一句。**
  //   道理也在这儿：看的人只看得见他点了什么，看不见他为什么点它——
  //   那一下没有一句话，就是「他点进去了，然后呢？」
  //   所以配额跟着【他点开了几样东西】走，不是拍一个数字：点开的那几下各一句，另给两句自由的。
  const THOUGHT_FREE = 2;                       // 不挂在任何一次点开上的那几句（亮屏时、锁屏前）
  const THOUGHT_CAP = 4;                        // 一次都没点开时的底数，免得整段一句话都没有
  const OPENISH = ["openItem", "openPage", "look"];
  function thoughtCapFor(acts) {
    const list = Array.isArray(acts) ? acts : [];
    let opens = 0;
    list.forEach(a => { const k = a && (ACT_ALIAS[S(a.kind || a.action).trim()] || S(a.kind || a.action).trim()); if (OPENISH.indexOf(k) >= 0) opens++; });
    return Math.max(THOUGHT_CAP, opens + THOUGHT_FREE);
  }
  // 一次 session 最多接几下敲。再敲不调用了——省钱，真人也不会无限接招。
  const KNOCK_CAP = 5;
  // 敲的跨次记忆：三天半衰（跟心情那套用同一个词，她读起来是同一件事）
  const KNOCK_HALFLIFE_MS = 3 * 86400000;
  // 同一个角色两次「看他玩」之间的冷却。手机状态没那么快变，而且这是一枪真钱。
  const WATCH_COOLDOWN_MS = 30 * 60000;
  // ⚠️她 2026-09-10：「测试这段时间先把 30 分钟限制 disable 一下吧」。
  //   关的是【闸】不是【数】——数留在上面，要开回来把这一行改成 false 就行。
  //   记在 屎山台账-2026-09-06.md 里，别忘了这道闸现在是关着的。
  const WATCH_COOLDOWN_OFF = true;
  // 一段录像最多几个动作。给宽一点（闲翻本来就零散），但不许没有上限。
  // ⚠️她 2026-09-10：「现在只有四十几还是包括了点进来和后退，真正能干的动作没几个」。
  //   一段里 open/back/home/pause/think 就吃掉一半，60 的上限等于只剩二三十下真事。
  const ACT_CAP = 120;
  // 提示词里报给模型的分量（代码那头的 ACT_CAP 是上限，不是目标）。
  // ⚠️留出余量：连着的心声、重复点开的那几下会在 normalizeActs 里被丢掉。
  const ACT_TARGET_LO = 70, ACT_TARGET_HI = 110;

  // ── 动作词表（只此一份）────────────────────────────────────────
  // 第一批只驱动【桌面 + 微信】。往外扩是加 kind，不是另开一套词表。
  // write: true = 这个动作会改手机里的数据，落盘那一头认这个字段。
  const WATCH_ACTS = {
    wake:     { args: [], zh: "亮屏" },
    lock:     { args: [], zh: "锁屏" },
    home:     { args: [], zh: "回桌面" },
    open:     { args: ["app"], zh: "点开一个 app" },
    back:     { args: [], zh: "退回上一层" },
    tab:      { args: ["name"], zh: "切到某一栏" },
    // ⚠️一个动词管所有 app 里「点开一样东西」：会话、照片、便签都走它。
    //   各写一个 openChat/openPhoto/openNote 的话，第三批加浏览器就是第四个，
    //   而播放器那头要 if 四次（一层写在四处）。openChat 留作同义词——
    //   它当了一天的正式词，模型学到的可能还是它。
    openItem: { args: ["name"], zh: "点开里面的一样东西（对话／照片／便签／歌／标签页）" },
    // ⚠️跟 openItem 分得开：openItem 打开【已经有的】，openPage 是【刚出现的那一页】
    //   （他搜完点进去的那条）。揉成一个词，模型分不清「点开旧的」和「搜出新的」。
    openPage: { args: ["name", "site", "gist", "priv"], zh: "打开刚搜出来的那一页（priv:true = 用无痕开）", write: true },
    scroll:   { args: ["amount"], zh: "滑动" },
    look:     { args: ["at"], zh: "只是看着某样东西，什么也没做" },
    type:     { args: ["text"], zh: "一个字一个字打" },
    erase:    { args: ["n"], zh: "删字（不给 n 就全删光）" },
    send:     { args: [], zh: "落下这一笔：微信里是发出去，便签里是存下", write: true },
    // 他发完，对面隔一会儿回一句——不然那一屏就永远停在他自己那条上，像对面死了。
    // ⚠️这是【对面说的话】，不是他说的：from 是对面那个人。
    reply:    { args: ["name", "text"], zh: "对面回了一句（发完之后隔一会儿）", write: true },
    // ⚠️她 2026-09-10 点的两样「他从来没干过的事」：
    //   剪贴板一次都没被打开过（真人复制粘贴是随时随地发生的，不是一个 app 里的事），
    //   小红书写了一半没发（草稿箱那一格空着）。
    copy:     { args: ["text"], zh: "复制一段字（落进剪贴板，随时随地都能干）", write: true },
    draft:    { args: ["text", "name"], zh: "写了一半没发出去（小红书草稿箱／邮件草稿）", write: true },
    // ⚠️她 2026-09-10：「照片换相册我是说【看他玩让他弄】，而不是给我加一个键」。
    //   回收站进出本来就是他自己在手机上会干的事（顺手把一张扔进「删了又没真删的」、
    //   翻回收站时又把一张捞回来），所以它是一个【动作】，不是给她的一颗按钮。
    move:     { args: ["to", "name"], zh: "把正看着的这张照片挪到另一摞（deleted＝扔进「删了又没真删的」／memory＝捞回来／gone＝真的删掉）", write: true },
    pause:    { args: ["ms"], zh: "停住" },
    think:    { args: ["text"], zh: "心里那一句（浮在屏幕上）" }
  };
  const ACT_KEYS = Object.keys(WATCH_ACTS);
  // openChat 是 openItem 的旧名字（v66.17 那一天用的），照收不误
  const ACT_ALIAS = { openChat: "openItem", openPhoto: "openItem", openNote: "openItem", save: "send" };

  const S = v => String(v == null ? "" : v);
  // ── 认名字只此一份 ────────────────────────────────────────────
  // ⚠️模型回写名字时标点、书名号、空格全会飘（「《长夜》」→「长夜」、「海边那天」→「海边 那天」）。
  //   严格等号的后果是【一声不响地什么也没发生】：屏幕上那一下没打开，圆点也落不下去
  //   （她 2026-09-10：「他打开相册图片点不开」）。
  //   所以对外只有这一条规矩，圆点找挂点和各屏找那一行都用它——两处各写一套就会一处开一处不开。
  const nameNorm = v => S(v).replace(/[\s《》「」『』“”"'`·・,，.。!！?？:：;；()（）\[\]【】\-—_~～]/g, "").toLowerCase();
  // ⚠️「像不像」是个是非题，可屏幕上要的是【挑哪一个】。两处各自 find 一遍的话，
  //   一处按 DOM 顺序、一处按数据顺序，撞上两条都像的就会各挑各的——
  //   于是圆点点在这一条上、点进去却是另一条（她 2026-09-10 在视频里看见的正是这个）。
  //   所以挑人只此一份：**先要完全一样的，没有才退而求其次挑最接近的那一条**。
  function pickName(list, name, get) {
    const want = nameNorm(name);
    if (!want) return null;
    let exact = null, near = null, gap = 1e9;
    (Array.isArray(list) ? list : []).forEach(it => {
      const v = nameNorm(get ? get(it) : it);
      if (!v) return;
      if (v === want) { if (exact == null) exact = it; return; }
      if ((v.length >= 3 || want.length >= 3) && (v.indexOf(want) >= 0 || want.indexOf(v) >= 0)) {
        const g = Math.abs(v.length - want.length);
        if (g < gap) { gap = g; near = it; }
      }
    });
    return exact != null ? exact : near;
  }
  function sameName(a, b) {
    const x = nameNorm(a), y = nameNorm(b);
    if (!x || !y) return false;
    if (x === y) return true;
    // 一方包含另一方也算：模型爱把标题写长一截或者只写前半句
    return (x.length >= 3 || y.length >= 3) && (x.indexOf(y) >= 0 || y.indexOf(x) >= 0);
  }
  const N = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

  // ── 规整模型给的那一串 ──────────────────────────────────────────
  // ⚠️认不出来的动作【丢掉，不猜】：猜错了就是屏幕上演出一件他没做的事。
  //   丢掉的记在 dropped 里，报错那头要看得见（施工规则/prompt-send-shape.md 第二条）。
  // apps = [{key,zh}]，可给可不给。给了就顺手把 app 名归一到 key——
  // ⚠️模型多半写「微信」而不是 "wechat"（她 2026-09-10 真跑时撞上的：
  //   open 那一下认不出来，于是整段只剩两句心声飘过去，微信压根没打开，
  //   而且【一声不响】）。提示词里挑明是降概率，这儿归一才是保证。
  function normalizeActs(raw, apps) {
    const byName = {};
    (Array.isArray(apps) ? apps : []).forEach(a => {
      if (!a) return;
      if (a.key) byName[S(a.key).toLowerCase()] = a.key;
      if (a.zh) byName[S(a.zh)] = a.key;
    });
    const knowApps = Object.keys(byName).length > 0;
    const list = Array.isArray(raw) ? raw : [];
    const out = [], dropped = [];
    const cap = thoughtCapFor(list);
    let thoughts = 0;
    for (const x of list) {
      if (out.length >= ACT_CAP) { dropped.push("超出 " + ACT_CAP + " 条的部分"); break; }
      if (!x || typeof x !== "object") { dropped.push(JSON.stringify(x)); continue; }
      const raw0 = S(x.kind || x.action).trim();
      const kind = ACT_ALIAS[raw0] || raw0;
      if (ACT_KEYS.indexOf(kind) < 0) { dropped.push(raw0 || JSON.stringify(x)); continue; }
      if (kind === "think") {
        // 心声超额的直接扔掉，不是往后挪——往后挪等于还是发了 8 句，只是晚一点
        if (thoughts >= cap) { dropped.push("第 " + (thoughts + 1) + " 句心声（超过 " + cap + " 句）"); continue; }
        const text = S(x.text).trim();
        if (!text) { dropped.push("空的心声"); continue; }
        // ⚠️两句连在一起就不是「想法」了，是旁白：中间总得有他做的一下
        const prev = out[out.length - 1];
        if (prev && prev.kind === "think") { dropped.push("连着的第二句心声：" + text.slice(0, 12)); continue; }
        thoughts++;
        out.push({ kind: "think", text: text.slice(0, 60) });
        continue;
      }
      // ⚠️同一样东西在一段里点开两次，就是「来来回回那两张」（她 2026-09-10 第二次报）。
      //   提示词说「别老翻同几张」只是降概率；这儿丢掉才是保证。
      if (kind === "openItem") {
        const nm = S(x.name).trim();
        if (nm && out.some(o2 => o2.kind === "openItem" && sameName(o2.name, nm))) {
          dropped.push("又点了一次：" + nm); continue;
        }
      }
      const a = { kind: kind };
      if (x.app != null) {
        const want = S(x.app).trim();
        const hit = byName[want.toLowerCase()] || byName[want];
        if (knowApps && !hit) { dropped.push("打不开的 app：" + want); continue; }
        a.app = hit || want;
      }
      if (x.name != null) a.name = S(x.name).trim().slice(0, 40);
      if (x.at != null) a.at = S(x.at).trim().slice(0, 40);
      if (x.site != null) a.site = S(x.site).trim().slice(0, 40);
      if (x.priv != null) a.priv = !!x.priv && S(x.priv) !== "false";
      if (x.gist != null) a.gist = S(x.gist).trim().slice(0, 160);
      // ⚠️字数上限【取消了】（她 2026-09-11：「不要 cap 了，模型知道微信一般发多长」）。
      //   这条路上的 200 → 800 → 没有：每次收窄都只是把截断挪得更靠后一点，
      //   而「一条微信该多长」本来就不是代码该替他定的事（施工规则/bans-make-it-dumber.md）。
      //   心声另有 60 字的闸（在上面 think 那一支），那一条是给屏幕留的，不是给他的。
      if (x.text != null) a.text = S(x.text);
      if (x.amount != null) a.amount = Math.max(-2000, Math.min(2000, N(x.amount, 0)));
      if (x.n != null) a.n = Math.max(1, Math.min(200, N(x.n, 1)));
      // 买东西那几个 app 才用得上的一栏：他看的那样东西多少钱。
      // ⚠️不拿 amount 顶替——那一栏是滑动距离，混用就成了「滑了 68 像素买了一杯」。
      if (x.price != null) { const pv = N(x.price, null); if (pv != null && pv >= 0 && pv <= 999999) a.price = Math.round(pv * 100) / 100; }
      // 挪照片挪到哪一摞（deleted/memory/favorite/saved/private/gone，中文也认）
      if (x.to != null) a.to = S(x.to).trim().slice(0, 20);
      if (x.ms != null) a.ms = Math.max(120, Math.min(6000, N(x.ms, 800)));
      out.push(a);
    }
    return { acts: out, dropped: dropped };
  }

  // 每个字隔多久蹦出来：正常 90 毫秒一个字，长到一定程度就往快里压，最快 16。
  // ⚠️actDuration 的 type 那一支拿它算总长——只此一份，别在播放器那头另定一个数。
  function typeTick(text) {
    const n = Math.max(1, S(text).length);
    return Math.max(16, Math.min(90, Math.round(5000 / n)));
  }
  // 演一个动作要多久（毫秒）。打字按字数走，别的按手感给。
  function actDuration(a) {
    if (!a) return 0;
    if (a.kind === "pause") return N(a.ms, 800);
    // 打字按字数走，但**长了要打得快些**：一条三百字的便签按每字 90 毫秒是二十七秒，
    // 那一屏就卡在那儿不动了。
    // ⚠️这一下演多久 = 字数 × 每字的节拍，**同一条算法算出来**——两处各定一个数的话，
    //   短的等半天、长的没打完就被推到下一步。
    if (a.kind === "type") { const n = S(a.text).length; return Math.max(300, n * typeTick(a.text)); }
    if (a.kind === "erase") return Math.max(260, N(a.n, 8) * 55);
    if (a.kind === "reply") return Math.max(900, S(a.text).length * 55);
    if (a.kind === "think") return 1600;
    if (a.kind === "look") return 1400;
    if (a.kind === "scroll") return 700;
    if (a.kind === "move") return 900;
    return 620;
  }
  function sessionDuration(acts) { return (acts || []).reduce((n, a) => n + actDuration(a), 0); }

  // ── 落盘：他落下的那一笔，接进这个 app 的 d ────────────────────
  // ⚠️这儿【只算出新的 d】，真正写盘走 app.js 那个 savePhoneApp——
  //   分层合并（🔒/🌱/📚）、去重、归档、核账全在它里面。另开一条写入路径就是又一处要同步的地方。
  //   她要的「刷了外卖就把旧的顶掉」，正是那条路上 ♻️ 字段本来的行为，不用另写。
  //
  // ⚠️「打了又删」的那半不在这儿：草稿是播放器手里的东西（type/erase 边演边攒），
  //   到这儿的只有【真按下那一下】的最终结果。各记一份草稿就会有两个真相。
  //
  // ⚠️一个入口按 appKey 分流，不是每个 app 一个函数：第三批加浏览器只多一个分支，
  //   app.js 那头一个字都不用改（施工规则/one-public-mechanism.md）。
  // 对面回的那一条。跟 applyWrite 分开：那个函数写的是【他自己】发出去的话，
  // 这个写的是【别人】说的话——from 不一样，混在一个函数里迟早把 from 写错人。
  // 他自己刷出来的那一行盖一枚戳。♻️ 那几栏（开着的标签页、购物车、在送的那一单）
  // 周刷会整份重编，这枚戳是「走乙」认人的凭据——留住的只有他真做过的那几行。
  const wkRow = (o, ts) => Object.assign({}, o, { _wk: 1, _wkAt: ts, _ts: ts });
  function applyReply(d, name, text, now, appKey) {
    const ts = N(now, Date.now());
    const who = S(name).trim(), body = S(text).trim();
    if (!who || !body) return { d: d, wrote: false };
    const base = d && typeof d === "object" ? d : {};
    // 短信也有对面（她 9-10 要的那一条对微信立的规矩，这儿是同一件事）：
    // ⚠️短信那一屏认的是 from === "me"，别的一律画成对面（照那一屏自己的写法来）。
    if (appKey === "calls") {
      const sms = Array.isArray(base.sms) ? base.sms.map(x => Object.assign({}, x)) : [];
      const row = sms.find(x => x && (sameName(x.name, who) || S(x.number) === who));
      if (!row) return { d: d, wrote: false };
      row.msgs = (Array.isArray(row.msgs) ? row.msgs.slice() : []).concat([{ from: "they", text: body, time: "刚刚" }]);
      row.time = "刚刚"; row.unread = true; row._ts = ts;
      return { d: Object.assign({}, base, { sms: sms }), wrote: true };
    }
    const chats = Array.isArray(base.chats) ? base.chats.map(c => Object.assign({}, c)) : [];
    let row = chats.find(c => c && sameName(c.name, who));
    if (!row) return { d: d, wrote: false };   // 对面得是已经存在的那个人，不许凭空多一个
    // 群里回话的可能是群里某个人；私聊就是对方本人。名字模型给的那个为准。
    // ⚠️群里回话的是【群里某个人】，但绝不能是他自己。
    //   原来拿的是这个群第一条消息的发言人——那第一条完全可能就是他发的，
    //   于是「对面的回复」落成他自己的话，界面上还画成右边那颗绿气泡。
    const meName = S(base.me && base.me.wechatName);
    const others = (Array.isArray(row.messages) ? row.messages : [])
      .map(m => S(m && m.from)).filter(n => n && n !== "me" && n !== "__me__" && !(meName && sameName(n, meName)));
    const from = row.type === "group" ? (others[0] || who) : who;
    row.messages = (Array.isArray(row.messages) ? row.messages.slice() : []).concat([{ from: from, text: body }]);
    row.last = body;
    row._ts = ts;
    row.time = "刚刚";
    return { d: Object.assign({}, base, { chats: chats }), wrote: true };
  }
  // 他能把照片挪到哪儿：照相册那一屏自己的五摞来，中英文都认（模型两种都会写）。
  // gone 不是一摞，是「真的删掉」。
  const ALBUM_MOVE = {
    deleted: "deleted", "删了又没真删的": "deleted", "最近删除": "deleted", "回收站": "deleted",
    memory: "memory", "总翻出来看的": "memory", "回忆": "memory", "捞回来": "memory",
    favorite: "favorite", "舍不得删的": "favorite", "个人收藏": "favorite",
    saved: "saved", "从别处存下来的": "saved", "最近保存": "saved",
    private: "private", "锁起来的": "private", "私密": "private",
    gone: "gone", "真的删掉": "gone", "彻底删掉": "gone", "删掉": "gone"
  };

  function applyWrite(appKey, d, target, text, now, o0) {
    const ts = N(now, Date.now());
    const who = S(target).trim(), body = S(text).trim();
    // ⚠️「什么都没写就不算数」这道闸不能放在这儿：浏览器里【搜了但没点开任何一条】
    //   是真会发生的一下（而且挺像他），text 空着照样要记一条 searches。
    //   所以各 app 自己判空。
    const base = d && typeof d === "object" ? d : {};

    if (appKey === "wechat") {
      if (!who || !body) return { d: d, wrote: false };
      const chats = Array.isArray(base.chats) ? base.chats.map(c => Object.assign({}, c)) : [];
      const meName = S(base.me && base.me.wechatName) || "我";
      let row = chats.find(c => c && sameName(c.name, who));
      if (!row) { row = { name: who, type: "chat", messages: [] }; chats.push(row); }
      row.messages = (Array.isArray(row.messages) ? row.messages.slice() : []).concat([{ from: meName, text: body }]);
      row.last = body;
      // ⚠️_ts 必须跟着重算：刚说完话的会话还挂着上一轮的时刻，会被排到列表最底下
      //   （v59.41 修过一次的那个病，从这儿能漏回来）。
      row._ts = ts;
      row.time = "刚刚";
      return { d: Object.assign({}, base, { chats: chats }), wrote: true };
    }

    if (appKey === "notes") {
      if (!body) return { d: d, wrote: false };
      // 她 2026-09-10 举的例子：「要删的备忘录他划掉重新写」。
      // 便签是【名册】（PHONE_RETIRE 里登记着），身份是标题——改正文不该变成第二条。
      const items = Array.isArray(base.items) ? base.items.map(x => Object.assign({}, x)) : [];
      const hit = who ? items.find(x => x && sameName(x.title, who)) : null;
      if (hit) { hit.body = body; hit.time = "刚刚"; hit._ts = ts; }
      else {
        // 新写一条：抬头取第一行（或者前十四个字），**正文是他打的那一整段**。
        // ⚠️原来这儿写的是 body: who ? body : ""——他没点开任何一条就直接写的时候
        //   who 是空的，于是抬头有了、正文是空的（她 2026-09-10：「便签不能新写」）。
        // 抬头断在【一句话结束的地方】，不是硬砍十四个字：
        // 「先去取快递，然后把稿子的开头」——那不是抬头，那是半句话。
        const first = body.split("\n")[0].trim();
        const stop = first.split(/[。！？!?，,、；;]/)[0].trim();
        const head = (stop && stop.length <= 16) ? stop : first.slice(0, 14);
        const title = who || head;
        items.unshift({ title: title, body: body, time: "刚刚", _ts: ts });
      }
      return { d: Object.assign({}, base, { items: items }), wrote: true };
    }

    if (appKey === "browser") {
      // 搜一次＝两层各动各的，这正是她要的那条分层规矩（施工规则/phone-data-layers.md）：
      //   searches 是【发生过什么】→ 📚 累积，接在前面；
      //   tabs 是【现在开着哪几个】→ ♻️ 快照，他刚打开的那一页顶到最前面。
      // target 是他敲进搜索框的原话，text 是他点开那一页；只搜没点开就只记 searches。
      const searches = Array.isArray(base.searches) ? base.searches.slice() : [];
      const tabs = Array.isArray(base.tabs) ? base.tabs.slice() : [];
      const page = S(text).trim();
      // 一次搜索会来两下：先 send（敲完回车），再 openPage（点开其中一条）。
      // ⚠️两下各记一条的话，同一句搜索词会在记录里出现两遍（真机上一眼看见的）。
      //   第二下认出「就是刚才那一句」就【就地补上结果】，不新开一条。
      const head = searches[0];
      const sameQ = who && head && S(head.q) === who && (ts - N(head._ts, 0)) < 180000;
      if (sameQ) {
        searches[0] = Object.assign({}, head, { opened: page || head.opened || "", _ts: ts,
          results: page ? [{ source: S((o0 && o0.site) || ""), title: page, excerpt: S((o0 && o0.gist) || "") }] : (head.results || []) });
      }
      else if (who) searches.unshift({ q: who, time: "刚刚", opened: page || "", _ts: ts,
        results: page ? [{ source: S((o0 && o0.site) || ""), title: page, excerpt: S((o0 && o0.gist) || "") }] : [] });
      // ⚠️tabs 是 ♻️ 快照，周刷会整份重编——他刚开的这一页会被凭空洗掉。
      //   盖上 _wk 这枚戳，phone.js 那头的「走乙」认它，周刷时把它留住（她 2026-09-10 选的乙）。
      // ⚠️无痕那一路【什么都不留】：不进搜索记录、不进标签页，只进 private 那一格
      //   （她 2026-09-10：「也不会搞无痕网页」）。这个 app 里最像人的恰恰是这一格。
      if (o0 && o0.priv && page) {
        const priv = Array.isArray(base.private) ? base.private.slice() : [];
        if (priv.some(x => x && sameName(x.title, page))) return { d: d, wrote: false };
        priv.unshift({ title: page, site: S((o0 && o0.site) || ""), age: "刚开的", cover: priv.length % 6, gist: S((o0 && o0.gist) || ""), _ts: ts });
        // ⚠️无痕不是「另存一格」，是【不留痕迹】：刚才那句搜索也要从记录里抹掉，
        //   否则搜的那句还在历史里挂着，等于没无痕。
        const keep = who ? searches.filter(x => !(x && sameName(x.q, who) && (ts - N(x._ts, 0)) < 180000)) : searches;
        return { d: Object.assign({}, base, { private: priv.slice(0, 10), searches: keep }), wrote: true };
      }
      // 收藏这一页：书签是【名册】（PHONE_RETIRE 里登记着），按文件夹分组
      if (S(o0 && o0.act) === "mark" && page) {
        const marks = Array.isArray(base.marks) ? base.marks.map(f => Object.assign({}, f)) : [];
        let folder = marks[0];
        if (!folder) { folder = { name: "随手存的", items: [] }; marks.unshift(folder); }
        const its = Array.isArray(folder.items) ? folder.items.slice() : [];
        if (its.some(x => x && sameName(x.title, page))) return { d: d, wrote: false };
        its.unshift({ title: page, site: S((o0 && o0.site) || ""), why: S((o0 && o0.gist) || ""), _ts: ts });
        folder.items = its;
        return { d: Object.assign({}, base, { marks: marks }), wrote: true };
      }
      if (page) tabs.unshift(wkRow({ title: page, site: S((o0 && o0.site) || ""), age: "刚开的", pinned: false, cover: tabs.length % 6, gist: S((o0 && o0.gist) || "") }, ts));
      if (!who && !page) return { d: d, wrote: false };
      return { d: Object.assign({}, base, { searches: searches, tabs: tabs.slice(0, 12) }), wrote: true };
    }

    // ── 购物（她 2026-09-10「第四批」）────────────────────────────
    // 两下分得开：openPage＝点进一件商品页（**看过就是发生过** → 📚 viewed）；
    // send＝放进购物车（**现在车里有什么** → ♻️ cart，他刚放的顶在最前面，
    // 正是她要的「刷了就把旧的顶掉」）。看了没买是这个 app 最常见的一下。
    if (appKey === "shopping") {
      const title = who || body;
      if (!title) return { d: d, wrote: false };
      const shop = S(o0 && o0.site), why = S(o0 && o0.gist);
      const price = (o0 && o0.price != null) ? N(o0.price, null) : null;
      if (S(o0 && o0.act) === "send") {
        const cart = Array.isArray(base.cart) ? base.cart.slice() : [];
        if (cart.some(x => x && sameName(x.title, title))) return { d: d, wrote: false };  // 已经在车里了，别放第二遍
        cart.unshift(wkRow({ title: title, shop: shop, price: price, why: why, qty: 1 }, ts));
        return { d: Object.assign({}, base, { cart: cart.slice(0, 12) }), wrote: true };
      }
      const viewed = Array.isArray(base.viewed) ? base.viewed.slice() : [];
      if (viewed.some(x => x && sameName(x.title, title))) return { d: d, wrote: false };
      viewed.unshift({ title: title, shop: shop, price: price, time: "刚刚", _ts: ts });
      return { d: Object.assign({}, base, { viewed: viewed }), wrote: true };
    }

    // ── 外卖 ───────────────────────────────────────────────────
    // 翻店不写（他多半就是看看今天吃什么）；真下单才落，而且一下落两层：
    //   orders 📚 —— 这一顿是发生过的事；
    //   live   ♻️ —— 「他这会儿等着的」是当前状态，新的一单顶掉旧的。
    if (appKey === "takeout") {
      const title = who || body;
      if (!title || S(o0 && o0.act) !== "send") return { d: d, wrote: false };
      const shop = S(o0 && o0.site) || title, note = S(o0 && o0.gist);
      const price = (o0 && o0.price != null) ? N(o0.price, null) : null;
      const live = Array.isArray(base.live) ? base.live.slice() : [];
      const orders = Array.isArray(base.orders) ? base.orders.slice() : [];
      live.unshift(wkRow({ shop: shop, items: title, status: "配送中", eta: "", amount: price, note: note, step: 1 }, ts));
      orders.unshift({ shop: shop, main: title, amount: price, time: "刚刚", status: "刚下单",
        items: [{ name: title, qty: 1, price: price }], note: note, _ts: ts });
      return { d: Object.assign({}, base, { live: live.slice(0, 6), orders: orders }), wrote: true };
    }

    // ── 账本：在当前翻开的那一栏记一笔（她 2026-09-10：「开账本吧」）────
    // ⚠️五栏字段各不相同，所以【按他此刻在哪一栏】分流，各按各栏自己的写法来
    //   （施工规则/stub-from-the-writer.md）。条款和自问自答不接：那两栏是成段的问答，
    //   不是手机上随手记的一笔。
    if (appKey === "tally") {
      if (!body) return { d: d, wrote: false };
      const bucket = S(o0 && o0.tab) || "debts";
      if (["debts", "statements", "treasures"].indexOf(bucket) < 0) return { d: d, wrote: false };
      const rows = Array.isArray(base[bucket]) ? base[bucket].slice() : [];
      const first = body.split("\n")[0].trim();
      const stop = first.split(/[。！？!?，,、；;]/)[0].trim();
      const head = (stop && stop.length <= 16) ? stop : first.slice(0, 14);
      const dupKey = bucket === "statements" ? body : head;
      if (rows.some(x => x && sameName(x.title || x.text, dupKey))) return { d: d, wrote: false };
      rows.unshift(bucket === "debts" ? { who: who || "", title: head, dir: "欠着", note: body, _ts: ts }
        : bucket === "statements" ? { text: body, heat: "", truth: "", _ts: ts }
        : { title: head, kind: "", worth: body, _ts: ts });
      const out2 = Object.assign({}, base); out2[bucket] = rows;
      return { d: out2, wrote: true };
    }

    // ── 相册：把一张照片挪进另一摞（她 2026-09-10 要的是他自己动手）──
    // ⚠️走的是这个 app 现成的那套分类字段（category），不另造数据；
    //   gone＝真的从这份 items 里拿掉（回收站里那一下「真的删掉」）。
    if (appKey === "album") {
      const items0 = Array.isArray(base.items) ? base.items : [];
      const hit = pickName(items0, who, x => x && (x.caption || x.desc));
      if (!hit) return { d: d, wrote: false };
      const to = ALBUM_MOVE[body] || "";
      if (!to) return { d: d, wrote: false };
      const items = to === "gone"
        ? items0.filter(x => x !== hit)
        : items0.map(x => x === hit ? Object.assign({}, x, { category: to }) : x);
      return { d: Object.assign({}, base, { items: items }), wrote: true };
    }

    // ── 剪贴板：他复制的那一段字 ────────────────────────────────
    // ⚠️这一下【不属于任何一个 app】：他在浏览器里复制一句、在微信里复制一个地址，
    //   落的都是剪贴板。所以 copy 那一支不看他此刻开着哪个 app（appKey 传 "clipboard"）。
    if (appKey === "clipboard") {
      if (!body) return { d: d, wrote: false };
      const items = Array.isArray(base.items) ? base.items.slice() : [];
      if (items.some(x => x && S(x.text).trim() === body)) return { d: d, wrote: false };
      // ⚠️照这一屏自己的写法来：sent === false 的那几张是【还捏在手里没发出去的】
      items.unshift({ text: body, from: who || "", time: "刚刚", sent: false, _ts: ts });
      return { d: Object.assign({}, base, { items: items }), wrote: true };
    }

    // ── 写了一半没发：小红书草稿箱 / 邮件草稿 ────────────────────
    if (appKey === "_draft_liked" || appKey === "_draft_mail") {
      if (!body) return { d: d, wrote: false };
      const drafts = Array.isArray(base.drafts) ? base.drafts.slice() : [];
      const first = body.split("\n")[0].trim();
      const title = who || (first.length <= 16 ? first : first.slice(0, 16));
      if (drafts.some(x => x && sameName(x.title || x.subject, title))) return { d: d, wrote: false };
      // 两个草稿箱的字段不一样，各按各屏自己的写法来（施工规则/stub-from-the-writer.md）
      drafts.unshift(appKey === "_draft_mail"
        ? { to: who || "", subject: title, body: body, savedAt: "刚刚", _ts: ts }
        : { title: title, excerpt: body, savedAt: "刚刚", cover: drafts.length % 6, _ts: ts });
      return { d: Object.assign({}, base, { drafts: drafts }), wrote: true };
    }

    // ── 深夜台：跟视频一样，刷出一条新的点进去就是看过了 ────────
    if (appKey === "latenight") {
      const title0 = who || body;
      if (!title0 || S(o0 && o0.act) !== "openPage") return { d: d, wrote: false };
      const items = Array.isArray(base.items) ? base.items.slice() : [];
      if (items.some(x => x && sameName(x.title, title0))) return { d: d, wrote: false };
      items.unshift({ title: title0, up: S(o0 && o0.site), gist: S(o0 && o0.gist), time: "刚刚", _ts: ts });
      return { d: Object.assign({}, base, { items: items }), wrote: true };
    }

    // ── 视频 ───────────────────────────────────────────────────
    // 他刷出一条新的点进去看了——「看过的视频」是 📚（发生过什么），所以这一下就该留痕。
    // ⚠️跟小红书不一样：那边点进去只是看、按了收藏才留；视频是**看了就是看过了**。
    if (appKey === "bili") {
      const title = who || body;
      if (!title || S(o0 && o0.act) !== "openPage") return { d: d, wrote: false };
      const items = Array.isArray(base.items) ? base.items.slice() : [];
      if (items.some(x => x && sameName(x.title, title))) return { d: d, wrote: false };
      items.unshift({ title: title, up: S(o0 && o0.site), gist: S(o0 && o0.gist),
        time: "刚刚", cover: items.length % 6, _ts: ts });
      return { d: Object.assign({}, base, { items: items }), wrote: true };
    }

    // ── 小红书 ─────────────────────────────────────────────────
    // 点进一条笔记只是【看】（那一页浮在屏幕上，什么也不写）；
    // 他真按了收藏才落一条——items 是 📚，收藏过的就该一直在。
    if (appKey === "liked") {
      const title = who || body;
      if (!title || S(o0 && o0.act) !== "send") return { d: d, wrote: false };
      const items = Array.isArray(base.items) ? base.items.slice() : [];
      if (items.some(x => x && sameName(x.title, title))) return { d: d, wrote: false };
      items.unshift({ title: title, author: S(o0 && o0.site), excerpt: S(o0 && o0.gist),
        act: "收藏", time: "刚刚", cover: items.length % 6, _ts: ts });
      return { d: Object.assign({}, base, { items: items }), wrote: true };
    }

    // ── 电话·短信 ──────────────────────────────────────────────
    // 只接短信这一路：它跟微信是同一个形状（点开一串 → 打字 → 发出去 → 对面回）。
    // 通话记录只看不写——「拨一通电话」不是手机上打几个字的事，那是另一件事。
    if (appKey === "calls") {
      if (!who || !body) return { d: d, wrote: false };
      const sms = Array.isArray(base.sms) ? base.sms.map(x => Object.assign({}, x)) : [];
      const row = sms.find(x => x && (sameName(x.name, who) || S(x.number) === who));
      if (!row) return { d: d, wrote: false };   // 得是已经在的那一串，不许凭空多出个号码
      row.msgs = (Array.isArray(row.msgs) ? row.msgs.slice() : []).concat([{ from: "me", text: body, time: "刚刚" }]);
      row.time = "刚刚"; row.unread = false; row._ts = ts;
      return { d: Object.assign({}, base, { sms: sms }), wrote: true };
    }

    // ── 邮件 ───────────────────────────────────────────────────
    // 他回的那一封落进【发件箱】。收件人从他正回的那封里取——
    // 一封回信的收件人是原来那封的发件人，不是标题。
    if (appKey === "mail") {
      if (!body) return { d: d, wrote: false };
      const inbox = Array.isArray(base.inbox) ? base.inbox : [];
      const src = who ? inbox.find(x => x && (sameName(x.subject, who) || sameName(x.from, who))) : null;
      const sent = Array.isArray(base.sent) ? base.sent.slice() : [];
      sent.unshift({ to: (src && S(src.from)) || who, subject: src ? "回复：" + S(src.subject) : (who || body.slice(0, 16)),
        body: body, time: "刚刚", _ts: ts });
      return { d: Object.assign({}, base, { sent: sent }), wrote: true };
    }

    // ── 阅读 ───────────────────────────────────────────────────
    // 他这一下动的只有【读到哪儿】和【那一条批注】，书目一本不增不减——
    // 跟周刷「只问 updates」那一路是同一个写法（照 phoneApplyBookUpdates 那段来：
    // 改过的书盖 _upd，整份盖 _lastUpd，同一个时间戳才亮红点）。
    if (appKey === "reading") {
      if (!who || !body) return { d: d, wrote: false };
      let hit = 0;
      const shelves = (Array.isArray(base.shelves) ? base.shelves : []).map(sh => Object.assign({}, sh, {
        books: (Array.isArray(sh && sh.books) ? sh.books : []).map(b => {
          if (!b || !sameName(b.title, who)) return b;
          hit++;
          return Object.assign({}, b, { note: body, _upd: ts });
        })
      }));
      if (!hit) return { d: d, wrote: false };   // 架上没有这本，不许凭空添一本
      return { d: Object.assign({}, base, { shelves: shelves, _lastUpd: ts }), wrote: true };
    }

    return { d: d, wrote: false };   // 还没接的 app：只演不落，绝不乱写
  }

  // ── 敲一下：本次递进 + 跨次三天半衰 ─────────────────────────────
  // 她 2026-09-10：「本次要，跨session也要但要衰减」。
  function knockDecayed(list, now) {
    const ts = N(now, Date.now());
    return (Array.isArray(list) ? list : []).reduce((sum, t) => {
      const age = ts - N(t, 0);
      if (age < 0 || age > KNOCK_HALFLIFE_MS * 8) return sum;   // 太久远的当没发生过
      return sum + Math.pow(0.5, age / KNOCK_HALFLIFE_MS);
    }, 0);
  }
  function knockPush(list, now) {
    const ts = N(now, Date.now());
    const keep = (Array.isArray(list) ? list : []).filter(t => ts - N(t, 0) <= KNOCK_HALFLIFE_MS * 8);
    return keep.concat([ts]).slice(-40);
  }
  // 敲第几下 → 他大概是什么反应档位。真正说什么由模型定，这儿只给它一个梯度。
  function knockStep(inSession, recent) {
    const n = Math.max(1, N(inSession, 1));
    const old = Math.round(N(recent, 0));
    if (n >= 4) return { n: n, old: old, hint: "你已经敲第 " + n + " 下了——他不可能再当没看见。" };
    if (n === 3) return { n: n, old: old, hint: "第三下。他明确知道你一直在看，而且你不打算停。" };
    if (n === 2) return { n: n, old: old, hint: "第二下。上一下他还能装作没听见，这一下装不了了。" };
    return { n: n, old: old, hint: "第一下。他可以停一秒、也可以装作什么都没发生。" };
  }
  function knockOver(inSession) { return N(inSession, 0) >= KNOCK_CAP; }

  // ── 敲完他真的会变一下（她 2026-09-10 那批里的第 ⑥ 条）────────────
  // 病根：上面那个梯度（knockStep）写得很好，可它只管【那一句话】——
  //   她敲了三下，他心里说「知道你在看」，然后继续若无其事地刷。
  //   按下去的那一下没有分量，正是这个功能最可惜的地方。
  //
  // ⚠️只【插】不【删】：边演边落是她定的（看到一半退出去，他做过的就是做过了），
  //   截掉剩下的动作会把本该落盘的那几下整段演漏。
  // ⚠️也不插 lock / home：后面那串动作全是按「他还在这个 app 里」写的，
  //   把他弹回桌面，接下来的 type / send 全落在空处——拧巴比没反应更糟。
  // 所以这一段只做三件事：停住、（被看得）打不下去、把心里那句说出来。
  function knockBeat(n, say, typing) {
    const k = Math.max(1, N(n, 1));
    // 停多久＝他有多装不下去。跟 knockStep 那四档一一对上，别另立一套梯度。
    const out = [{ kind: "pause", ms: k >= 4 ? 2600 : k === 3 ? 2200 : k === 2 ? 1500 : 900 }];
    // 第三下起：他被看得打不下去了，手上打了一半那句删光。
    // ⚠️这一笔【不用另外截断后面】：接下来那一下 send 遇到空草稿本来就什么都不做
    //   （各屏都有 if (text) 那道闸），效果正好就是「他没发出去」。
    if (k >= 3 && S(typing).trim()) out.push({ kind: "erase" });
    const line = S(say).trim();
    if (line) out.push({ kind: "think", text: line.slice(0, 60) });
    return out;
  }
  // 把这一段插在【当前这一下的后面】：当前那一下已经在演了，插它前面会把它顶掉。
  function spliceBeat(acts, i, beat) {
    const list = Array.isArray(acts) ? acts : [];
    if (!Array.isArray(beat) || !beat.length) return list;
    const at = Math.min(list.length, Math.max(0, N(i, 0)) + 1);
    return list.slice(0, at).concat(beat, list.slice(at));
  }

  // 好感：一次 session 累计封顶 ±1（现在的量表是 -5~5、日常聊天一律 0，
  // 所以 ±1 已经是「这事留了点痕迹」的分量）。
  // ⚠️方向不写死成负的：他被你撞见在翻你的照片，完全可以是加分的。
  //   是嫌你烦还是心里一动，让人设自己决定；这儿只兜幅度。
  function clampWatchAff(v) {
    const n = N(v, 0);
    if (!n) return 0;
    return n > 0 ? 1 : -1;
  }

  // ── 看完之后留下什么（她 2026-09-10 拍的：「只敲过才写」）─────────
  // ⚠️她安安静静看完＝【他真的不知道】，上下文里一个字不留，也一分钱不花。
  //   这个玩法成立的地方就是「他以为没人在看」，看一次就往他脑子里塞一句，
  //   等于把它拆了。只有她伸手敲了屏幕，他才真的抬过头——那才是发生过的事。
  // ⚠️当天为界：昨天被敲过今天还挂着，就成了常驻层（十轮里九轮用不上的不该常驻）。
  //   算「同一天」按本机日期，跟别处的 dayKey 一个意思。
  function knockedToday(list, now) {
    const ts = N(now, Date.now());
    const day = new Date(ts).toDateString();
    return (Array.isArray(list) ? list : []).filter(t => {
      const v = N(t, 0);
      return v > 0 && v <= ts && new Date(v).toDateString() === day;
    }).length;
  }
  // 喂给模型的那一句。只此一份：单聊线上线下都走 buildBundle 这一个口子。
  function watchedNote(n, uName) {
    const k = Math.max(0, N(n, 0));
    if (!k) return "";
    return "【今天她看过你玩手机】你一个人刷手机的时候，" + (uName || "对方")
      + "就在旁边看着，还敲了你 " + k + " 下屏幕——你抬头看见她了，这件事你心里有数。"
      + "要不要提、怎么提，按你的性子来：装没事、别扭、调侃、追问她看了多久都行。"
      + "**别复述你在手机上做过什么**（那是你自己的事，她看见多少是她的事），也别每句都念叨。";
  }

  // ── 「他这会儿在玩手机」的提示（她 2026-09-10：冷却关着，提示照做）────
  // ⚠️冷却是关着的（WATCH_COOLDOWN_OFF），所以【节奏得由提示自己兜】：
  //   不兜的话这颗点会一直亮着，亮着就不叫提示了，等于一个常驻装饰。
  // 三道闸，全是零调用的本地判断：
  //   ① 他得醒着（照他自己的时区算；睡着的人不玩手机）；
  //   ② 一天最多提 HINT_PER_DAY 次；
  //   ③ 同一个小时里稳定地开或不开——用「角色 + 那一天 + 第几小时」当种子，
  //      不用 Math.random：随机会让这颗点在同一小时里闪来闪去（重渲染一次换一次）。
  const HINT_PER_DAY = 2;
  const HINT_ODDS = 0.34;         // 醒着的每一小时里，大约三分之一会亮
  function hintSeed(charId, dayKey, hour) {
    const str = S(charId) + "|" + S(dayKey) + "|" + hour;
    let h0 = 2166136261;
    for (let i = 0; i < str.length; i++) { h0 ^= str.charCodeAt(i); h0 = Math.imul(h0, 16777619); }
    return ((h0 >>> 0) % 1000) / 1000;
  }
  // localMin = 他那边此刻是几点几分（分钟数，调用方按角色时区算好递进来）
  // seen = { day: "那一天", n: 今天已经提过几次, hour: 上一次提的是哪个小时 }
  function watchHintOn(charId, localMin, seen, now) {
    const mins = N(localMin, -1);
    if (mins < 0) return false;
    const hour = Math.floor(mins / 60);
    // 醒着的时段：9:00 到次日 0:59。⚠️深夜那一小时【要留着】——深夜台本来就是那会儿刷的。
    if (hour < 9 && hour >= 1) return false;
    const day = new Date(N(now, Date.now())).toDateString();
    const st = seen && typeof seen === "object" ? seen : {};
    const used = S(st.day) === day ? N(st.n, 0) : 0;
    if (used >= HINT_PER_DAY) return false;
    // 这一小时已经提过就不再重复（她看见了没点进来，不必一小时里催两遍）
    if (S(st.day) === day && N(st.hour, -1) === hour) return false;
    return hintSeed(charId, day, hour) < HINT_ODDS;
  }
  // 她真点进去看了才记一次——只是路过看见那颗点不算用掉今天的额度
  function watchHintUsed(seen, localMin, now) {
    const day = new Date(N(now, Date.now())).toDateString();
    const st = seen && typeof seen === "object" ? seen : {};
    const same = S(st.day) === day;
    return { day: day, n: (same ? N(st.n, 0) : 0) + 1, hour: Math.floor(N(localMin, 0) / 60) };
  }

  function cooldownLeft(lastAt, now) {
    if (WATCH_COOLDOWN_OFF) return 0;
    const left = WATCH_COOLDOWN_MS - (N(now, Date.now()) - N(lastAt, 0));
    return left > 0 ? left : 0;
  }

  // ── 问模型要那一串动作 ──────────────────────────────────────────
  // ⚠️只给【词表】和【判据】，一个内容示范都不给（施工规则/prompt-no-content-samples.md）：
  //   写一段「他给老张发『晚点说』」当例子，出来的就是每个角色都在给老张发晚点说。
  //   那一栏要多有脾气，靠判据说清楚，不靠抄一句好句子。
  // 上次他翻过的那几样排到队尾：名单顺序每次一样，模型就总挑排在前面那几个
  // （跟 app 名单那次是同一个病，位置偏好不是他的性格）。
  // 一行东西在名单上叫什么（照各屏自己认人的那几个字段来）
  const rowName = x => {
    if (x == null) return "";
    if (typeof x !== "object") return S(x);
    return ["caption", "title", "name", "q", "shop", "author", "text"]
      .map(k => (typeof x[k] === "string" ? x[k].trim() : "")).filter(Boolean)[0] || "";
  };
  // 今天这一段先开哪几个：最近刷过的沉底，**但最多沉一半**。
  // ⚠️她 2026-09-10 连报三次「来回翻同几个 app」。第三次的病根是记性只记上一段：
  //   那等于【严格轮流】——这一段开甲乙丙、下一段甲乙丙沉底于是开丁戊己、
  //   再下一段甲乙丙又回到队首。看上去就是在两拨之间来回倒。
  // ⚠️能沉的都沉，但**永远给他留两个**：一个都不留＝谁也没沉底，
  //   「这一次换几个别的开」也就成了一句办不到的话。
  //   留的是【最久没碰过的那两个】——recentApps 新的在前，所以从尾巴上留。
  function appQueue(has, recentApps) {
    const list = Array.isArray(has) ? has.slice() : [];
    const rec = Array.isArray(recentApps) ? recentApps : [];
    if (list.length <= 2 || !rec.length) return list;
    const sink = rec.slice(0, Math.max(1, list.length - 2));
    return list.filter(k => sink.indexOf(k) < 0).concat(list.filter(k => sink.indexOf(k) >= 0));
  }
  function freshFirst(list, seen, get) {
    const arr0 = Array.isArray(list) ? list : [];
    if (!Array.isArray(seen) || !seen.length) return arr0;
    const old0 = [], neu = [];
    arr0.forEach(x => (seen.some(n => sameName(n, get ? get(x) : rowName(x))) ? old0 : neu).push(x));
    return neu.concat(old0);
  }
  function watchInstruction(o) {
    const c = (o && o.char) || {};
    const uName = (o && o.uName) || "对方";
    const ph = (o && o.phone) || {};
    const can = Array.isArray(o && o.apps) ? o.apps : ["wechat"];
    const seenIt = Array.isArray(o && o.recentItems) ? o.recentItems : [];
    // ⚠️所有名单都从这儿过一道：上次翻过的排到最后（不是删掉——他当然可以再翻，
    //   只是别每次都从同一张开始）。
    const arr = a => freshFirst(Array.isArray(a) ? a : [], seenIt);
    const words = Object.keys(WATCH_ACTS).map(k => {
      const a = WATCH_ACTS[k];
      return "· " + k + (a.args.length ? "（" + a.args.join("、") + "）" : "") + " —— " + a.zh;
    }).join("\n");

    // 手机现在的样子：只发【他打得开的那几个 app】，一个字都不多发。
    // ⚠️名字要原样发回去（openItem 得从这些里照抄），不然他会点开一样不存在的东西。
    const now = [];
    if (can.indexOf("wechat") >= 0) {
      const wx = ph.wechat || {};
      const chats = arr(wx.chats).slice(0, 14).map(x => "· " + (x.name || "?") + (x.type === "group" ? "（群）" : "") + "：" + String(x.last || "").slice(0, 40)).join("\n");
      const contacts = arr(wx.contacts).slice(0, 16).map(x => (x.remark || x.name || "")).filter(Boolean).join("、");
      const moments = arr(wx.moments).slice(0, 6).map(x => "· " + (x.author || "?") + "：" + String(x.content || "").slice(0, 40)).join("\n");
      // ⚠️她也在他微信里，而且那一条是【真的】：发给她就是真发到她手机上。
      //   不点出来的话他永远想不到可以给她发消息——那本来是这个玩法最戳人的一下。
      // ⚠️她 2026-09-10：「现在微信变成只会在我的聊天框动手，不看朋友圈也不和别人发消息」。
      //   病根是我上一版把这一行写得太响（全段最响的一句），于是他每次一开微信就直奔她。
      //   她那条要留着（那是最戳人的一下），但得压回【偶尔】：先说别人，再提她。
      const meLine = "\n· " + uName + (o && o.uRemark ? "（你给她的备注：" + o.uRemark + "）" : "")
        + " —— 她也在你微信里。给她发消息是**真的发到她手机上**，所以**不是每次都发**："
        + "这一段你多半只是刷别人，只有真有话说的那一次才点开她。";
      now.push("〔微信 wechat〕会话（openItem 的 name 从这里照抄）：\n" + (chats || "（还没有会话）") + meLine
        + (contacts ? "\n通讯录里有：" + contacts : "")
        + (moments ? "\n朋友圈最近几条：\n" + moments : ""));
    }
    if (can.indexOf("album") >= 0) {
      const ps = arr((ph.album || {}).items).slice(0, 18)
        .map(x => "· " + (x.caption || "?") + (x.date || x.time ? "（" + (x.date || x.time) + "）" : "") + (x.desc ? "：" + String(x.desc).slice(0, 30) : "")).join("\n");
      now.push("〔相册 album〕已有的照片（openItem 的 name 就是照片那个标题）：\n" + (ps || "（相册还是空的，那就别点进去）"));
    }
    if (can.indexOf("browser") >= 0) {
      const br = ph.browser || {};
      const tabs = arr(br.tabs).slice(0, 8).map(x => "· " + (x.title || "?") + (x.site ? "（" + x.site + "）" : "")).join("\n");
      const qs = arr(br.searches).slice(0, 8).map(x => "· " + (x.q || "")).filter(x => x.length > 2).join("\n");
      now.push("〔浏览器 browser〕现在开着的标签页（openItem 的 name 就是标题）：\n" + (tabs || "（一个都没开）")
        + (qs ? "\n他最近搜过（别原样再搜一遍）：\n" + qs : ""));
    }
    if (can.indexOf("music") >= 0) {
      const sg = arr(((o && o.playlist) || {}).songs).slice(0, 16)
        .map(x => "· " + (x.title || "?") + (x.artist ? " / " + x.artist : "")).join("\n");
      now.push("〔音乐 music〕他歌单里的歌（openItem 的 name 就是歌名）：\n" + (sg || "（歌单还是空的，那就别点进去）"));
    }
    if (can.indexOf("shopping") >= 0) {
      const sp = ph.shopping || {};
      const cart = arr(sp.cart).slice(0, 8).map(x => "· " + (x.title || "?") + (x.shop ? "（" + x.shop + "）" : "")).join("\n");
      const wish = arr(sp.wish).slice(0, 10).map(x => (x.title || "")).filter(Boolean).join("、");
      now.push("〔购物 shopping〕购物车里停着（openItem 的 name 就是这些标题）：\n" + (cart || "（车是空的）")
        + (wish ? "\n一直没下手的：" + wish : ""));
    }
    if (can.indexOf("takeout") >= 0) {
      const tk = ph.takeout || {};
      const shops = arr(tk.shops).slice(0, 10).map(x => (x.name || "") + (x.usual ? "（常点 " + x.usual + "）" : "")).filter(Boolean).join("、");
      const live = arr(tk.live).slice(0, 4).map(x => "· " + (x.shop || "") + "：" + (x.items || "")).join("\n");
      now.push("〔外卖 takeout〕他常点的店：" + (shops || "（还没有常点的店）")
        + (live ? "\n这会儿还在路上的：\n" + live : ""));
    }
    if (can.indexOf("liked") >= 0) {
      const lk = ph.liked || {};
      const its = arr(lk.items).slice(0, 10).map(x => "· " + (x.title || "?") + (x.author ? " / " + x.author : "")).join("\n");
      now.push("〔小红书 liked〕他赞过收藏过的（openItem 的 name 就是标题）：\n" + (its || "（还什么都没存过）"));
    }
    if (can.indexOf("calls") >= 0) {
      const cl = ph.calls || {};
      const ss = arr(cl.sms).slice(0, 10).map(x => "· " + (x.name || x.number || "?") + (x.kind === "人" ? "" : "（通知）")).join("\n");
      const cs = arr(cl.calls).slice(0, 8).map(x => "· " + (x.name || x.number || "陌生号码") + (x.answered === false ? "（没接通）" : "")).join("\n");
      now.push("〔电话 calls〕短信里这几串（openItem 的 name 从这里照抄）：\n" + (ss || "（没有短信）")
        + (cs ? "\n通话记录：\n" + cs : ""));
    }
    if (can.indexOf("mail") >= 0) {
      const ml = ph.mail || {};
      const ib = arr(ml.inbox).slice(0, 10).map(x => "· " + (x.subject || "?") + (x.from ? " / " + x.from : "")).join("\n");
      now.push("〔邮件 mail〕收件箱（openItem 的 name 就是那封的标题）：\n" + (ib || "（邮箱是空的，那就别点进去）"));
    }
    if (can.indexOf("reading") >= 0) {
      const bs = [];
      arr((ph.reading || {}).shelves).forEach(sh => arr(sh && sh.books).slice(0, 6).forEach(b => {
        if (b && b.title) bs.push("· " + b.title + (b.readAt ? "（" + b.readAt + "）" : ""));
      }));
      now.push("〔阅读 reading〕他架上的书（openItem 的 name 就是书名）：\n" + (bs.slice(0, 16).join("\n") || "（架上还没有书）"));
    }
    if (can.indexOf("tally") >= 0) {
      const ty = ph.tally || {};
      const one = (k, zh) => arr(ty[k]).slice(0, 5).map(x => (x.title || x.name || x.text || x.q || "")).filter(Boolean).map(v => "· " + v + "（" + zh + "）");
      const rs = [].concat(one("debts", "欠着的"), one("statements", "放过的话"), one("treasures", "舍不得的"), one("policies", "他的规矩"));
      now.push("〔账本 tally〕他记着的这些（openItem 的 name 从这里照抄）：\n" + (rs.join("\n") || "（这本账还是空的，那就别点进去）"));
    }
    if (can.indexOf("bili") >= 0) {
      const vs = arr((ph.bili || {}).items).slice(0, 12).map(x => "· " + (x.title || "?")).join("\n");
      now.push("〔视频 bili〕他看过的（openItem 的 name 就是标题）：\n" + (vs || "（还没看过什么）"));
    }
    if (can.indexOf("latenight") >= 0) {
      const vs = arr((ph.latenight || {}).items).slice(0, 10).map(x => "· " + (x.title || "?")).join("\n");
      now.push("〔深夜台 latenight〕这几条（openItem 的 name 就是标题）：\n" + (vs || "（深夜台还是空的）"));
    }
    if (can.indexOf("health") >= 0) {
      const cs = arr((ph.health || {}).cards).slice(0, 12).map(x => (x.name || "")).filter(Boolean).join("、");
      now.push("〔健康 health〕今天这几张读数（openItem 的 name 就是那一项的名字）：" + (cs || "（今天还没有读数）"));
    }
    if (can.indexOf("calendar") >= 0) {
      const cs = arr(((o && o.calendar) || {}).items).slice(0, 12).map(x => "· " + (x.title || "?") + (x.date ? "（" + x.date + "）" : "")).join("\n");
      now.push("〔日历 calendar〕他记下的事（openItem 的 name 就是那件事）：\n" + (cs || "（日历上什么也没有）"));
    }
    if (can.indexOf("clipboard") >= 0) {
      const cs = arr((ph.clipboard || {}).items).slice(0, 10).map(x => "· " + String(x.text || "").slice(0, 24)).join("\n");
      now.push("〔剪贴板 clipboard〕他复制过的（openItem 的 name 就是那一条的原文）：\n" + (cs || "（剪贴板是空的）"));
    }
    if (can.indexOf("anon") >= 0) {
      const qs = arr((o && o.anon) || []).slice(0, 8).map(x => "· " + String((x && x.q) || "").slice(0, 30)).filter(x => x.length > 2).join("\n");
      now.push("〔匿名信箱 anon〕有人匿名问他的（openItem 的 name 就是那一问的头几个字）：\n" + (qs || "（还没人问过他什么）"));
    }
    if (can.indexOf("forum") >= 0) {
      const fs = arr((o && o.forum) || []).slice(0, 8).map(x => "· " + (x.title || "?")).join("\n");
      now.push("〔论坛 forum〕板上这几帖（openItem 的 name 就是帖子标题）：\n" + (fs || "（论坛上还没有他看的帖子）"));
    }
    if (can.indexOf("notes") >= 0) {
      const ns = arr((ph.notes || {}).items).slice(0, 14)
        .map(x => "· " + (x.title || "?") + (x.body ? "：" + String(x.body).slice(0, 34) : "")).join("\n");
      now.push("〔便签 notes〕已有的便签（openItem 的 name 就是便签的标题）：\n" + (ns || "（一条便签都没有，那就别点进去）"));
    }

    // ── 他这会儿为什么拿起手机 ──────────────────────────────────
    // ⚠️她 2026-09-10：他每次都像从零开始刷，于是永远是那几个 app、那两张照片。
    //   病根在这儿：这一段【没有由头】。他此刻在做什么本来就在上下文里（日程那一层），
    //   可从没有人让他把两件事接上。
    const hourWord = { 深夜: "这是深夜——你本该睡了", 睡前: "这是睡前躺下的那一会儿",
      饭点: "这是饭点，你一个人吃着", 刚醒: "你刚醒，人还没清醒" }[S(o && o.whyNow)] || "";
    const why = ["【你这会儿为什么拿起手机】",
      (o && o.charHour != null ? "你那边现在大约 " + o.charHour + " 点。" : "") + hourWord + (hourWord ? "。" : ""),
      (o && o.sinceLast != null) ? "离你上次放下手机过了 " + (o.sinceLast >= 60 ? Math.round(o.sinceLast / 60) + " 个多小时" : o.sinceLast + " 分钟") + "——**别把上次做过的事再做一遍**。" : "",
      // ⚠️真人刷手机最常见的理由就是这个，而他一直不知道（看他玩-想做的 排第一那条）：
      //   点开那条对话看一眼、退出来、又点开、打了半句删掉——这一幕不用教，
      //   他知道「隔了多久、谁欠谁一条」自己就会长出来。
      // ⚠️只给状态，不给动作：要不要去点她，由他自己定（施工规则/bans-make-it-dumber.md）。
      (o && o.wxWait) ? "⚠️" + o.wxWait + "**你是知道这件事的**——这一段里你会不会因此点开那条对话、点开了又退出来、还是压根不去碰它，看你此刻的人和心情。" : "",
      "先想清楚这一次是为什么拿起来的：等谁回消息、刚忙完想放空、睡不着、有件事非查不可、或者纯粹手贱。",
      "**这一段里做的每一下都要跟这个由头对得上**：等消息的人会一直回微信、放空的人不会去下单、有事要查的人先开浏览器。",
      "你此刻正在做的事也算数——在开会就只会飞快扫两眼，躺着才会一个个翻。",
      // ⚠️她 2026-09-10：「他玩手机本身也还太依赖我们的聊天了，而不是根据日程
      //   有自己真的新鲜料想去搜的」。日程那一整段离得远、又长，读到的最响的东西
      //   还是「跟她的聊天」——所以把今天他自己身上那件事拎到跟前来，并且要求用它。
      (o && o.today) ? "\n【你今天自己这一摊】\n" + o.today : "",
      // ⚠️没日程的角色也得有这一条，只是不能去指一段不存在的话
      (o && o.today)
        ? "· **这一段里至少有一件事是从【你今天自己这一摊】里长出来的**：手头这件事要查的东西、"
          + "刚才那顿饭、待会儿要去的地方、身上不舒服的那一处、今天的天气——搜它、买它、记它、跟人说它。"
        : "· **这一段里至少有一件事是从你自己今天的一天里长出来的**：手头的活、刚才那顿饭、"
          + "待会儿要去的地方、身上不舒服的那一处——搜它、买它、记它、跟人说它。",
      "· **绝大多数事跟她无关。**你今天过的是你自己的一天：工作、麻烦、想吃的、睡不着。"
        + "跟她有关的那一两下才有分量，全都围着她转反而假。"].filter(Boolean).join("\n");

    return [
      "现在是你自己拿着手机在刷。没有人跟你说话，也没有人在听——**你以为**。",
      why,
      "把接下来这几分钟你在手机上真实做的事，一步一步写成一串动作。" + uName + " 会像看屏幕录像一样看着它被演出来。",
      // ⚠️她 2026-09-11：「看他玩现在还是只有 30 40 个动作」。查下来这一段【从来没说过要写多少下】——
      //   ACT_CAP=120 只是代码那头的上限，模型这头没有任何数，于是它按「写完一个小场景」的
      //   分量收笔，三四十下就停。这一条是给分量的，不是给答案的：写多少下说了，
      //   每一下做什么仍然是它自己的（施工规则/bans-make-it-dumber.md）。
      "【这一段有多长】" + ACT_TARGET_LO + "～" + ACT_TARGET_HI + " 下，别只写三四十下就收。"
        + "真人拿起手机三五分钟，光是点进去、看两眼、滑一滑、退出来就几十下了——"
        + "**把中间那些琐碎的一下也写出来**：滑动、停顿、看一眼又退回去、点错了再退出来、翻到底又翻回去。"
        + "省掉它们就不是屏幕录像，是剧情提要。",
      "",
      "【你能做的动作】只许用下面这些词，别自己造：\n" + words,
      "",
      "【怎么才像真的在刷手机】",
      "· **大部分时候你什么也没干成**：点进去、看两眼、退出来。别每次都非得发生一件大事。",
      "· 三种动作的分量完全不同——**只是看**（点开一张旧照片、翻回很久以前的话、盯着某个人的头像）本来就是最常见的那种；",
      "  **改**（写了又删）次之；**真发出去**最少。一整段里真正送出去的东西，一两件顶天了。",
      "· 打字要带上你反悔的那一下：type 打完可以 erase 掉重打、改口、整句删掉重写。**改到一半的那句才是最像你的**——打完删光不发出去也算数，只要你是真的打了。",
      "· 停顿是有意义的：pause 放在你犹豫、走神、或者盯着某样东西挪不开眼的地方。",
      "· **动作是主角，心声是配角**：一整段里绝大多数还是动作（点、翻、打字、停）。写成一串心声就不是「看他玩手机」了，是配旁白。",
      "· think 是你心里那一句，第一人称。它不是旁白——不许写「他似乎在犹豫」这种从外面看的句子，只写你自己心里冒出来的那一句。",
      "· **每点开一样东西，就想一句**：点开一张照片、一个人的会话、一条旧笔记、一本书、一条笔记——**那一下就配一句**。看的人只看得见你点了什么，看不见你为什么点它；那一句就是这个功能全部的意思。",
      // ⚠️她 2026-09-10：「他翻开了没有心声就看他点进去有点莫名其妙」。
      //   病不在句数，在【落在哪一下】：配给亮屏、回桌面、滑动这种一看就懂的动作，
      //   真正需要一句话的那几下反而空着。
      "· 反过来，**亮屏、回桌面、滑动、退出去这种一看就懂的，一句都别配**——它们本来就不需要解释。两句心声也不许连在一起：中间总得有你做的一下。",
      "· 点开一样东西之后**至少 pause 一下**再做别的：进去两秒就退出来，看的人只会觉得莫名其妙。",
      "",
      "【每个 app 里你能干什么】",
      can.indexOf("wechat") >= 0 ? "· 微信：**这个 app 里绝大多数时候你刷的是别人**——翻朋友圈（tab 切 moments，openItem 写发这条的人）、点开某个人的会话说两句、看看联系人。**点开一个会话就是要跟这个人说话**——openItem 之后一定要 type，打点什么出来。发不发随你：可以 erase 掉重打、改口、打完了删光直接 back 走人（**那一下最像你**），也可以 send 发出去。唯独**不许点开看两秒就退出去**：只想看看的话，就停在会话列表上翻，别进去。tab 可以切 chats / contacts / moments / me；切到 moments 就是翻朋友圈，openItem 的 name 写发这条的人。" : "",
      can.indexOf("wechat") >= 0 ? "  发出去之后，对面**多半会回一句**：用 reply 写，name 是那个会话的名字、text 是对面说的话。别每条都秒回——先 pause 一会儿更像。对面也可以干脆不回（那也是一种回答）。" : "",
      can.indexOf("album") >= 0 ? "· 相册（挪照片）：点开一张之后，偶尔——**只是偶尔，不是每次进相册都干一次**——你会顺手把它挪个地方：move to:\"deleted\" 是扔进「删了又没真删的」；翻到那一摞里时 move to:\"memory\" 是把它捞回来，move to:\"gone\" 是真的删掉（删了就再也没有了，得是你真的不想留着的那种）。挪之前先 openItem 点开它。" : "",
      can.indexOf("album") >= 0 ? "· 相册：openItem 点开一张【已经有的】照片，look 着它、pause 一会儿。**多半只是翻旧照片，翻一两张就够了，翻完去别处**（相册最容易一待就是半程，可一个人不会盯着同两张照片来回看）。tab 可以切 library / collections / saved。" : "",
      can.indexOf("notes") >= 0 ? "· 便签：两种都行。**改**：openItem 点开一条已有的，手上就是它现在的正文，erase 划掉（不给 n 就整段划光）、type 重写、send 存下。**新写**：不点开任何一条，直接 type 打一段再 send——那就是新记一条。想起什么随手记一笔，本来就是便签最常发生的事。" : "",
      can.indexOf("browser") >= 0 ? "· 浏览器：type 往地址栏里敲你要搜的那句（可以敲了又 erase 掉重敲）→ send 回车搜出去 → **openPage 点开搜出来的其中一条**：name（那一页的标题）、site（哪个站）、gist（那一页上写着什么，两三句）。⚠️**搜了就要点开一条**——搜完什么都不点，屏幕上就是一片空白，那一下等于没发生。想留着以后看就在那一页上再 send 一下——**那是收藏进书签**（手上没在打字的时候按下去就是收藏，不是又搜一遍）。不想留痕迹的那一次，openPage 上加 priv:true——**无痕开的那一页不进搜索记录、不进标签页**，只进无痕那一格。也可以 openItem 点开一个已经开着的标签页或书签。tab 可以切 tabs / search / marks / priv。" : "",
      can.indexOf("shopping") >= 0 ? "· 购物：**想买新东西就先搜**：type 往搜索框里敲一句 → send 搜出去 → 再 openPage 点进一件商品页——name 是那样东西、site 是哪家店、gist 是这一页上写着什么、price 是标价。看完可以直接 back 走人（**看了没买才是常态**）；真动心了才 send，那就是把它放进购物车。openItem 点开购物车里已经有的那一件。tab 可以切 home / kept / choice。" : "",
      can.indexOf("takeout") >= 0 ? "· 外卖：**想吃点别的就先搜**：type 敲一句 → send 搜出去 → 再 openPage 点进一家店或一道菜——name 是那一顿、site 是店名、gist 是他为什么点它（或者备注那句话）、price 是多少钱。**翻半天最后没点也很像他**；真下单才 send，那一单立刻变成「还在路上」。tab 可以切 home / rhythm / people。" : "",
      can.indexOf("liked") >= 0 ? "· 小红书：scroll 往下刷，openItem 点开他以前存过的那几条。**想看新东西就先搜**：type 往搜索框里敲一句 → send 搜出去 → 再 openPage 点开搜出来的其中一条——name 是标题、site 是作者、gist 是这条笔记写了什么——name 是标题、site 是作者、gist 是这条写了什么。**多半只是划过去看看**；真戳中他了才 send，那就是收藏。**想发一条自己的**：用 draft 写——写了一半没发出去，它会躺在草稿箱里（那一格比发出去的更像你）。tab 可以切 feed / follow / mine。" : "",
      can.indexOf("calls") >= 0 ? "· 电话：openItem 点开一串**短信** → type / erase 打字改字 → send 发出去（或者打完不发，直接 back）。发完对面可以用 reply 回一句（name 就是那一串的名字）。通话记录只能 openItem 点开【看】——他这会儿不会真拨一通电话出去。tab 可以切 calls / sms / vm / people。" : "",
      can.indexOf("mail") >= 0 ? "· 邮件：openItem 点开收件箱里的一封 → type 写回信 → send 发出去。**写一半锁屏走人也很像他**——真要留着回头再写，就用 draft 存进草稿箱。tab 可以切 inbox / sent / drafts。" : "",
      can.indexOf("reading") >= 0 ? "· 阅读：openItem 点开一本【架上已有的】书 → type 写下这一次的批注 → send 记下。书目一本不增不减，你改的只有那一条批注。**架上那几本是真在读的**——睡前、通勤、等人的时候翻两页很自然，别一次都不进去。tab 可以切 shelf / archive。" : "",
      can.indexOf("tally") >= 0 ? "· 账本：openItem 翻开一张卡片，背面是他自己写的那句话。**也能记一笔新的**：先 tab 切到那一栏，再 type 打一段、send 记下——欠着的（debts，name 写欠谁的／谁欠他的）、放过的话（statements）、舍不得的（treasures）这三栏能记；条款和自问自答那两栏是成段的问答，不是手机上随手写的，别往那儿记。**这本账是他心里没结清的东西，不是待办清单**：记进去的得是真憋着的那种。" : "",
      can.indexOf("bili") >= 0 ? "· 视频：scroll 往下刷，openItem 点开一条已经在那儿的。**想看新东西就先搜**：type 敲一句 → send 搜出去 → 再 openPage 点开其中一条——name 是标题、site 是谁发的、gist 是这条讲了什么。看过就是看过了，它会留在「他看过的」里。" : "",
      can.indexOf("latenight") >= 0 ? "· 深夜台：scroll 往下划，openItem 点开一条已经在那儿的；也可以 openPage **刷出一条新的**点进去看——name 是标题、site 是谁发的、gist 是这条讲了什么。这个台子本来就是半夜一条接一条往下刷的地方。" : "",
      can.indexOf("forum") >= 0 || can.indexOf("anon") >= 0 ? "· 论坛 / 匿名信箱：openItem 点开一帖（点开能看见楼下那些回复）、scroll 往下翻。**这两处一个字都不许写**——在这儿发帖、回信是另一件事，不是刷手机。但**看完可以想一句**：别人在楼下说的话、有人匿名问他的那一句，最值得配一句心声。" : "",
      can.indexOf("health") >= 0 ? "· 健康：openItem 点开一项读数看着它。**只能看**。tab 可以切 body / mind / private / intake。" : "",
      can.indexOf("calendar") >= 0 || can.indexOf("clipboard") >= 0 || can.indexOf("timeline") >= 0 ? "· 日历 / 剪贴板 / 时间线：openItem 点开一条看着。这三处点开只能看。" : "",
      can.indexOf("clipboard") >= 0 ? "· **copy 随时随地都能用**（不用先打开剪贴板）：看见一串地址、一句话、一个单号、一段别人说的话，复制下来——它就落进剪贴板。真人一天要复制好几回，那一格能看出他在办什么事。" : "",
      can.indexOf("music") >= 0 ? "· 音乐：scroll 往下翻曲目单，openItem 点一首歌的名字——**它会真的开始放**。歌只能从下面那份歌单里挑，**别老点最上面那几首**：往下翻翻，挑一首跟你此刻对得上的。" : "",
      "",
      "【他这台手机现在的样子】\n"
        + "⚠️下面这些是**为了让你别写重复、别点开不存在的东西**——不是让你从里面挑事做。"
        + "一个人拿起手机，多半是去看**还没有的东西**：搜一句、刷出新的一条、写下刚想起来的事。\n"
        + now.join("\n\n"),
      "",
      "【硬规矩】",
      "· 只能碰上面真实存在的东西：会话、人、照片、便签，**名字一个字都不许改，也不许凭空多出一个**。",
      "· 第一个动作从 wake（亮屏）起，最后一个动作是 lock（锁屏）。中间要进 app 用 open。",
      "· **能打开的只有这几个**：" + can.join(" / ") + "。open 的 app 一律填这几个英文词，别写中文名、别写别的 app——写别的等于这一下什么也没发生。",
      "· 你今天的心情、你和 " + uName + " 现在处到哪一步、你的人设——这几样决定你会点开谁、会不会点开 " + uName + "、在哪儿停住。",
      // ⚠️她 2026-09-10：「为什么都在照片便签音乐来回看都不看别的」。
      //   一个人拿起手机不会只在两个 app 之间打转——那是名单顺序造成的位置偏好，不是他的性格。
      "· **这一段里至少进 3 个不一样的 app**，别在同两个之间来回。同一个 app 最多进两次。",
      (o && Array.isArray(o.recentItems) && o.recentItems.length)
        ? "· 这几样你最近几次已经翻过了：" + o.recentItems.slice(0, 10).join("、")
          + "。下面各份名单里，**没翻过的排在前面——先从前面那些里挑**；"
          + "真要再看一遍旧的，得是这一次有理由再看它。同一样东西一段里只点一次就够了。"
        : "",
      (o && Array.isArray(o.recent) && o.recent.length)
        ? "· 上一次你刷的是：" + o.recent.join("、")
          + "。**这一次换几个别的开**——那几个可以再点，但别又整段围着它们转。"
        : "",
      "· **这一段里至少要有一次真的去看新东西**（搜一句 → 点开搜出来的那一条；或者写下一条新的便签／新记一笔）。整段都在翻旧东西，那不是刷手机，那是在原地打转。",
      "· 别在动作里解释你为什么这么做。**做就是了**，看的人自己会明白。"
    ].filter(Boolean).join("\n");
  }
  // ⚠️占位值写成【说明】不是【样例内容】——写成样例，模型会照抄那句话
  function watchSchemaHint() {
    return '{"acts":[{"kind":"上面词表里的一个词","app":"要打开的 app（只有 open 用）","name":"要点开的会话或人的名字",'
      + '"at":"你在看的那样东西","text":"你打的字，或者 think 时你心里那一句","amount":"滑动的距离，正数往下","price":"这样东西多少钱（只有买东西那几个 app 用）","n":"要删掉几个字","ms":"停多久，毫秒"}]}';
  }

  // ── 光标落在哪儿：靠挂点，不靠猜坐标 ────────────────────────────
  // 被驱动的那几个元素身上挂 data-watch="chat:名字" / "tab:栏名"，
  // 播放器按这个选择器找到它、量出中心点，圆点就落在那儿。
  // ⚠️猜坐标是不行的：会话列表滚到哪儿、有几条，每台手机都不一样，
  //   猜出来的点会落在空处——那一眼就看得出是假的。
  function watchTargetSel(a) {
    if (!a) return "";
    if (a.kind === "openItem") return '[data-watch="item:' + S(a.name).replace(/"/g, "") + '"]';
    if (a.kind === "openPage") return '[data-watch="result"]';
    if (a.kind === "reply") return '[data-watch="thread"]';
    if (a.kind === "tab") return '[data-watch="tab:' + S(a.name).replace(/"/g, "") + '"]';
    if (a.kind === "open") return '[data-watch="app:' + S(a.app).replace(/"/g, "") + '"]';
    // 「只是看着某样东西」落在那样东西身上——它就是列表里那一行，不另挂一套 look: 的点
    if (a.kind === "look") return '[data-watch="item:' + S(a.at).replace(/"/g, "") + '"]';
    if (a.kind === "back") return '[data-watch="back"]';
    // 买东西那三个 app 没有「发送」钮，这一下按在现编的那一页上——退而求其次落在它上面，
    // 总比圆点僵在原地强（querySelector 认逗号，谁先在页面上就落谁）。
    if (a.kind === "send") return '[data-watch="send"],[data-watch="result"]';
    if (a.kind === "type" || a.kind === "erase") return '[data-watch="input"]';
    // 挪照片按的是详情页底下那几颗真键，圆点就落在那颗键上
    if (a.kind === "move") return '[data-watch="move:' + S(a.to).replace(/"/g, "") + '"]';
    return "";
  }

  // ── 演出用的气泡：数据已经追上了就别再挂一条 ────────────────────
  // ⚠️他发出去的那一条【落盘是同步的】：applyWrite 写进 x_phone，那一屏下一帧就看得见。
  //   播放器为了「当场看得见」另挂的那条演出气泡于是成了第二遍
  //   （她 2026-09-10：「微信给别人发还是有 duplicate」）。
  //   两条路都要留着（数据慢一拍的时候还得靠它），所以在【画的那一刻】去重：
  //   最后几条里已经有同一句了，演出那条就不画。
  function dropEchoBubbles(messages, sent) {
    const ms = Array.isArray(messages) ? messages : [], sd = Array.isArray(sent) ? sent : [];
    if (!sd.length) return sd;
    const tail = ms.slice(-6).map(m => S(m && m.text).trim()).filter(Boolean);
    return sd.filter(x => tail.indexOf(S(x && x.text).trim()) < 0);
  }

  // ── 现编的那一页：他刚搜出来／刚点进去的东西 ──────────────────────
  // 这一页在他手机里本来不存在，是这一段里现编的。四个 app 共用一份
  // （浏览器、购物、外卖、小红书）——各写一套的话，改一处必漏三处
  // （施工规则/one-public-mechanism.md）。长相靠 skin 传色，形状只此一种。
  // ⚠️挂点 data-watch="result" 长在它身上：圆点要落在这一页上，靠的就是它。
  function WatchPage(o) {
    const p = o || {}, pg = p.page;
    if (!pg) return null;
    const sk = p.skin || {};
    const bg = sk.bg || "#fff", ink = sk.ink || "#1c1a16", dim = sk.dim || "#9a9aa4";
    const line = sk.line || "#eeeef1", body = sk.body || "#3a3a42";
    const price = pg.price != null && pg.price !== "" ? pg.price : null;
    return h("div", { "data-watch": "result", className: "absolute inset-0 flex flex-col", style: { background: bg, zIndex: 20 } },
      // ⚠️padding 简写写在 paddingTop 后面会把它整个盖掉（刘海就白让了）——顺序不能反。
      h("div", { "data-wk": "head", className: "shrink-0", style: { padding: "12px 16px 10px", paddingTop: safeTop(12), borderBottom: "1px solid " + line } },
        h("div", { className: "flex items-baseline", style: { gap: 10 } },
          h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 10.5, color: dim } }, pg.site || p.fallbackSite || "网页"),
          price != null ? h("div", { style: { flexShrink: 0, fontFamily: F_DISPLAY, fontSize: 15, color: sk.mark || ink } }, "¥" + price) : null),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, lineHeight: 1.35, color: ink, marginTop: 5 } }, pg.title || "")),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "18px 16px 30px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.95, color: body, whiteSpace: "pre-wrap" } }, pg.gist || "")));
  }

  // ── 搜索条：他在这个 app 里搜新东西的那一下 ────────────────────
  // ⚠️「先搜再点进去」这条顺序是她定的（2026-09-10，浏览器那次）：
  //   凭空冒出一页，看的人不知道他为什么看见它。所以凡是能搜出新东西的 app，
  //   都先让那句搜索词出现在搜索框里，再由 openPage 盖上那一页。
  //   这一条只此一份：小红书、视频各画一套的话，改一处必漏一处。
  function WatchSearchPill(o) {
    const p = o || {}, sk = p.skin || {};
    const typing = p.typing, q = S(p.q);
    if (typing == null && !q) return null;
    const ink = sk.ink || "#1c1a16", dim = sk.dim || "#9a9aa4", soft = sk.soft || "#f1f2f3";
    // ⚠️形状归各屏自己：药丸是小红书／视频那一路的说法，册页上不摆药丸（购物那一屏
    //   走的是墨围：方角＋一道细线）。同一个零件，各穿各的衣服。
    const rad = sk.radius != null ? sk.radius : 99;
    const bd = sk.border || "none";
    // ⚠️回车之后草稿是空串（不是 null），照原样画就是【搜索框空着】——
    //   而那一刻正是她要看见「他搜了什么」的那一下。空草稿就把搜的那句留在框里。
    const draft = (typing != null && S(typing).length > 0) ? S(typing) : "";
    const shown = draft || q;
    const on = !!draft;
    return h("div", { className: "flex-1 min-w-0 flex items-center", "data-watch": "input",
      style: { height: 32, borderRadius: rad, border: bd, background: soft, padding: "0 6px 0 13px", gap: 8 } },
      h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: 12.5, color: ink, whiteSpace: "nowrap", overflow: "hidden" } },
        [shown || h("span", { key: "ph", style: { color: dim } }, "\u00a0"),
          typing != null ? h("span", { key: "c", style: { display: "inline-block", width: 1.5, height: 13, background: ink, marginLeft: 1, verticalAlign: "-2px", animation: "wkcaret 1s steps(1) infinite" } }) : null]),
      h("div", { "data-watch": "send", style: { flexShrink: 0, borderRadius: rad, padding: "4px 11px", fontFamily: F_BODY, fontSize: 11.5,
        color: on ? "#fff" : dim, background: on ? (sk.accent || ink) : "transparent" } }, "搜索"));
  }

  // 触控圆点：手机不该配一个电脑鼠标。一颗很淡的圆 + 按下时一圈涟漪。
  function WatchDot(o) {
    const p = o || {};
    if (p.x == null) return null;
    return h("div", {
      "aria-hidden": "true",
      style: {
        position: "absolute", left: p.x, top: p.y, width: 30, height: 30, marginLeft: -15, marginTop: -15,
        borderRadius: 999, pointerEvents: "none", zIndex: 60,
        background: "rgba(28,26,22,.20)", border: "1px solid rgba(255,255,255,.75)",
        boxShadow: "0 2px 10px rgba(20,18,15,.28)",
        transform: p.press ? "scale(.72)" : "scale(1)",
        transition: "left .34s cubic-bezier(.33,.9,.3,1), top .34s cubic-bezier(.33,.9,.3,1), transform .14s"
      }
    });
  }

  // 他心里那一句：不做成气泡框，一行很淡的字压在屏幕上
  function WatchThought(o) {
    const p = o || {};
    if (!p.text) return null;
    // ⚠️不能只靠一层白字加阴影：微信那几屏是浅灰底，白字压上去几乎看不见（真机上抓到的）。
    //   给它自己一块很淡的深色底，浅底深底都读得出来。
    return h("div", {
      style: {
        position: "absolute", left: 0, right: 0, bottom: 148, zIndex: 62, pointerEvents: "none",
        display: "flex", justifyContent: "center", padding: "0 20px"
      }
    }, h("span", {
      style: {
        maxWidth: "84%", borderRadius: 13, padding: "6px 12px",
        background: "rgba(24,21,18,.66)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: "rgba(255,252,246,.94)",
        boxShadow: "0 6px 20px rgba(20,17,13,.28)"
      }
    }, p.text));
  }

  // 底下那条：进度、倍速、跳过、敲一下。
  // ⚠️「敲一下」每按一次就是一次调用（她 2026-09-10 接受了）——所以按钮上要写着还能敲几下，
  //   不能让她按完才发现没反应了。
  function WatchBar(o) {
    const p = o || {}, t = p.t || {};
    const left = Math.max(0, KNOCK_CAP - (p.knocks || 0));
    // ⚠️这一条是【悬浮】的，不占正文一寸（她 2026-09-10：「按键是实的会把手机屏幕
    //   往上推一节」——让位等于他的手机凭空矮了一截，那才是真穿帮）。
    //   所以它收窄压扁；而且**演到他打字那几下自己让路**：压在输入框上就把最戳人的
    //   那一眼挡掉了，让它变淡、手指真按上去再亮回来。
    return h("div", {
      onPointerDown: p.onWake,
      style: {
        position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 64,
        padding: "7px 12px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 9px)",
        display: "flex", alignItems: "center", gap: 8,
        opacity: p.dim ? 0.34 : 1, transition: "opacity .25s",
        background: "linear-gradient(rgba(18,16,14,0), rgba(18,16,14,.62) 46%)"
      }
    },
      h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "rgba(255,255,255,.72)", minWidth: 44 } },
        p.done ? "看完了" : p.paused ? "停住了" : (p.i || 0) + " / " + (p.total || 0)),
      h("span", { style: { flex: 1 } }),
      // 暂停（她 2026-09-10 第 ⑦ 条）：他打了一句又删掉、心声一闪而过，
      // 原来想看清楚只能按 1× 或者干脆错过。四个键里最便宜的一个。
      // ⚠️暂停着的时候倍速那颗还留着能按：她多半是「停下来看完，再挑个速度继续」。
      p.done ? null : h("button", { onClick: p.onPause, className: "active:opacity-60",
        "aria-label": p.paused ? "继续" : "暂停",
        style: { fontFamily: F_BODY, fontSize: 11.5, color: p.paused ? "#1c1a16" : "#fff",
          border: "1px solid rgba(255,255,255," + (p.paused ? ".92" : ".4") + ")", borderRadius: 999,
          padding: "5px 11px", background: p.paused ? "rgba(255,255,255,.92)" : "transparent" } },
        p.paused ? "继续" : "暂停"),
      p.done ? null : h("button", { onClick: p.onSpeed, className: "active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: 11, color: "#fff", border: "1px solid rgba(255,255,255,.4)", borderRadius: 999, padding: "4px 10px", background: "transparent" } },
        (p.speed || 1) + "×"),
      p.done ? null : h("button", { onClick: p.onSkip, className: "active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: 11, color: "#fff", border: "1px solid rgba(255,255,255,.4)", borderRadius: 999, padding: "4px 10px", background: "transparent" } },
        "跳到最后"),
      h("button", { onClick: p.onKnock, disabled: !!p.knocking || left <= 0 || p.done, className: "active:opacity-60 disabled:opacity-35",
        style: { fontFamily: F_BODY, fontSize: 11.5, color: "#1c1a16", background: "rgba(255,255,255,.92)", borderRadius: 999, padding: "5px 13px", border: "none" } },
        p.knocking ? "…" : left <= 0 ? "他不理了" : p.knocks ? "敲一下 · " + left : "敲一下"),
      h("button", { onClick: p.onClose, className: "active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(255,255,255,.8)", padding: "5px 4px", background: "transparent", border: "none" } },
        "退出"));
  }

  return {
    THOUGHT_CAP, THOUGHT_FREE, thoughtCapFor, KNOCK_CAP, KNOCK_HALFLIFE_MS, WATCH_COOLDOWN_MS, WATCH_COOLDOWN_OFF, ACT_CAP,
    WATCH_ACTS, ACT_KEYS,
    watchInstruction, watchSchemaHint, watchTargetSel,
    WatchDot, WatchThought, WatchBar, WatchPage, WatchSearchPill, dropEchoBubbles,
    normalizeActs, actDuration, typeTick, sessionDuration, applyWrite, applyReply, sameName, pickName,
    appQueue, knockDecayed, knockPush, knockStep, knockOver, knockBeat, spliceBeat, clampWatchAff, cooldownLeft,
    knockedToday, watchedNote, HINT_PER_DAY, watchHintOn, watchHintUsed
  };
});
