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

  // 一整段里最多几句心声。她要的是「三四句就够」，多了就变成配旁白的 PPT。
  const THOUGHT_CAP = 4;
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
  const ACT_CAP = 60;

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
    openPage: { args: ["name", "site", "gist"], zh: "打开刚搜出来的那一页", write: true },
    scroll:   { args: ["amount"], zh: "滑动" },
    look:     { args: ["at"], zh: "只是看着某样东西，什么也没做" },
    type:     { args: ["text"], zh: "一个字一个字打" },
    erase:    { args: ["n"], zh: "删字（不给 n 就全删光）" },
    send:     { args: [], zh: "落下这一笔：微信里是发出去，便签里是存下", write: true },
    // 他发完，对面隔一会儿回一句——不然那一屏就永远停在他自己那条上，像对面死了。
    // ⚠️这是【对面说的话】，不是他说的：from 是对面那个人。
    reply:    { args: ["name", "text"], zh: "对面回了一句（发完之后隔一会儿）", write: true },
    pause:    { args: ["ms"], zh: "停住" },
    think:    { args: ["text"], zh: "心里那一句（浮在屏幕上）" }
  };
  const ACT_KEYS = Object.keys(WATCH_ACTS);
  // openChat 是 openItem 的旧名字（v66.17 那一天用的），照收不误
  const ACT_ALIAS = { openChat: "openItem", openPhoto: "openItem", openNote: "openItem", save: "send" };

  const S = v => String(v == null ? "" : v);
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
    let thoughts = 0;
    for (const x of list) {
      if (out.length >= ACT_CAP) { dropped.push("超出 " + ACT_CAP + " 条的部分"); break; }
      if (!x || typeof x !== "object") { dropped.push(JSON.stringify(x)); continue; }
      const raw0 = S(x.kind || x.action).trim();
      const kind = ACT_ALIAS[raw0] || raw0;
      if (ACT_KEYS.indexOf(kind) < 0) { dropped.push(raw0 || JSON.stringify(x)); continue; }
      if (kind === "think") {
        // 心声超额的直接扔掉，不是往后挪——往后挪等于还是发了 8 句，只是晚一点
        if (thoughts >= THOUGHT_CAP) { dropped.push("第 " + (thoughts + 1) + " 句心声（超过 " + THOUGHT_CAP + " 句）"); continue; }
        const text = S(x.text).trim();
        if (!text) { dropped.push("空的心声"); continue; }
        thoughts++;
        out.push({ kind: "think", text: text.slice(0, 60) });
        continue;
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
      if (x.gist != null) a.gist = S(x.gist).trim().slice(0, 160);
      if (x.text != null) a.text = S(x.text).slice(0, 200);
      if (x.amount != null) a.amount = Math.max(-2000, Math.min(2000, N(x.amount, 0)));
      if (x.n != null) a.n = Math.max(1, Math.min(200, N(x.n, 1)));
      if (x.ms != null) a.ms = Math.max(120, Math.min(6000, N(x.ms, 800)));
      out.push(a);
    }
    return { acts: out, dropped: dropped };
  }

  // 演一个动作要多久（毫秒）。打字按字数走，别的按手感给。
  function actDuration(a) {
    if (!a) return 0;
    if (a.kind === "pause") return N(a.ms, 800);
    if (a.kind === "type") return Math.max(300, S(a.text).length * 90);
    if (a.kind === "erase") return Math.max(260, N(a.n, 8) * 55);
    if (a.kind === "reply") return Math.max(900, S(a.text).length * 55);
    if (a.kind === "think") return 1600;
    if (a.kind === "look") return 1400;
    if (a.kind === "scroll") return 700;
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
  function applyReply(d, name, text, now) {
    const ts = N(now, Date.now());
    const who = S(name).trim(), body = S(text).trim();
    if (!who || !body) return { d: d, wrote: false };
    const base = d && typeof d === "object" ? d : {};
    const chats = Array.isArray(base.chats) ? base.chats.map(c => Object.assign({}, c)) : [];
    let row = chats.find(c => c && S(c.name) === who);
    if (!row) return { d: d, wrote: false };   // 对面得是已经存在的那个人，不许凭空多一个
    // 群里回话的可能是群里某个人；私聊就是对方本人。名字模型给的那个为准。
    const from = row.type === "group" ? (S((row.messages || [])[0] && (row.messages || [])[0].from) || who) : who;
    row.messages = (Array.isArray(row.messages) ? row.messages.slice() : []).concat([{ from: from, text: body }]);
    row.last = body;
    row._ts = ts;
    row.time = "刚刚";
    return { d: Object.assign({}, base, { chats: chats }), wrote: true };
  }
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
      let row = chats.find(c => c && S(c.name) === who);
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
      const hit = who ? items.find(x => x && S(x.title) === who) : null;
      if (hit) { hit.body = body; hit.time = "刚刚"; hit._ts = ts; }
      else items.unshift({ title: who || body.slice(0, 14), body: who ? body : "", time: "刚刚", _ts: ts });
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
      if (page) tabs.unshift({ title: page, site: S((o0 && o0.site) || ""), age: "刚开的", pinned: false, cover: tabs.length % 6, gist: S((o0 && o0.gist) || "") });
      if (!who && !page) return { d: d, wrote: false };
      return { d: Object.assign({}, base, { searches: searches, tabs: tabs.slice(0, 12) }), wrote: true };
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

  // 好感：一次 session 累计封顶 ±1（现在的量表是 -5~5、日常聊天一律 0，
  // 所以 ±1 已经是「这事留了点痕迹」的分量）。
  // ⚠️方向不写死成负的：他被你撞见在翻你的照片，完全可以是加分的。
  //   是嫌你烦还是心里一动，让人设自己决定；这儿只兜幅度。
  function clampWatchAff(v) {
    const n = N(v, 0);
    if (!n) return 0;
    return n > 0 ? 1 : -1;
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
  function watchInstruction(o) {
    const c = (o && o.char) || {};
    const uName = (o && o.uName) || "对方";
    const ph = (o && o.phone) || {};
    const can = Array.isArray(o && o.apps) ? o.apps : ["wechat"];
    const arr = a => Array.isArray(a) ? a : [];
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
      now.push("〔微信 wechat〕会话（openItem 的 name 从这里照抄）：\n" + (chats || "（还没有会话）")
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
    if (can.indexOf("notes") >= 0) {
      const ns = arr((ph.notes || {}).items).slice(0, 14)
        .map(x => "· " + (x.title || "?") + (x.body ? "：" + String(x.body).slice(0, 34) : "")).join("\n");
      now.push("〔便签 notes〕已有的便签（openItem 的 name 就是便签的标题）：\n" + (ns || "（一条便签都没有，那就别点进去）"));
    }

    return [
      "现在是你自己拿着手机在刷。没有人跟你说话，也没有人在听——**你以为**。",
      "把接下来这几分钟你在手机上真实做的事，一步一步写成一串动作。" + uName + " 会像看屏幕录像一样看着它被演出来。",
      "",
      "【你能做的动作】只许用下面这些词，别自己造：\n" + words,
      "",
      "【怎么才像真的在刷手机】",
      "· **大部分时候你什么也没干成**：点进去、看两眼、退出来。别每次都非得发生一件大事。",
      "· 三种动作的分量完全不同——**只是看**（点开一张旧照片、翻回很久以前的话、盯着某个人的头像）本来就是最常见的那种；",
      "  **改**（写了又删）次之；**真发出去**最少。一整段里真正送出去的东西，一两件顶天了。",
      "· 打字要带上你反悔的那一下：type 打完可以 erase 掉重打，也可以打完了就 lock 走人。**没发出去的那句才是最像你的**。",
      "· 停顿是有意义的：pause 放在你犹豫、走神、或者盯着某样东西挪不开眼的地方。",
      "· **动作是主角，心声是配角**：一整段里绝大多数是动作（点、翻、打字、停），think 只有寥寥几句。写成一串心声就不是「看他玩手机」了，是配旁白。",
      "· think 是你心里那一句，第一人称，**整段最多 " + THOUGHT_CAP + " 句**。它不是旁白——不许写「他似乎在犹豫」这种从外面看的句子，只写你自己心里冒出来的那一句。多数动作根本不配一句心声。",
      "",
      "【每个 app 里你能干什么】",
      can.indexOf("wechat") >= 0 ? "· 微信：openItem 点开一个会话 → type / erase 打字改字 → send 发出去（或者不发，直接 back 走人）。tab 可以切 chats / contacts / moments / me。" : "",
      can.indexOf("wechat") >= 0 ? "  发出去之后，对面**多半会回一句**：用 reply 写，name 是那个会话的名字、text 是对面说的话。别每条都秒回——先 pause 一会儿更像。对面也可以干脆不回（那也是一种回答）。" : "",
      can.indexOf("album") >= 0 ? "· 相册：openItem 点开一张【已经有的】照片，look 着它、pause 一会儿。**这一路你什么都改不了，也不该改**——就是翻旧照片。tab 可以切 library / collections / saved。" : "",
      can.indexOf("notes") >= 0 ? "· 便签：openItem 点开一条已有的便签，手上就是它现在的正文；erase 把它划掉（不给 n 就整段划光）、type 重新写、send 存下。**这是改，不是新写一条**。" : "",
      can.indexOf("browser") >= 0 ? "· 浏览器：type 往地址栏里敲你要搜的那句（可以敲了又 erase 掉重敲）→ send 回车搜出去。搜完**不一定点得开东西**，那也很像你；真想点进去就 openPage，给 name（那一页的标题）、site（哪个站）、gist（那一页上写着什么，两三句）。也可以 openItem 点开一个已经开着的标签页或书签。tab 可以切 tabs / search / marks / priv。" : "",
      can.indexOf("music") >= 0 ? "· 音乐：openItem 点一首歌的名字——**它会真的开始放**。歌只能从下面那份歌单里挑。" : "",
      "",
      "【他这台手机现在的样子】\n" + now.join("\n\n"),
      "",
      "【硬规矩】",
      "· 只能碰上面真实存在的东西：会话、人、照片、便签，**名字一个字都不许改，也不许凭空多出一个**。",
      "· 第一个动作从 wake（亮屏）起，最后一个动作是 lock（锁屏）。中间要进 app 用 open。",
      "· **能打开的只有这几个**：" + can.join(" / ") + "。open 的 app 一律填这几个英文词，别写中文名、别写别的 app——写别的等于这一下什么也没发生。",
      "· 你今天的心情、你和 " + uName + " 现在处到哪一步、你的人设——这几样决定你会点开谁、会不会点开 " + uName + "、在哪儿停住。",
      "· 别在动作里解释你为什么这么做。**做就是了**，看的人自己会明白。"
    ].filter(Boolean).join("\n");
  }
  // ⚠️占位值写成【说明】不是【样例内容】——写成样例，模型会照抄那句话
  function watchSchemaHint() {
    return '{"acts":[{"kind":"上面词表里的一个词","app":"要打开的 app（只有 open 用）","name":"要点开的会话或人的名字",'
      + '"at":"你在看的那样东西","text":"你打的字，或者 think 时你心里那一句","amount":"滑动的距离，正数往下","n":"要删掉几个字","ms":"停多久，毫秒"}]}';
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
    if (a.kind === "look") return '[data-watch="look:' + S(a.at).replace(/"/g, "") + '"]';
    if (a.kind === "back") return '[data-watch="back"]';
    if (a.kind === "send") return '[data-watch="send"]';
    if (a.kind === "type" || a.kind === "erase") return '[data-watch="input"]';
    return "";
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
        position: "absolute", left: 0, right: 0, bottom: 122, zIndex: 62, pointerEvents: "none",
        display: "flex", justifyContent: "center", padding: "0 20px"
      }
    }, h("span", {
      style: {
        maxWidth: "88%", borderRadius: 14, padding: "8px 14px",
        background: "rgba(24,21,18,.74)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.65, color: "rgba(255,252,246,.96)",
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
    return h("div", {
      style: {
        position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 64,
        padding: "10px 14px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 12px)",
        display: "flex", alignItems: "center", gap: 9,
        background: "linear-gradient(rgba(18,16,14,0), rgba(18,16,14,.72) 42%)"
      }
    },
      h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "rgba(255,255,255,.72)", minWidth: 44 } },
        p.done ? "看完了" : (p.i || 0) + " / " + (p.total || 0)),
      h("span", { style: { flex: 1 } }),
      p.done ? null : h("button", { onClick: p.onSpeed, className: "active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: 11.5, color: "#fff", border: "1px solid rgba(255,255,255,.4)", borderRadius: 999, padding: "5px 11px", background: "transparent" } },
        (p.speed || 1) + "×"),
      p.done ? null : h("button", { onClick: p.onSkip, className: "active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: 11.5, color: "#fff", border: "1px solid rgba(255,255,255,.4)", borderRadius: 999, padding: "5px 11px", background: "transparent" } },
        "跳到最后"),
      h("button", { onClick: p.onKnock, disabled: !!p.knocking || left <= 0 || p.done, className: "active:opacity-60 disabled:opacity-35",
        style: { fontFamily: F_BODY, fontSize: 12, color: "#1c1a16", background: "rgba(255,255,255,.92)", borderRadius: 999, padding: "6px 14px", border: "none" } },
        p.knocking ? "…" : left <= 0 ? "他不理了" : p.knocks ? "敲一下 · " + left : "敲一下"),
      h("button", { onClick: p.onClose, className: "active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(255,255,255,.8)", padding: "5px 4px", background: "transparent", border: "none" } },
        "退出"));
  }

  return {
    THOUGHT_CAP, KNOCK_CAP, KNOCK_HALFLIFE_MS, WATCH_COOLDOWN_MS, WATCH_COOLDOWN_OFF, ACT_CAP,
    WATCH_ACTS, ACT_KEYS,
    watchInstruction, watchSchemaHint, watchTargetSel,
    WatchDot, WatchThought, WatchBar,
    normalizeActs, actDuration, sessionDuration, applyWrite, applyReply,
    knockDecayed, knockPush, knockStep, knockOver, clampWatchAff, cooldownLeft
  };
});
