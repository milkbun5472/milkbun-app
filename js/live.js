// ============================================================
// 直播（live）—— 群友 2026-10-07 提的，她拍板「1c 2b」：
//   · 两种都要：【看 TA 播】（TA 是主播，她进直播间）和【我来播】（她开播，她的人混在观众里）。
//   · 弹幕是【背景】：屏幕上滚过去的路人弹幕只是氛围，不进上下文、TA 不回它们。
//     TA 只理她、和几个有名有姓的常客（擂台 v60.41 那一课：网名刷屏＝借来的形状，没有活人）。
// 看 TA 播：走 runProbe（voiceScene），料就是TA平时那一整份——播的时候TA还是TA。
// 我来播：几个人一起看，一枪写完所有人的反应（每人一份短人设 + 最近几句聊天）。
// 打赏走她的钱包；TA 们私下发来的消息落进各自的单聊。下播后记一条事实进记忆库。
// 存 x_live（DURABLE_TEXT_KEYS，进 IDB）。
// ============================================================
(function () {
  const KEY = "x_live";
  const CAP = 40;             // 回放最多留几场
  const LINES_CAP = 400;      // 一场里最多留几行
  const CTX_LINES = 40;       // 每一拍给模型看最近几行
  const LIVE_INK = "#f3eef7", LIVE_DIM = "rgba(243,238,247,.62)", LIVE_BG = "#141019", LIVE_RED = "#e2556b", LIVE_LINE = "rgba(255,255,255,.12)";

  // 播什么：只给方向，不给答案。「TA 自己定」就一个字都不给。
  const KINDS = [["free", "TA 自己定"], ["chat", "聊天"], ["game", "打游戏"], ["sing", "唱歌"], ["study", "陪学陪工作"], ["cook", "做饭吃饭"], ["outdoor", "户外"], ["sell", "带货"], ["spicy", "擦边"]];
  const HOST_KINDS = KINDS.filter(k => k[0] !== "free" && k[0] !== "sell");
  const GIFTS = [["小心心", 1], ["棒棒糖", 6], ["玫瑰", 20], ["告白气球", 99], ["跑车", 520], ["火箭", 1314]];
  // 平台抽成（她 2026-10-08：「直播只有50%」）：打赏多少从送的人钱包里全额出，主播只拿到一半
  const LIVE_CUT = 0.5;
  const toHost = amount => Math.floor((Number(amount) || 0) * (1 - LIVE_CUT));
  // 粉丝团：按【这个号】在这个主播直播间累计打赏的钱算（她 2026-10-08：「粉丝团等级按打赏的钱来」）
  const FAN_LV = [1, 50, 200, 520, 1314, 3344, 5200, 13140, 33440, 52000];
  const fanLevel = total => FAN_LV.filter(x => (Number(total) || 0) >= x).length;
  // 粉丝团的名字（她 2026-10-08：「每一级的名字也可以不一样，由主播自定义；生成主播的时候顺手生成，可以重 roll」）
  //   像抖音那样两套：等级是名字旁边的小数字，粉丝团是展开写的「团名 · 这一级叫什么」
  const CLUB_SHAPE = '"club":{"name":"","levels":["","","","","","","","","",""]}';
  const CLUB_ASK = "club 他给自己粉丝团起的名字（name，几个字）和十个等级各叫什么（levels，从低到高十个，每个几个字），照他这个人、他和粉丝的相处、他播的东西起";
  const normClub = c => {
    const name = S(c && c.name).replace(/[「」]/g, "").slice(0, 10);
    const lv = arr(c && c.levels).map(x => S(x).replace(/[「」]/g, "").slice(0, 8)).filter(Boolean).slice(0, 10);
    return name && lv.length >= 5 ? { name, levels: lv } : null;
  };
  const clubLv = (club, lv) => club && lv ? (club.levels[Math.min(lv, club.levels.length) - 1] || "") : "";
  const clubText = (club, lv) => club ? "「" + club.name + "」" + lv + " 级" + (clubLv(club, lv) ? " · " + clubLv(club, lv) : "") : "粉丝团 " + lv + " 级";
  const fanNext = total => FAN_LV.find(x => (Number(total) || 0) < x) || 0;
  // 直播间里偶尔冒出来的事：本地掷，不花调用。只给「发生了什么」，怎么接是主播自己的事（bans-make-it-dumber：掷轴不掷答案）
  const EVENTS = ["有人在弹幕里带节奏、阴阳怪气地骂你", "平台弹出一条提醒：直播内容被举报，请注意", "有人一直刷屏问你是不是有对象", "直播间突然涌进来一大波新人", "网络卡了一下，画面定住了几秒", "有个不认识的人刷了个大礼物，要你点他的名", "常客里有两个人在弹幕里吵起来了"];
  const EVENT_P = 0.14;
  // TA 自己开播（她 2026-10-08：「可以做本地算法吗，不看就不调用」）：
  //   按「人 + 这一天」算出来，同一天永远同一个结果；只是一张时间表，她不点进去就一个字都不生成。
  const hashOf = str => { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  const dayKey = d => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const SLOT_KINDS = ["chat", "game", "sing", "study", "cook", "outdoor", "sell"];
  // ⚠️先看日程（群友 2026-10-08：「直播不读日程吗？日程写 10 点直播，char 现在就播了」）：
  //   schedOf(c) 给的是今天日程里写着直播的那几段 [{start,end}]（毫秒）；
  //   今天日程排好了却没写直播 → 给 []，今天不播；今天还没排日程 → 给 null，才按日子掷。
  function slotsOf(chars, at, schedOf) {
    const now = at instanceof Date ? at : new Date();
    return arr(chars).flatMap(c => {
      const hs = hashOf(String(c.id) + "|" + dayKey(now));
      const sch = typeof schedOf === "function" ? schedOf(c) : null;
      if (Array.isArray(sch)) return sch.map((w, i) => ({ id: "slot_" + c.id + "_" + dayKey(now) + "_s" + i, charId: c.id, start: w.start, end: w.end, kind: w.kind || SLOT_KINDS[(hs >>> 16) % SLOT_KINDS.length], fromSchedule: true }));
      return [slotByHash(c, now, hs)].filter(Boolean);
    });
  }
  function slotByHash(c, now, hs) {
    return (function () {
      if (hs % 100 >= 22) return null;               // 大概五天里播一回
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19 + ((hs >>> 7) % 4), ((hs >>> 10) % 4) * 15).getTime();
      const end = start + (60 + ((hs >>> 13) % 4) * 30) * 60000;
      return { id: "slot_" + c.id + "_" + dayKey(now), charId: c.id, start, end, kind: SLOT_KINDS[(hs >>> 16) % SLOT_KINDS.length] };
    })();
  }

  // 图标：一个镜头加两道往外走的信号
  window.GLive = p => h(Svg, p,
    h("rect", { x: 4, y: 8, width: 11, height: 9, rx: 2 }),
    h("path", { d: "M15 11l4-2.4v7.8L15 14" }),
    h("path", { d: "M7.5 5.2a6 6 0 0 1 4 0M6 3a9 9 0 0 1 7 0" }));

  const S = v => String(v == null ? "" : v).trim();
  const arr = v => Array.isArray(v) ? v : [];
  const uid = p => p + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  const load = () => { try { const v = loadJSON(KEY, []); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  const CB = () => (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt ? ContentBoundaries.prompt + "\n\n" : "");
  // 外壳的底：顶上打下来一束暖红的灯，像演播间（不是平铺的米白）
  const liveFloor = t => ({ background: "radial-gradient(130% 55% at 50% -12%,rgba(226,85,107,.16),rgba(226,85,107,0) 62%),repeating-linear-gradient(90deg,rgba(0,0,0,.018) 0 1px,transparent 1px 22px)," + t.bg });
  const kindZh = k => (KINDS.find(x => x[0] === k) || [k, k])[1];

  // 路人弹幕：只要几条短的字，一律不进下一拍的上下文
  const normNoise = v => arr(v).map(S).filter(Boolean).map(x => x.slice(0, 30)).slice(0, 12);
  const normChat = (v, names) => arr(v).map(x => x && typeof x === "object" ? { name: S(x.name).slice(0, 20), text: S(x.text).slice(0, 300) } : null)
    .filter(x => x && x.name && x.text && (!names || names.indexOf(x.name) >= 0));
  const normLines = v => (Array.isArray(v) ? v : (S(v) ? [S(v)] : [])).map(S).filter(Boolean).map(x => x.slice(0, 400)).slice(0, 10);

  // 给模型看的那一段经过。⚠️路人弹幕不在里面——那是「2b」：只给眼睛看，不给TA看。
  function transcript(ses) {
    return arr(ses.lines).slice(-CTX_LINES).map(l => {
      if (l.kind === "host") return (l.name || "主播") + "（主播）" + (l.act ? "【" + l.act + "】" : "") + "：" + l.text;
      if (l.kind === "gift") return l.name + " 送出了「" + l.gift + "」×1（" + l.amount + " 元）";
      if (l.kind === "enter" || l.kind === "event") return "〔" + l.text + "〕";
      if (l.kind === "rival") return l.name + "（PK 对面的主播）：" + l.text;
      if (l.kind === "me" && l.linked) return l.name + "（连麦中，在画面里开口说）：" + l.text;
      return l.name + "（弹幕）：" + l.text;
    }).join("\n");
  }

  // ── 错过的那一场（她 2026-10-08 选的「回放和高光」）──
  //   TA 自己播完了、她没进去：落地页列出来，她点了才花一次调用剪一份高光；不点一个字都不生成。
  const RECAP_SHAPE = '{"title":"","host":"","scene":"","flow":[{"who":"","text":""}],"noise":[""],"viewers":0}';
  function recapInstruction(slot, uName) {
    const d = new Date(slot.start), hm2 = x => x.getHours() + ":" + String(x.getMinutes()).padStart(2, "0");
    return "你在一个直播平台上有自己的直播间。" + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日 " + hm2(d) + " 到 " + hm2(new Date(slot.end)) + "，你播了一场" + kindZh(slot.kind) + "。" + uName + "那会儿没来看。"
      + "\n你在平台上是个什么样的主播——主播名、粉丝是一群什么人、对着镜头什么样——都从你这个人身上长出来。"
      + "\n平台把这场剪成了一份高光回放，看回放的人看到的就是这几段。写：直播间标题 title、你的主播名 host、镜头里的样子 scene（一两句）、"
      + "高光里按先后的 flow（8~14 项，每一项 who 写「主播」或某个观众的网名，text 写那一句；回谁的弹幕就把那条排在前面）、滚过去的路人弹幕 noise（6~10 条，很短）、这场最多时的在线人数 viewers（数字）。";
  }

  // ── 看 TA 播 ────────────────────────────────────────────
  function watchInstruction(ses, uName, first) {
    const who = ses.as === "mask"
      ? uName + "这次用的是一个马甲号「" + ses.maskName + "」进的直播间。你不知道这个号是她——除非她自己说破，或者她说的话让你认出来。"
      : uName + "用的是自己的号进的直播间，名字就是「" + uName + "」，你一眼就知道是她。";
    const kind = ses.kind && ses.kind !== "free" ? "这一场播的是：" + kindZh(ses.kind) + "。" : "这一场播什么由你自己定。";
    const topic = S(ses.topic) ? "她希望看到的是：" + S(ses.topic) + "（要不要照这个播，看你这个人）。" : "";
    const me = ses.as === "mask" ? "「" + ses.maskName + "」" : uName;
    const facts = [];
    if (first && ses.midway) facts.push("你这一场已经播了 " + ses.midway + " 分钟，" + me + "是半路进来的——前面发生过什么由你定，别从头再开一次场。");
    if (ses.club) facts.push("你的粉丝团叫「" + ses.club.name + "」，十个等级从低到高叫：" + ses.club.levels.join("、") + "。");
    if (ses.fanLv) facts.push(me + "在你直播间的粉丝团是 " + ses.fanLv + " 级" + (clubLv(ses.club, ses.fanLv) ? "（「" + clubLv(ses.club, ses.fanLv) + "」）" : "") + "，这个号在你这儿累计打赏过 " + (ses.fanTotal || 0) + " 元。");
    const board = Object.keys(ses.board || {}).map(k => [k, ses.board[k]]).sort((a, b) => b[1] - a[1]).slice(0, 4);
    if (board.length) facts.push("这一场的打赏榜：" + board.map((x, i) => (i + 1) + ". " + x[0] + " " + x[1] + " 元").join("；") + "。");
    facts.push("平台抽成一半：观众打赏多少，你实际到手一半。");
    if (ses.mod) facts.push(me + "是你直播间的房管。" + (arr(ses.banned).length ? "被禁言、发不了弹幕的：" + ses.banned.join("、") + "。" : ""));
    if (ses.linked) facts.push(me + "正在跟你连麦：她的声音和画面所有观众都看得到、听得到，她说的话是当着镜头说的。");
    else if (ses.linkAsk) facts.push(me + "刚申请了跟你连麦。接不接看你这个人和你们的关系；写在 link（接就 true，不接 false）。");
    if (ses.rival) facts.push("你正在跟另一个主播「" + ses.rival.host + "」连线 PK，两边观众比礼物，对面的画面和声音你这边也看得见。对面是这样一个人：\n" + ses.rival.brief + "\n对面这一拍说的话写在 rival.say（数组），对面观众这一拍刷的礼物总额写在 rival.gift（数字）。你俩什么关系，决定这是真打还是在演。");
    if (ses.kind === "sell") facts.push("这是带货：你此刻手上在讲哪件商品写在 item（name 商品名、price 价格数字）；换了一件就写新的，还是这件就照旧写。");
    // 串门（她 2026-10-08）：她叫了自己的人一起来看路人主播；TA 在弹幕里说什么也写进 flow
    if (ses.buddy) facts.push("直播间里有个观众「" + ses.buddy.name + "」是跟" + me + "一起来看的，你不认识TA。TA 是这样一个人：\n" + ses.buddy.brief + "\nTA 这一拍要是发了弹幕，写进 flow（who 写「" + ses.buddy.name + "」），说什么、对你什么态度照TA这个人和TA跟" + me + "的关系来；理不理TA看你。");
    if (ses.song) facts.push(me + "点了一首歌：《" + ses.song + "》。唱不唱、怎么唱看你。");
    if (ses.event) facts.push("这一拍直播间里发生了：" + ses.event + "。怎么接看你。");
    const base0 = "你在一个直播平台上有自己的直播间，此刻正在开播。你在平台上是个什么样的主播——主播名叫什么、平时播什么、粉丝是一群什么人、对着镜头和私下是不是一个样——都从你这个人身上长出来；设定里没写，就照你这个人真会怎么做来定。\n"
      + kind + topic + "\n"
      + "直播间里：" + who + "\n"
      // 太冲了（她 2026-10-08：「为啥这么超雄」）：每一拍都要出点动静，模型就一拍比一拍往上拱。给判据，不给禁令
      + "一场直播是几个小时的日常，大部分时候是平平常常的：聊着、做着手上的事、接接梗。情绪起伏得有来由（常客说了什么、真发生了什么），起多大照你这个人平时对观众是什么样；没来由的时候不往上拱，上一拍拱起来的也会落回去。\n"
      + "还有几个有名有姓的常客，各自带着对你的看法。屏幕上另有一大片路人弹幕滚过去，那些你看不清、也不必回。你说话的对象是镜头、是她、是这几个常客——挑着回，不必谁都回。"
      + "\n常客们这一拍要是送了礼物，写在 gifts（name 常客网名、gift 礼物名、amount 金额数字；没人送就空）。你要是想让" + me + "当房管，mod 写 true（不想就不写）。";
    const base = base0 + (facts.length ? "\n\n【此刻】\n" + facts.join("\n") : "");
    if (first) return base + "\n\n现在刚开播。" + (ses.needClub ? "你的粉丝团还没起名，顺手起好：" + CLUB_ASK + "。" : "") + "写：直播间标题 title、你的主播名 host、镜头里看得见的样子 scene（一两句）、几个常客 regulars（2~4 个，每人 name 是网名、who 一句话说清是什么人、lean 一句话说清对你什么态度，几个人别是同一种）、这一拍直播间里按先后发生的 flow（每一项 who 写「主播」或常客的网名，text 写那一句；你在回谁的弹幕，就把那条弹幕排在你那句前面；常客也可以没说话）、你此刻在镜头前做什么 act（一句，可以空）、滚过去的路人弹幕 noise（6~10 条，很短）、在线人数 viewers（数字）。";
    return base + "\n\n【常客】\n" + arr(ses.regulars).map(r => "· " + r.name + "：" + r.who + "；" + r.lean).join("\n")
      + "\n\n【刚才直播间里发生的】\n" + transcript(ses)
      + "\n\n接着往下播。镜头里看得见的样子要是变了（换了地方、挪了镜头、换了衣服、灯变了），写一个新的 scene（一两句），没变就不写。写：这一拍直播间里按先后发生的 flow（每一项 who 写「主播」或常客的网名，text 写那一句；你在回谁的弹幕，就把那条弹幕排在你那句前面；常客也可以没说话）、你此刻在做什么 act（没变就照旧写）、新滚过去的路人弹幕 noise、在线人数 viewers、你要不要下播 end（true/false；真想下播才下）。";
  }
  // 一拍里主播和常客的话排成一条时间线（她 2026-10-08：「主播的话在上面然后才轮到评论，但他是在回复评论，对不上」）
  const WATCH_SHAPE_FIRST = '{"title":"","host":"","scene":"","regulars":[{"name":"","who":"","lean":""}],"flow":[{"who":"常客网名","text":""},{"who":"主播","text":""}],"act":"","gifts":[],"noise":["",""],"viewers":0}';
  const WATCH_SHAPE = '{"flow":[{"who":"常客网名","text":""},{"who":"主播","text":""}],"act":"","scene":"","gifts":[],"noise":["",""],"viewers":0,"end":false}';
  // 这几样只在用得上的时候往形状里加，不然模型会觉得每拍都该填
  const watchShape = (ses, first) => (first ? WATCH_SHAPE_FIRST : WATCH_SHAPE).replace(/\}$/, ""
    + (first && ses.needClub ? "," + CLUB_SHAPE : "")
    + (ses.linkAsk && !ses.linked ? ',"link":false' : "") + (!ses.mod ? ',"mod":false' : "")
    + (ses.rival ? ',"rival":{"say":[""],"gift":0}' : "") + (ses.kind === "sell" ? ',"item":{"name":"","price":0}' : "") + "}");

  // ── 我来播 ──────────────────────────────────────────────
  function hostInstruction(ses, uName, chars, briefs, first) {
    const names = chars.map(c => c.name);
    return AC() + CB()
      + "【场景】" + uName + "开了一场直播。" + (ses.kind ? "她播的是：" + kindZh(ses.kind) + "。" : "") + (S(ses.title) ? "直播间标题：" + S(ses.title) + "。" : "")
      + (S(ses.topic) ? "她自己说这一场：" + S(ses.topic) + "。" : "")
      + "\n下面这几个人都认识她，此刻都在她的直播间里看着（她知道他们在）。直播间里还有一大片不认识的路人在刷弹幕。"
      + "\n\n" + briefs.join("\n\n")
      + "\n\n【刚才直播间里发生的】\n" + (transcript(ses) || "（刚开播）")
      + "\n\n【这一次要写什么】" + (first ? "她刚开播。" : "她刚在镜头前说了、做了上面最后那几句。")
      + "这几个人各自照自己的性子看她播：可以发弹幕（公开，所有人都看得见）、可以送礼物、可以私下给她发一条消息（只有她看得见，会落进你俩的聊天）、也可以什么都不做。谁跟她什么关系、此刻什么心情，决定他在别人面前怎么说、私下又怎么说。"
      + "\n写：这几个人公开发的弹幕 chat（name 只能是：" + names.join("、") + "）、送的礼物 gifts（name、gift 礼物名、amount 金额数字；没人送就空）、私下发的消息 private（name、text；没有就空）、路人弹幕 noise（6~10 条，很短，只是氛围）、在线人数 viewers（数字）。";
  }
  const HOST_SHAPE = '{"chat":[{"name":"","text":""}],"gifts":[{"name":"","gift":"","amount":0}],"private":[{"name":"","text":""}],"noise":["",""],"viewers":0}';

  // ── 路人主播（她 2026-10-08）────────────────────────────────
  //   随便逛逛一次刷一批不认识的主播；喜欢的关注（最多 20 个），他也按日子自己开播；
  //   来得多了他记得你；到他看重的那道门槛（有人看钱、有人看眼熟——跟人设走）就能私信，再往上能申请加好友，
  //   他同意了就进人格档案馆变成正式角色。大号和马甲各算各的交情。存 x_liveStrangers。
  const ST_KEY = "x_liveStrangers";
  const ST_FOLLOW_MAX = 20, ST_BATCH = 6;
  const stLoad = () => { try { const v = loadJSON(ST_KEY, null); return v && Array.isArray(v.list) ? v : { list: [] }; } catch (e) { return { list: [] }; } };
  const tieKeyOf = (as, maskName) => as === "mask" ? "mask:" + (maskName || "路过的") : "me";
  // 跟路人主播的等级（她 2026-10-08：「比如七级才能开加好友，然后再看钱或者眼熟度或者两者」）：
  //   门槛是统一的，他同不同意才看他这个人在乎什么（values：钱／眼熟／两样都看）
  const ST_EXP = [30, 80, 150, 250, 380, 550, 800, 1100, 1500];
  const ST_DM_LV = 4, ST_FRIEND_LV = 7;
  const stExp = (visits, total) => (Number(visits) || 0) * 30 + (Number(total) || 0);
  const stLevel = exp => ST_EXP.filter(x => exp >= x).length;
  const stNext = exp => ST_EXP.find(x => exp < x) || 0;
  const VALUES_ZH = { money: "你更看重观众舍不舍得为你花钱", familiar: "你更看重眼熟——来得勤、一直在的人", both: "钱和眼熟你都看" };
  // 掷轴不掷答案（bans-make-it-dumber）：一批里每个人先掷几样【事实】，免得六个人一个样；人长什么样由模型从这些事实里长出来
  const ST_AGE = ["十八九岁", "二十出头", "二十五六", "快三十", "三十多", "四十上下"];
  const ST_RUN = ["刚开播没几天", "播了小半年", "播了一两年", "播了好几年的老主播"];
  const ST_SCALE = ["几十个粉丝", "几百个粉丝", "几千粉丝", "几万粉丝", "几十万粉丝"];
  const ST_DAY = ["白天有正经工作，晚上下班才播", "全职在播，靠这个吃饭", "还在上学", "刚辞职在家", "家里开店，店里忙完了播"];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function strangerSystem(n, hot, date, kinds) {
    const rolls = Array.from({ length: n }, (_, i) => (i + 1) + ". 播的是「" + kindZh(kinds[i]) + "」，" + pick(ST_AGE) + "，" + pick(ST_RUN) + "，" + pick(ST_SCALE) + "，" + pick(ST_DAY));
    return AC() + CB()
      + (date ? "今天是 " + date + "。" : "") + (hot && hot.length ? "今天平台上的热门：" + hot.join("、") + "。" : "")
      + "\n【场景】她在直播平台上随便逛，刷到 " + n + " 个正在开播、互不认识的主播。下面每个人先定了几样事实，人照这些事实长出来：\n" + rolls.join("\n")
      + "\n\n每个人写成一个具体的活人，不是一个类型：哪儿人、平时过什么日子、为什么开始播、镜头前和镜头外差在哪、在意什么、怕什么、说话什么样。"
      + "判据：把他的人设拿掉名字，换个主播还成立，就是写坏了。他播什么、怎么播，跟他这个人对得上。"
      + "\n每人写：name 主播名、title 这一场的直播间标题、bio 主页简介一句（他自己写的那种）、persona 人设（150~300 字，第三人称写他这个人）、look 镜头里看得见的样子（一句）、fans 粉丝数（数字）、viewers 此刻在线（数字）、"
      + "values 他对观众更看重什么：money（舍不舍得花钱）／familiar（眼不眼熟、来得勤不勤）／both（两样都看），照他这个人来。"
      + CLUB_ASK + "。";
  }
  const ST_SHAPE = '{"streamers":[{"name":"","title":"","bio":"","persona":"","look":"","fans":0,"viewers":0,"values":"both",' + CLUB_SHAPE + '}]}';
  // 他记得你：这个号来过几场、每场留一句发生了什么（本地写，不花调用）
  const tieBlock = (st, key, fanLv, fanTotal) => {
    const t = ((st.ties || {})[key]) || {};
    const who = key === "me" ? "她用自己的号" : "她用一个叫「" + key.slice(5) + "」的号";
    if (!t.visits) return "【这个观众】" + who + "，第一次来你的直播间。";
    return "【这个观众】" + who + "，在你直播间来过 " + t.visits + " 场" + (fanTotal ? "，粉丝团 " + fanLv + " 级（累计打赏 " + fanTotal + " 元）" : "") + "。你对这个号的印象：\n" + arr(t.notes).slice(-8).map(x => "· " + x).join("\n");
  };

  // ── 弹幕飘过去的那一层（只给眼睛看）────────────────────────
  let styleIn = false;
  function ensureStyle() {
    if (styleIn || typeof document === "undefined") return;
    styleIn = true;
    const st = document.createElement("style");
    st.textContent = "@keyframes liveFly{from{transform:translateX(0)}to{transform:translateX(-160vw)}}"
      + "@keyframes liveFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}"
      + "@keyframes liveSlide{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}"
      // 自动往下播那根拉条：一根细线＋一颗小红点，不要系统那根粗白条
      + ".live-range{-webkit-appearance:none;appearance:none;background:transparent;height:24px}"
      + ".live-range::-webkit-slider-runnable-track{height:2px;border-radius:1px;background:rgba(255,255,255,.22)}"
      + ".live-range::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:" + LIVE_RED + ";margin-top:-6px;border:0}"
      + ".live-range::-moz-range-track{height:2px;background:rgba(255,255,255,.22)}"
      + ".live-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:" + LIVE_RED + ";border:0}";
    document.head.appendChild(st);
  }
  function NoiseLayer({ noise, seed }) {
    ensureStyle();
    const list = arr(noise).slice(0, 10);
    return h("div", { "data-wk": "livedanmaku", "aria-hidden": "true", style: { position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" } },
      list.map((t, i) => h("div", {
        key: seed + "_" + i,
        style: { position: "absolute", left: "100%", top: (8 + (i * 37) % 70) + "%", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: 12.5,
          color: "rgba(255,255,255,.78)", textShadow: "0 1px 3px rgba(0,0,0,.6)",
          animation: "liveFly " + (7 + (i % 4) * 1.6) + "s linear " + (i * 0.9) + "s 1 both" }
      }, t)));
  }

  function GlyphDot() { return h("span", { style: { display: "inline-block", width: 7, height: 7, borderRadius: 99, background: LIVE_RED, marginRight: 5, verticalAlign: "1px" } }); }

  // ── 直播间（两种共用一个房间）──────────────────────────
  function LiveRoom({ ses, chars, profile, busy, onInvite, onSay, onGift, onEnd, onBack, readOnly, onShare, onLink, onUnlink, onBan, onSong, songs, onBuy, customGifts, onSaveCustom, onDropCustom, autoSec: props_autoSec, onAutoSec }) {
    const [text, setText] = useState("");
    const [giftOpen, setGiftOpen] = useState(false);
    const [songOpen, setSongOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [titleOpen, setTitleOpen] = useState(false);
    // 自动往下播（她 2026-10-08：「搞一个开关，默认关着，放直播间里面」）：开着时这一拍播完、你没动，过一会儿自己走下一拍。
    //   每一拍照样花一次调用，所以默认关、不记住；退出直播间、切到后台、下播都停。
    const [auto, setAuto] = useState(false);
    // 隔多久走一拍（她 2026-10-08：「搞个隐蔽点的拉条，平时不会显示挡着屏幕」）：开着时按钮旁边一个小小的「25 秒」，点了才弹出拉条
    const [slider, setSlider] = useState(false);
    const autoSec = Math.max(10, Math.min(120, Number(props_autoSec) || 25));
    const AUTO_MS = autoSec * 1000;
    useEffect(function () {
      if (!auto || busy || readOnly || ses.endTs) return;
      const t = setTimeout(function () { if (typeof document !== "undefined" && document.hidden) return; onSay(""); }, AUTO_MS);
      return function () { clearTimeout(t); };
    }, [auto, busy, arr(ses.lines).length, ses.endTs, autoSec]);
    const live = !readOnly && !ses.endTs;
    const board = Object.keys(ses.board || {}).map(k => [k, ses.board[k]]).sort((a, b) => b[1] - a[1]);
    const ours = board.reduce((n, x) => n + x[1], 0), theirs = Number(ses.rivalScore) || 0;
    const tag = (txt, color) => h("span", { style: { display: "inline-block", fontFamily: F_BODY, fontSize: 10, color: color || LIVE_INK, border: "1px solid " + (color || LIVE_LINE), borderRadius: 6, padding: "1px 6px", marginLeft: 6, verticalAlign: "middle" } }, txt);
    const listRef = useRef(null);
    useEffect(function () { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [arr(ses.lines).length, busy]);
    const watching = ses.mode === "watch";
    const host = watching ? chars.find(c => c.id === ses.charId) : null;
    const uName = (profile && profile.name) || "我";
    const lastHost = arr(ses.lines).filter(l => l.kind === (watching ? "host" : "me")).slice(-1)[0];
    // 这一拍的字幕：带编号的拍取这一拍主播说的每一句；老记录没编号就只有最后一句
    const allL = arr(ses.lines);
    const caps = (function () {
      if (!watching || !ses.beat) return lastHost ? [{ line: lastHost, reply: null }] : [];
      const out = [];
      allL.forEach((l, i) => {
        if (l.beat !== ses.beat || l.kind !== "host") return;
        const prev = allL[i - 1];
        out.push({ line: l, reply: prev && prev.beat === ses.beat && prev.kind === "reg" ? prev : null });
      });
      return out.length ? out : (lastHost ? [{ line: lastHost, reply: null }] : []);
    })();
    const [capIdx, setCapIdx] = useState(0);
    const capKey = (ses.beat || 0) + "_" + capIdx;
    // 自己左右划（她 2026-10-08：「能不能我自己左右划，我操作的时候不会被自动滑动 override」）：
    //   她一碰字幕卡，这一拍就不再自己往下放，直到下一拍来了才恢复
    const [capHand, setCapHand] = useState(false);
    const capX = useRef(null);
    useEffect(function () { setCapIdx(0); setCapHand(false); }, [ses.beat]);
    useEffect(function () {
      if (capHand || capIdx >= caps.length - 1) return;
      const tm = setTimeout(function () { setCapIdx(i => i + 1); }, 2800);
      return function () { clearTimeout(tm); };
    }, [capIdx, ses.beat, caps.length, capHand]);
    const capGo = d => { setCapHand(true); setCapIdx(i => Math.max(0, Math.min(Math.max(0, caps.length - 1), i + d))); };
    // 手机上碰一下会先来 touch、再补一对 mouse：补的那对不算，不然一划跳两句
    const capTouchAt = useRef(0);
    const capDown = e => { if (e.touches) capTouchAt.current = Date.now(); else if (Date.now() - capTouchAt.current < 800) return; const p = e.touches ? e.touches[0] : e; capX.current = p.clientX; };
    const capUp = e => { if (!e.changedTouches && Date.now() - capTouchAt.current < 800) return; if (capX.current == null) return; const p = e.changedTouches ? e.changedTouches[0] : e; const dx = p.clientX - capX.current; capX.current = null;
      if (Math.abs(dx) > 36) capGo(dx < 0 ? 1 : -1); else capGo(1); };
    const capNow = caps[Math.min(capIdx, Math.max(0, caps.length - 1))] || null;
    const lineEl = (l, i) => {
      if (l.kind === "gift") return h("div", { "data-wk": "livemsg", "data-kind": "gift", key: i, style: { fontFamily: F_BODY, fontSize: 12, color: "#f6c76b", padding: "3px 0" } }, l.name + " 送出了「" + l.gift + "」 ¥" + l.amount);
      if (l.kind === "enter") return h("div", { "data-wk": "livemsg", "data-kind": "enter", key: i, style: { fontFamily: F_BODY, fontSize: 11, color: LIVE_DIM, padding: "3px 0" } }, l.text);
      if (l.kind === "event") return h("div", { "data-wk": "livemsg", "data-kind": "event", key: i, style: { fontFamily: F_BODY, fontSize: 11.5, color: "#f6c76b", padding: "4px 0", opacity: .9 } }, "〔" + l.text + "〕");
      if (l.kind === "private") return h("div", { "data-wk": "livemsg", "data-kind": "private", key: i, style: { fontFamily: F_BODY, fontSize: 12, color: "#cdbdf0", padding: "4px 0" } }, "私信 · " + l.name + "：" + l.text);
      const isHost = l.kind === "host";
      const mine = l.kind === "me";
      return h("div", { "data-wk": "livemsg", "data-kind": l.kind || "", "data-me": mine ? "1" : "0", key: i, style: { padding: "4px 0", fontFamily: F_BODY, fontSize: isHost ? 14 : 13, lineHeight: 1.55, color: LIVE_INK } },
        h("span", { "data-wk": "livemsgname", style: { color: isHost ? LIVE_RED : l.kind === "rival" ? "#7fd6c2" : mine ? "#9fd2ff" : "#d6c7ff", marginRight: 6 } }, (isHost ? "主播 " : l.kind === "rival" ? "对面 " : mine && l.linked ? "连麦 " : "") + l.name),
        mine && watching && ses.fanLv ? tag(ses.club ? (clubLv(ses.club, ses.fanLv) || ses.club.name) + " " + ses.fanLv : "粉丝团 " + ses.fanLv, "#f6c76b") : null,
        l.kind === "reg" && ses.mod && live && onBan && arr(ses.banned).indexOf(l.name) < 0 ? h("button", { "data-wk": "liveban", onClick: () => onBan(l.name), className: "active:opacity-60", style: { float: "right", fontFamily: F_BODY, fontSize: 11, color: LIVE_DIM, minHeight: 24, padding: "0 4px" } }, "禁言") : null,
        l.act ? h("span", { style: { color: LIVE_DIM, marginRight: 4 } }, "（" + l.act + "）") : null,
        l.text);
    };
    // 空着按＝「接着看／接着播」（群友 2026-10-08：「直播的弹幕是你不发就不刷新吗」）：不说话也能往下播一拍
    const send = () => { const v = text.trim(); if (busy) return; setText(""); onSay(v); };
    const stageTitle = watching ? (ses.host || (host && host.name) || "主播") : uName;
    // 全屏直播间（她 2026-10-08：「全屏界面会不会好看点、大一点不会那么挤」，整套换）：
    //   一整屏都是画面，顶上浮一条主播信息，中间偏下一张字幕卡，礼物从左边滑出横幅，弹幕在左下往上滚，最底下一行输入。
    //   ⚠️这里不用 Head：顶栏浮在画面上、背景透明，返回键和安全区照公共的 safeTop 来（mobile-ui-layout 第 1 条里记了这个例外）。
    const [moreOpen, setMoreOpen] = useState(false);
    // 礼物横幅：最近 6 秒里送出的，最多两条；到点自己收
    const [, setTick] = useState(0);
    const giftsNow = allL.filter(l => l.kind === "gift" && Date.now() - (l.ts || 0) < 6000).slice(-2);
    useEffect(function () { if (!giftsNow.length) return; const tm = setTimeout(() => setTick(x => x + 1), 6200); return () => clearTimeout(tm); }, [allL.length]);
    const panelOpen = giftOpen || songOpen || inviteOpen || moreOpen;
    const chip = { minHeight: 30, padding: "0 12px", borderRadius: 99, background: "rgba(0,0,0,.32)", border: "1px solid rgba(255,255,255,.14)", color: LIVE_INK, fontFamily: F_BODY, fontSize: 12 };
    const shadowTx = "0 1px 3px rgba(0,0,0,.7)";
    const moreItem = (label, fn, dis) => h("button", { "data-wk": "livemoreitem", key: label, onClick: () => { setMoreOpen(false); fn(); }, disabled: !!dis, className: "w-full text-left active:opacity-60",
      style: { display: "block", minHeight: 44, padding: "0 14px", color: LIVE_INK, fontFamily: F_BODY, fontSize: 13.5, borderBottom: "1px solid " + LIVE_LINE, opacity: dis ? .5 : 1 } }, label);
    return h("div", { "data-wk": "liveroom", className: "h-full flex flex-col", style: { position: "relative", overflow: "hidden",
        background: "radial-gradient(130% 80% at 30% 18%,rgba(226,85,107,.42),rgba(80,60,120,.38) 50%,rgba(20,16,25,1) 100%)" } },
      // 画面上飘过去的路人弹幕
      ses.endTs ? null : h("div", { style: { position: "absolute", left: 0, right: 0, top: "14%", height: "34%", pointerEvents: "none" } }, h(NoiseLayer, { noise: ses.noise, seed: ses.noiseSeed || 0 })),
      // 底下那层压暗：字压在画面上要看得清
      h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, right: 0, bottom: 0, height: "64%", background: "linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.62) 55%,rgba(0,0,0,.78))", pointerEvents: "none" } }),
      // ── 顶上浮着的一条 ──
      h("div", { "data-wk": "livestage", className: "shrink-0", style: { position: "relative", zIndex: 2, paddingTop: safeTop(6), paddingLeft: 8, paddingRight: 10 } },
        h("div", { className: "flex items-center", style: { gap: 8, minHeight: 44 } },
          h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-60 shrink-0", style: { width: 36, height: 40, color: LIVE_INK, fontSize: 22 } }, "‹"),
          h("div", { className: "flex items-center min-w-0", style: { gap: 8, padding: "3px 10px 3px 3px", borderRadius: 99, background: "rgba(0,0,0,.32)", maxWidth: "62%" } },
            watching && host ? h(Avatar, { character: host, size: 32 }) : h("div", { style: { width: 32, height: 32, borderRadius: 99, flexShrink: 0, background: "linear-gradient(135deg," + LIVE_RED + ",#6a4fb0)" } }),
            h("div", { className: "min-w-0" },
              h("div", { "data-wk": "livestagetitle", style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: LIVE_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, stageTitle),
              h("div", { "data-wk": "livestagesub", style: { fontFamily: F_BODY, fontSize: 10, color: LIVE_DIM, whiteSpace: "nowrap" } }, ses.endTs ? "已下播" : h(Fragment, null, h(GlyphDot), "直播中")))),
          h("div", { className: "flex-1" }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: LIVE_INK, padding: "4px 9px", borderRadius: 99, background: "rgba(0,0,0,.32)", flexShrink: 0 } }, (Number(ses.viewers) || 0) + " 人"),
          (ses.endTs || readOnly) ? (onShare ? h("button", { "data-wk": "liveshare", onClick: onShare, className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 12.5, color: LIVE_INK, padding: "0 6px", minHeight: 40 } }, "发给 TA") : null)
            : h("button", { onClick: onEnd, disabled: !!busy, className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 12.5, color: LIVE_RED, padding: "0 6px", minHeight: 40 } }, watching ? "离开" : "下播")),
        S(ses.title) ? h("div", { "data-wk": "livetitle", onClick: () => setTitleOpen(o => !o), style: { margin: "4px 4px 0 44px", fontFamily: F_BODY, fontSize: 12, lineHeight: 1.5, color: LIVE_INK, cursor: "pointer", textShadow: shadowTx,
          ...(titleOpen ? {} : { display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }) } }, "《" + S(ses.title) + "》") : null,
        // 我的粉丝团、这一场榜一、房管、连麦：一排小牌子
        watching && (ses.fanLv || board.length || ses.mod || (ses.linked && live)) ? h("div", { "data-wk": "livefanbar", className: "flex flex-wrap items-center", style: { margin: "6px 4px 0 44px", gap: 6, fontFamily: F_BODY, fontSize: 10.5 } },
          ses.fanLv ? h("span", { style: { color: "#f6c76b", background: "rgba(0,0,0,.32)", borderRadius: 99, padding: "2px 8px" } }, "我的" + clubText(ses.club, ses.fanLv) + (fanNext(ses.fanTotal) ? "（再 " + (fanNext(ses.fanTotal) - (ses.fanTotal || 0)) + " 元升级）" : "")) : null,
          board.length ? h("span", { style: { color: LIVE_INK, background: "rgba(0,0,0,.32)", borderRadius: 99, padding: "2px 8px" } }, "榜一 " + board[0][0] + " ¥" + board[0][1]) : null,
          ses.mod ? h("span", { style: { color: "#9fd2ff", background: "rgba(0,0,0,.32)", borderRadius: 99, padding: "2px 8px" } }, "你是房管") : null,
          ses.linked && live ? h("span", { style: { color: "#9fd2ff", background: "rgba(0,0,0,.32)", borderRadius: 99, padding: "2px 8px" } }, "● 连麦中") : null) : null,
        // PK：两边比礼物，一根条子从中间往两头挤
        watching && ses.rival ? h("div", { "data-wk": "livepk", style: { margin: "8px 6px 0" } },
          h("div", { style: { display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "rgba(255,255,255,.1)" } },
            h("div", { style: { width: ((ours + 1) / (ours + theirs + 2) * 100) + "%", background: LIVE_RED } }),
            h("div", { style: { flex: 1, background: "#7fd6c2" } })),
          h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: F_BODY, fontSize: 10, color: LIVE_INK, marginTop: 2, textShadow: shadowTx } },
            h("span", null, "我方 " + ours), h("span", null, "对面 " + ses.rival.host + " " + theirs))) : null),
      // ── 画面中间：镜头里的样子、此刻在干嘛 ──
      // 镜头和动作不截行（她 2026-10-08：「看不完全上面的动作」）：中间这块空着的地方都给它，字多了这块自己能往上划
      h("div", { "data-wk": "livemid", className: "flex-1 min-h-0 flex flex-col overflow-y-auto", style: { position: "relative", zIndex: 1, padding: "0 16px", minHeight: 40 } },
        h("div", { style: { marginTop: "auto" } },
        S(ses.scene) ? h("div", { "data-wk": "livescene", key: "sc_" + S(ses.scene).slice(0, 12), style: { fontFamily: F_BODY, fontSize: 11.5, color: LIVE_DIM, lineHeight: 1.5, textShadow: shadowTx, animation: "liveFade .5s ease" } }, ses.scene) : null,
        watching && S(ses.act) ? h("div", { "data-wk": "liveact", key: "act_" + (ses.beat || 0), style: { fontFamily: F_BODY, fontSize: 12.5, color: "rgba(243,238,247,.9)", lineHeight: 1.5, marginTop: 4, textShadow: shadowTx, animation: "liveFade .5s ease" } }, "（" + ses.act + "）") : null)),
      // ── 字幕卡：这一拍主播说的几句，一句一句放；他在回谁，那条弹幕小字带在上面 ──
      capNow ? h("div", { "data-wk": "livecapcard", onTouchStart: capDown, onTouchEnd: capUp, onMouseDown: capDown, onMouseUp: capUp, className: "shrink-0",
        style: { position: "relative", zIndex: 1, margin: "8px 12px 0", padding: "9px 12px 10px", borderRadius: 14, background: "rgba(20,16,25,.55)", border: "1px solid rgba(255,255,255,.1)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", cursor: caps.length > 1 ? "pointer" : "default", touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none" } },
        capNow.reply ? h("div", { key: "rp_" + capKey, style: { fontFamily: F_BODY, fontSize: 11, color: "#d6c7ff", marginBottom: 3, lineHeight: 1.5, animation: "liveFade .4s ease", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, "回 " + capNow.reply.name + "：" + capNow.reply.text)
          : h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: LIVE_DIM, marginBottom: 2 } }, stageTitle),
        h("div", { "data-wk": "livehostline", key: "cap_" + capKey, style: { fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.6, color: LIVE_INK, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", animation: "liveFade .4s ease" } },
          (!watching && capNow.line.act ? "（" + capNow.line.act + "）" : "") + capNow.line.text),
        caps.length > 1 ? h("div", { "data-wk": "livecapdots", className: "flex", style: { gap: 4, marginTop: 6 } }, caps.map((_, i) => h("span", { key: i, style: { width: i === capIdx ? 12 : 5, height: 3, borderRadius: 2, background: i === capIdx ? LIVE_INK : "rgba(243,238,247,.3)", transition: "width .3s" } }))) : null) : null,
      // ── 礼物横幅：从左边滑出来，几秒后收 ──
      giftsNow.length ? h("div", { className: "shrink-0", style: { position: "relative", zIndex: 1, margin: "8px 0 0 12px", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" } },
        giftsNow.map((g, i) => h("div", { "data-wk": "livegiftbanner", key: (g.ts || 0) + "_" + i, className: "flex items-center", style: { gap: 8, padding: "4px 14px 4px 4px", borderRadius: 99, maxWidth: "78%",
          background: "linear-gradient(90deg,rgba(132,84,214,.9),rgba(132,84,214,.25))", animation: "liveSlide .45s ease" } },
          h("span", { style: { width: 30, height: 30, borderRadius: 99, background: "rgba(255,255,255,.2)", color: "#fff", fontFamily: F_DISPLAY, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, S(g.name).slice(0, 1)),
          h("div", { className: "min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, g.name),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "rgba(255,255,255,.8)" } }, "送出 " + g.gift)),
          h("span", { style: { flexShrink: 0, color: "#f6c76b" } }, giftIcon(g.gift, "#f6c76b")),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: "#fff", fontStyle: "italic", flexShrink: 0 } }, "¥" + g.amount)))) : null,
      // ── 弹幕：左下往上滚，不加底框 ──
      h("div", { "data-wk": "livemsglist", ref: listRef, className: "shrink-0 overflow-y-auto px-4", style: { position: "relative", zIndex: 1, height: panelOpen ? "18vh" : "30vh", paddingTop: 10, paddingBottom: 6, textShadow: shadowTx,
          WebkitMaskImage: "linear-gradient(180deg,transparent,#000 18%)", maskImage: "linear-gradient(180deg,transparent,#000 18%)" } },
        arr(ses.lines).map(lineEl),
        busy ? h("div", { "data-wk": "livebusy", style: { fontFamily: F_BODY, fontSize: 11, color: LIVE_DIM, padding: "6px 0" } }, watching ? "……" : "大家在看……") : null),
      // 带货：手上正在讲的那件，能买同款（订单进购物）
      watching && ses.item ? h("div", { "data-wk": "liveitem", className: "shrink-0 flex items-center", style: { position: "relative", zIndex: 1, margin: "6px 12px 0", padding: "7px 12px", borderRadius: 12, background: "rgba(0,0,0,.4)", border: "1px solid " + LIVE_LINE, gap: 10 } },
        h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: 12.5, color: LIVE_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "正在讲：" + ses.item.name),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#f6c76b" } }, "¥" + ses.item.price),
        live && onBuy ? h("button", { "data-wk": "livebuy", onClick: () => onBuy(ses.item), disabled: !!busy, className: "active:opacity-60 shrink-0", style: { minHeight: 32, padding: "0 12px", borderRadius: 10, background: LIVE_RED, color: LIVE_INK, fontFamily: F_BODY, fontSize: 12 } }, "买同款") : null) : null,
      // ── 最底下一行 ──
      (readOnly || ses.endTs) ? h("div", { className: "shrink-0", style: { height: "calc(env(safe-area-inset-bottom) * 0.4 + 12px)" } }) : h("div", { "data-wk": "livecompose", className: "shrink-0 px-3", style: { position: "relative", zIndex: 2, paddingTop: 8, paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)" } },
        giftOpen && watching ? h(GiftPanel, { custom: customGifts, busy, onSend: (g, a) => { setGiftOpen(false); onGift(g, a); }, onSaveCustom, onDropCustom }) : null,
        songOpen && onSong ? h("div", { "data-wk": "livesonglist", style: { maxHeight: 150, overflowY: "auto", marginBottom: 8, borderRadius: 12, border: "1px solid " + LIVE_LINE, background: "rgba(20,16,25,.85)" } },
          arr(songs).length ? songs.map(t2 => h("button", { "data-wk": "livesong", key: t2, disabled: !!busy, onClick: () => { setSongOpen(false); onSong(t2); }, className: "w-full text-left active:opacity-60", style: { display: "block", minHeight: 38, padding: "0 12px", color: LIVE_INK, fontFamily: F_BODY, fontSize: 12.5, borderBottom: "1px solid " + LIVE_LINE } }, "《" + t2 + "》"))
            : h("div", { style: { padding: 12, fontFamily: F_BODY, fontSize: 12, color: LIVE_DIM } }, "一起听里还没有歌")) : null,
        inviteOpen && !ses.buddy ? h("div", { "data-wk": "liveinvite", className: "flex flex-wrap", style: { gap: 8, marginBottom: 8 } }, arr(chars).map(c => h("button", { key: c.id, onClick: () => { setInviteOpen(false); onInvite(c); }, disabled: !!busy, className: "active:opacity-60", style: Object.assign({}, chip, { border: "1px solid " + LIVE_RED }) }, c.remark || c.name))) : null,
        // ⋯ 里收着的：连麦、叫 TA 一起看、点歌
        moreOpen ? h("div", { "data-wk": "livemoremenu", style: { marginBottom: 8, borderRadius: 14, overflow: "hidden", background: "rgba(20,16,25,.9)", border: "1px solid " + LIVE_LINE } },
          !watching ? null : ses.linked ? h("div", { "data-wk": "livelinkbtn", "data-on": "1", key: "lk" }, moreItem("下麦", onUnlink)) : h("div", { "data-wk": "livelinkbtn", "data-on": "0", key: "lk" }, moreItem(ses.linkAsk ? "等 TA 接连麦…" : "申请连麦", onLink, busy || ses.linkAsk)),
          watching && onInvite && !ses.buddy && live ? h("div", { "data-wk": "liveinvitebtn", key: "iv" }, moreItem("叫 TA 一起看", () => setInviteOpen(true))) : null,
          ses.kind === "sing" && onSong ? h("div", { "data-wk": "livesongbtn", key: "sg" }, moreItem("点歌", () => setSongOpen(true))) : null) : null,
        auto && slider ? h("div", { "data-wk": "liveautoslider", className: "flex items-center", style: { gap: 10, marginBottom: 6, padding: "0 4px" } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: LIVE_DIM, flexShrink: 0 } }, "隔"),
          h("input", { type: "range", min: 10, max: 120, step: 5, value: autoSec, onChange: e => onAutoSec && onAutoSec(Number(e.target.value)), onPointerUp: () => setTimeout(() => setSlider(false), 600), className: "live-range", style: { flex: 1 } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: LIVE_INK, width: 44, textAlign: "right", flexShrink: 0 } }, autoSec + " 秒")) : null,
        // 自动往下播留在外面（她 2026-10-08：「自动往下播先留在外面」）
        (giftOpen || songOpen) ? null : h("div", { className: "flex items-center", style: { gap: 6, marginBottom: 8 } },
          h("button", { "data-wk": "liveautobtn", "data-on": auto ? "1" : "0", onClick: () => setAuto(a => !a), className: "active:opacity-60", style: Object.assign({}, chip, { border: "1px solid " + (auto ? LIVE_RED : "rgba(255,255,255,.14)"), background: auto ? "rgba(226,85,107,.3)" : chip.background, color: auto ? LIVE_INK : LIVE_DIM }) }, (auto ? "● " : "○ ") + "自动往下播"),
          auto ? h("button", { "data-wk": "liveautosec", onClick: () => setSlider(v => !v), "aria-label": "调隔多久走一拍", className: "active:opacity-60", style: { minHeight: 30, padding: "0 6px", color: LIVE_DIM, fontFamily: F_BODY, fontSize: 11.5, textDecoration: "underline dotted" } }, autoSec + " 秒") : null),
        h("div", { className: "flex items-end", style: { gap: 8 } },
          h("textarea", { "data-wk": "liveinput", value: text, onChange: e => setText(e.target.value), rows: 1,
            placeholder: watching ? (ses.linked ? "连麦中，直接说" : ses.as === "mask" ? "用「" + ses.maskName + "」发条弹幕" : "说点什么…") : "对着镜头说点什么，或写你在做什么",
            className: "flex-1 outline-none resize-none",
            style: { minHeight: 42, maxHeight: 104, borderRadius: 21, border: "1px solid rgba(255,255,255,.14)", background: "rgba(0,0,0,.4)", color: LIVE_INK, padding: "11px 15px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55 } }),
          watching ? h("button", { "data-wk": "livegiftbtn", onClick: () => { setGiftOpen(v => !v); setMoreOpen(false); setSongOpen(false); }, "aria-label": "送礼物", className: "active:opacity-60 shrink-0 flex items-center justify-center",
            style: { width: 42, height: 42, borderRadius: 99, background: giftOpen ? "rgba(226,85,107,.35)" : "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.14)" } }, giftIcon("礼物", "#f6c76b")) : null,
          watching ? h("button", { "data-wk": "livemorebtn", "data-on": moreOpen ? "1" : "0", onClick: () => { setMoreOpen(v => !v); setGiftOpen(false); setSongOpen(false); setInviteOpen(false); }, "aria-label": "更多", className: "active:opacity-60 shrink-0",
            style: { width: 42, height: 42, borderRadius: 99, background: moreOpen ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.14)", color: LIVE_INK, fontSize: 18, letterSpacing: 1 } }, "⋯") : null,
          h("button", { "data-wk": "livesend", onClick: send, disabled: !!busy, className: "active:opacity-70 shrink-0",
            style: { minWidth: 52, height: 42, padding: "0 10px", borderRadius: 21, background: busy ? "rgba(255,255,255,.08)" : text.trim() ? LIVE_RED : "rgba(255,255,255,.16)", color: busy ? LIVE_DIM : "#fff", fontFamily: F_BODY, fontSize: 13, whiteSpace: "nowrap" } }, busy ? "…" : text.trim() ? "发送" : watching ? "接着看" : "接着播"))));
  }

  // ── 礼物面板（她 2026-10-08：「礼物也是胶囊，而且不能自定义」）──────────
  //   照直播 app 真的礼物栏来：一格一样东西，上面一个小图、下面名字和价钱；点一格选中（抬起来、描红边），底下「送出」。
  //   最后一格「自定义」：自己起名字、定金额，勾「存成常用」就留在栏里（右上角 × 删掉）。
  const GIFT_ICON = {
    "小心心": c => h("path", { fill: c, d: "M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20z" }),
    "棒棒糖": c => [h("circle", { key: 1, cx: 12, cy: 9, r: 5.5 }), h("path", { key: 2, d: "M12 14.5V21M9 9a3 3 0 0 1 6 0" })],
    "玫瑰": c => [h("path", { key: 1, d: "M12 13c-3 0-5-2-5-5 2 0 3 .5 5 2 2-1.5 3-2 5-2 0 3-2 5-5 5zM12 13v8M12 17c-2 0-3-1-4-2" })],
    "告白气球": c => [h("path", { key: 1, d: "M12 3c3.3 0 5.5 2.6 5.5 5.6S15 15 12 15s-5.5-3.4-5.5-6.4S8.7 3 12 3z" }), h("path", { key: 2, d: "M12 15l-1 2h2l-1 2v2" })],
    "跑车": c => [h("path", { key: 1, d: "M3 15l2-4.5h9l4 3 3 .5v3H3z" }), h("circle", { key: 2, cx: 7, cy: 17.5, r: 1.8 }), h("circle", { key: 3, cx: 17, cy: 17.5, r: 1.8 })],
    "火箭": c => [h("path", { key: 1, d: "M12 3c3 2.5 4 6 4 10l-4 3-4-3c0-4 1-7.5 4-10zM8 13l-3 3 3 1M16 13l3 3-3 1M11 19.5l1 2 1-2" }), h("circle", { key: 2, cx: 12, cy: 9.5, r: 1.6 })]
  };
  const giftIcon = (name, c) => h(Svg, { size: 26, color: c, sw: 1.6 }, (GIFT_ICON[name] || (cc => [h("rect", { key: 1, x: 4, y: 9, width: 16, height: 11, rx: 1.5 }), h("path", { key: 2, d: "M3 9h18v-2.5H3zM12 6.5V20M12 6.5c-1.5-3-5-3-5-1s3 1 5 1c1.5-3 5-3 5-1s-3 1-5 1" })]))(c));
  function GiftPanel({ custom, busy, onSend, onSaveCustom, onDropCustom }) {
    const [pick, setPick] = useState(null);       // [名字, 金额]
    const [making, setMaking] = useState(false);
    const [nm, setNm] = useState(""), [amt, setAmt] = useState(""), [keep, setKeep] = useState(true);
    const all = GIFTS.concat(arr(custom).map(g => [g.name, g.amount, true]));
    const cell = (g, i) => { const on = pick && pick[0] === g[0] && pick[1] === g[1];
      return h("div", { "data-wk": "livegift", "data-on": on ? "1" : "0", key: g[0] + "_" + i, style: { position: "relative" } },
        h("button", { onClick: () => { setPick(g); setMaking(false); }, className: "w-full active:opacity-70 flex flex-col items-center",
          style: { padding: "8px 2px 6px", borderRadius: 12, minHeight: 74, border: "1px solid " + (on ? LIVE_RED : "transparent"), background: on ? "rgba(226,85,107,.14)" : "transparent", transform: on ? "translateY(-2px)" : "none" } },
          giftIcon(g[0], on ? LIVE_RED : "#f6c76b"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: LIVE_INK, marginTop: 4, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, g[0]),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: LIVE_DIM } }, "¥" + g[1])),
        g[2] ? h("button", { "data-wk": "livegiftdel", onClick: () => { onDropCustom(g[0], g[1]); if (on) setPick(null); }, "aria-label": "删掉这个礼物", className: "active:opacity-60", style: { position: "absolute", right: 0, top: 0, width: 26, height: 26, color: LIVE_DIM, fontSize: 13 } }, "×") : null); };
    const custOk = S(nm) && Number(amt) > 0;
    return h("div", { "data-wk": "livegiftpanel", style: { marginBottom: 8, padding: "8px 6px", borderRadius: 14, background: "rgba(255,255,255,.04)", border: "1px solid " + LIVE_LINE } },
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4, maxHeight: 156, overflowY: "auto" } },
        all.map(cell),
        h("button", { "data-wk": "livegiftmake", "data-on": making ? "1" : "0", key: "mk", onClick: () => { setMaking(m => !m); setPick(null); }, className: "active:opacity-70 flex flex-col items-center",
          style: { padding: "8px 2px 6px", borderRadius: 12, minHeight: 74, border: "1px dashed " + (making ? LIVE_RED : LIVE_LINE) } },
          h("span", { style: { fontSize: 22, lineHeight: "26px", color: LIVE_DIM } }, "＋"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: LIVE_INK, marginTop: 4 } }, "自定义"))),
      making ? h("div", { "data-wk": "livegiftform", className: "flex items-center", style: { gap: 6, marginTop: 8, flexWrap: "wrap" } },
        h("input", { "data-wk": "livegiftinput", "data-part": "name", value: nm, onChange: e => setNm(e.target.value), placeholder: "送什么", style: { flex: "1 1 90px", minWidth: 0, minHeight: 38, borderRadius: 10, border: "1px solid " + LIVE_LINE, background: "rgba(0,0,0,.3)", color: LIVE_INK, padding: "0 10px", fontFamily: F_BODY, fontSize: 16 } }),
        h("input", { "data-wk": "livegiftinput", "data-part": "amount", value: amt, onChange: e => setAmt(e.target.value.replace(/[^\d]/g, "").slice(0, 6)), inputMode: "numeric", placeholder: "多少钱", style: { width: 84, minHeight: 38, borderRadius: 10, border: "1px solid " + LIVE_LINE, background: "rgba(0,0,0,.3)", color: LIVE_INK, padding: "0 10px", fontFamily: F_BODY, fontSize: 16 } }),
        h("button", { "data-wk": "livegiftkeep", "data-on": keep ? "1" : "0", onClick: () => setKeep(k => !k), className: "active:opacity-60", style: { minHeight: 38, padding: "0 4px", color: keep ? LIVE_INK : LIVE_DIM, fontFamily: F_BODY, fontSize: 11.5 } }, (keep ? "☑" : "☐") + " 存成常用")) : null,
      h("div", { className: "flex items-center", style: { marginTop: 8, gap: 8 } },
        h("div", { className: "flex-1", style: { fontFamily: F_BODY, fontSize: 11.5, color: LIVE_DIM } }, making ? (custOk ? "「" + S(nm) + "」¥" + Number(amt) : "起个名字、填个金额") : pick ? "「" + pick[0] + "」¥" + pick[1] : "挑一样"),
        h("button", { "data-wk": "livegiftsend", disabled: !!busy || (making ? !custOk : !pick), onClick: () => {
            if (making) { const g = [S(nm).slice(0, 12), Math.min(999999, Math.round(Number(amt)))]; if (keep && onSaveCustom) onSaveCustom(g[0], g[1]); setNm(""); setAmt(""); setMaking(false); onSend(g[0], g[1]); return; }
            onSend(pick[0], pick[1]); },
          className: "active:opacity-70 shrink-0", style: { minHeight: 36, padding: "0 18px", borderRadius: 10, background: (busy || (making ? !custOk : !pick)) ? "rgba(255,255,255,.08)" : LIVE_RED, color: LIVE_INK, fontFamily: F_BODY, fontSize: 13 } }, "送出")));
  }

  // ── 跟路人主播的私信页（跟论坛私信一个样子：一来一回的气泡）──
  function StDmPage({ st, msgs, busy, t, title, onBack, onSend }) {
    const [text, setText] = useState("");
    const ref = useRef(null);
    useEffect(function () { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length, busy]);
    const send = () => { const v = text.trim(); if (!v || busy) return; setText(""); onSend(v); };
    return h("div", { "data-wk": "livestdm", className: "h-full flex flex-col", style: liveFloor(t) },
      h(Head, { zh: title, sub: "私信", bg: "transparent", ink: t.__pal ? t.ink : undefined, onBack }),
      h("div", { ref, className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingTop: 8, paddingBottom: 10 } },
        msgs.length ? msgs.map((m, i) => h("div", { key: i, className: "flex", style: { justifyContent: m.from === "me" ? "flex-end" : "flex-start", margin: "6px 0" } },
          h("div", { style: { maxWidth: "78%", padding: "9px 12px", borderRadius: 14, background: m.from === "me" ? LIVE_RED : t.bg2, color: m.from === "me" ? "#fff" : t.ink, border: m.from === "me" ? "none" : "1px solid " + t.line, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55 } }, m.text)))
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, textAlign: "center", padding: "40px 0" } }, "跟他说第一句"),
        busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, padding: "6px 0" } }, "对方正在输入…") : null),
      h("div", { className: "shrink-0 px-3 flex items-end", style: { gap: 8, paddingTop: 8, paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)", borderTop: "1px solid " + t.line } },
        h("textarea", { value: text, onChange: e => setText(e.target.value), rows: 1, placeholder: "发私信", className: "flex-1 outline-none resize-none", style: { minHeight: 42, maxHeight: 104, borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "11px 13px", fontFamily: F_BODY, fontSize: 16, lineHeight: 1.5 } }),
        h("button", { onClick: send, disabled: busy || !text.trim(), className: "active:opacity-70 shrink-0", style: { width: 56, height: 42, borderRadius: 12, background: busy || !text.trim() ? t.line : LIVE_RED, color: "#fff", fontFamily: F_BODY, fontSize: 13 } }, "发送")));
  }

  // ── 开播前那一页 ────────────────────────────────────────
  function Setup({ mode, characters, maskName, t, onStart, onBack }) {
    const watching = mode === "watch";
    const [pick, setPick] = useState(watching ? ((characters[0] || {}).id || null) : characters.slice(0, 3).map(c => c.id));
    const [kind, setKind] = useState(watching ? "free" : "chat");
    const [topic, setTopic] = useState("");
    const [title, setTitle] = useState("");
    const [as, setAs] = useState("me");
    const [rival, setRival] = useState(null);   // 看 TA 播时可以让TA跟另一个人连线 PK
    const toggle = id => setPick(p => watching ? id : (p.indexOf(id) >= 0 ? p.filter(x => x !== id) : p.concat([id]).slice(0, 5)));
    const on = id => watching ? pick === id : pick.indexOf(id) >= 0;
    const ok = watching ? !!pick : pick.length > 0;
    const label = s => h("div", { "data-wk": "livelabel", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, margin: "18px 0 8px" } }, s);
    const chip = (on2, txt, fn, key) => h("button", { "data-wk": "livechip", "data-on": on2 ? "1" : "0", key: key, onClick: fn, className: "active:opacity-60",
      style: { minHeight: 34, padding: "0 13px", borderRadius: 999, border: "1px solid " + (on2 ? t.ink : t.line), background: on2 ? t.ink : "transparent", color: on2 ? t.bg2 : t.sub, fontFamily: F_BODY, fontSize: 12.5 } }, txt);
    return h("div", { "data-wk": "livesetup", className: "h-full flex flex-col", style: liveFloor(t) },
      h(Head, { zh: watching ? "去看 TA 播" : "我来开播", onBack: onBack, bg: "transparent", ink: t.__pal ? t.ink : undefined }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
        label(watching ? "看谁播" : "谁在直播间里看着（最多五个）"),
        h("div", { "data-wk": "livecharlist", className: "flex flex-wrap", style: { gap: 12 } }, characters.map(c => h("button", { "data-wk": "livecharpick", "data-on": on(c.id) ? "1" : "0", key: c.id, onClick: () => toggle(c.id), className: "active:opacity-70 flex flex-col items-center", style: { width: 58, opacity: on(c.id) ? 1 : 0.45 } },
          h("div", { style: { borderRadius: 999, padding: 2, border: "2px solid " + (on(c.id) ? LIVE_RED : "transparent") } }, h(Avatar, { character: c, size: 46 })),
          h("div", { "data-wk": "livecharname", style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginTop: 4, maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name)))),
        label(watching ? "播什么" : "你播什么"),
        h("div", { className: "flex flex-wrap", style: { gap: 8 } }, (watching ? KINDS : HOST_KINDS).map(k => chip(kind === k[0], k[1], () => setKind(k[0]), k[0]))),
        !watching ? label("直播间标题") : null,
        !watching ? h("input", { "data-wk": "livefield", "data-part": "title", value: title, onChange: e => setTitle(e.target.value), placeholder: "不写也行", className: "w-full outline-none",
          style: { minHeight: 42, borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "0 13px", fontFamily: F_BODY, fontSize: 13.5 } }) : null,
        label(watching ? "想看什么（不写就随 TA）" : "这一场你打算干嘛（不写也行）"),
        h("textarea", { "data-wk": "livefield", "data-part": "topic", value: topic, onChange: e => setTopic(e.target.value), rows: 2, className: "w-full outline-none resize-none",
          style: { borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55 } }),
        watching ? label("用哪个号进去") : null,
        watching ? h("div", { className: "flex flex-wrap", style: { gap: 8 } },
          chip(as === "me", "自己的号（TA 知道是你）", () => setAs("me"), "me"),
          chip(as === "mask", "马甲「" + (maskName || "路过的") + "」（TA 不知道）", () => setAs("mask"), "mask")) : null,
        watching && characters.length > 1 ? label("跟谁连线 PK（不选就不 PK）") : null,
        watching && characters.length > 1 ? h("div", { className: "flex flex-wrap", style: { gap: 8 } },
          chip(!rival, "不 PK", () => setRival(null), "none"),
          characters.filter(c => c.id !== pick).map(c => chip(rival === c.id, c.remark || c.name, () => setRival(c.id), c.id))) : null,
        h("button", { "data-wk": "livestart", disabled: !ok, onClick: () => onStart({ mode, charId: watching ? pick : null, charIds: watching ? [pick] : pick, kind, topic: topic.trim(), title: title.trim(), as, maskName: maskName || "路过的", rivalId: watching && rival !== pick ? rival : null }),
          className: "w-full active:opacity-80", style: { marginTop: 26, minHeight: 48, borderRadius: 14, background: ok ? LIVE_RED : t.line, color: "#fff", fontFamily: F_BODY, fontSize: 14.5 } },
          watching ? "进直播间" : "开播")));
  }

  // ── 入口 ───────────────────────────────────────────────
  function LiveApp(props) {
    // 嵌在片刻里时跟着片刻那套皮走（她 2026-10-07：直播那一格还是米白底，跟黑底／白粉都不搭）
    const t0 = useTheme();
    const t = props.pal ? Object.assign({}, t0, props.pal, { __pal: true }) : t0;
    const { characters, profile, toast } = props;
    const [list, setList] = useState(load);
    const [view, setView] = useState(props.startView || "home");   // home | setup:watch | setup:host | room
    // 嵌在刷刷里当一格时（v74.99x）：落地页不摆返回键，底栏就是出口；从「＋ → 开播」进来直接落在开播那一页
    const [curId, setCurId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [shareTo, setShareTo] = useState(null);   // 发给谁：开过小房间的人，再挑主聊天还是哪一间
    const roomsOf = c => (window.ChatRooms && c ? window.ChatRooms.list(c.id).filter(r => r && !r.main) : []);
    const listRef = useRef(list); listRef.current = list;
    const uName = (profile && profile.name) || "我";
    const save = next => { const n = next.slice(0, CAP); listRef.current = n; setList(n); saveJSON(KEY, n); };
    const patch = (id, fn) => save(listRef.current.map(s => s.id === id ? fn(s) : s));
    const get = id => listRef.current.find(s => s.id === id);
    const charsOf = ses => (ses.charIds || [ses.charId]).map(id => characters.find(c => c.id === id)).filter(Boolean);
    const cur = curId ? list.find(s => s.id === curId) : null;
    // 路人主播
    const [stDb, setStDb] = useState(stLoad);
    const stRef = useRef(stDb); stRef.current = stDb;
    const stSave = n => { stRef.current = n; setStDb(n); saveJSON(ST_KEY, n); };
    const stGet = id => arr(stRef.current.list).find(x => x.id === id);
    const stPatch = (id, fn) => stSave(Object.assign({}, stRef.current, { list: arr(stRef.current.list).map(x => x.id === id ? fn(x) : x) }));
    const fanTotalOf = (charId, as, maskName) => listRef.current.filter(s => s.mode === "watch" && s.charId === charId && (s.as || "me") === (as || "me") && (as !== "mask" || s.maskName === maskName))
      .reduce((n, s) => n + arr(s.lines).filter(l => l.kind === "gift" && l.mine).reduce((m, l) => m + (Number(l.amount) || 0), 0), 0);

    // 一拍：看 TA 播
    const stepWatch = async (id, first) => {
      let ses = get(id);
      const st = ses && ses.stranger ? stGet(ses.charId) : null;
      const char = ses && (st ? { id: st.id, name: st.name } : characters.find(c => c.id === ses.charId));
      if (!ses || !char) return;
      // 突发：本地掷，这一拍才有；写进经过里，回放看得见
      if (!first && !ses.event && Math.random() < EVENT_P) {
        const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        patch(id, s => ({ ...s, event: ev, lines: arr(s.lines).concat([{ kind: "event", text: ev, ts: Date.now() }]).slice(-LINES_CAP) }));
        ses = get(id);
      }
      setBusy(true);
      try {
        const d = await (st
          ? props.probeStranger(st, tieBlock(st, tieKeyOf(ses.as, ses.maskName), ses.fanLv || 0, ses.fanTotal || 0) + "\n\n" + watchInstruction(ses, uName, first), watchShape(ses, first))
          : props.probeAs(char, watchInstruction(ses, uName, first), watchShape(ses, first))) || {};
        const regs = first ? arr(d.regulars).map(r => r && { name: S(r.name).slice(0, 20), who: S(r.who).slice(0, 80), lean: S(r.lean).slice(0, 80) }).filter(r => r && r.name).slice(0, 4) : ses.regulars;
        const hostName = first ? (st ? st.name : (S(d.host).slice(0, 20) || char.name)) : ses.host;
        const act = S(d.act).slice(0, 120);
        const regNames = arr(regs).map(r => r.name).filter(n => arr(ses.banned).indexOf(n) < 0);
        // 按先后排好的那条；模型没写 flow（照旧格式）就退回「主播的话在前、弹幕在后」
        let flowLines = arr(d.flow).map(x => x && { who: S(x.who), text: S(x.text).slice(0, 400) }).filter(x => x && x.text).map(x =>
          (x.who === "主播" || x.who === hostName) ? { kind: "host", name: hostName, text: x.text, act: "", ts: Date.now() }
            : regNames.indexOf(x.who) >= 0 ? { kind: "reg", name: x.who, text: x.text, ts: Date.now() }
            : ses.buddy && x.who === ses.buddy.name ? { kind: "char", name: x.who, text: x.text, ts: Date.now() } : null).filter(Boolean).slice(0, 16);
        if (!flowLines.length) flowLines = normLines(d.say).map(x => ({ kind: "host", name: hostName, text: x, act: "", ts: Date.now() }))
          .concat(normChat(d.chat, regNames).map(x => ({ kind: "reg", name: x.name, text: x.text, ts: Date.now() })));
        if (!flowLines.length) { toast("这一拍没播出来，再发一次试试"); return; }
        const firstHost = flowLines.find(l => l.kind === "host"); if (firstHost && act) firstHost.act = act;
        // 常客送的礼物：只上榜、不动谁的钱包（他们是这场里才有的人）
        const regGifts = arr(d.gifts).map(g => g && { name: S(g.name), gift: S(g.gift).slice(0, 20) || "礼物", amount: Math.max(0, Math.min(100000, Math.round(Number(g.amount) || 0))) })
          .filter(g => g && regNames.indexOf(g.name) >= 0 && g.amount > 0).slice(0, 4);
        const nm = ses.as === "mask" ? ses.maskName : uName;
        const rv = ses.rival && d.rival && typeof d.rival === "object" ? d.rival : null;
        const linkNow = ses.linkAsk && !ses.linked ? d.link === true : null;
        const item = ses.kind === "sell" && d.item && S(d.item.name) ? { name: S(d.item.name).slice(0, 40), price: Math.max(1, Math.min(100000, Math.round(Number(d.item.price) || 0))) } : null;
        const add = flowLines
          .concat(rv ? normLines(rv.say).slice(0, 4).map(x => ({ kind: "rival", name: ses.rival.host, text: x, ts: Date.now() })) : [])
          .concat(regGifts.map(g => ({ kind: "gift", name: g.name, gift: g.gift, amount: g.amount, ts: Date.now() })))
          .concat(linkNow === true ? [{ kind: "event", text: hostName + " 接了连麦，" + nm + " 上麦了", ts: Date.now() }] : linkNow === false ? [{ kind: "event", text: hostName + " 没接 " + nm + " 的连麦", ts: Date.now() }] : [])
          .concat(!ses.mod && d.mod === true ? [{ kind: "event", text: hostName + " 把 " + nm + " 设成了房管", ts: Date.now() }] : []);
        const newClub = first && ses.needClub ? normClub(d.club) : null;
        if (newClub && props.onLiveCfg) { const c0 = props.liveCfg || {}; props.onLiveCfg(Object.assign({}, c0, { clubs: Object.assign({}, c0.clubs, { [ses.charId]: newClub }) })); }
        patch(id, s => ({ ...s, club: newClub || s.club, needClub: false,
          board: regGifts.reduce((b, g) => Object.assign({}, b, { [g.name]: (b[g.name] || 0) + g.amount }), s.board || {}),
          rivalScore: (s.rivalScore || 0) + (rv ? Math.max(0, Math.min(100000, Math.round(Number(rv.gift) || 0))) : 0),
          linked: linkNow === true ? true : s.linked, linkAsk: linkNow === null ? s.linkAsk : false,
          mod: s.mod || d.mod === true, item: item || s.item, event: "", song: "",
          title: first ? (S(d.title).slice(0, 40) || s.title || char.name + "的直播间") : s.title,
          host: hostName, scene: S(d.scene) ? S(d.scene).slice(0, 200) : s.scene, regulars: regs,
          act: act || s.act || "", beat: (s.beat || 0) + 1,
          lines: arr(s.lines).concat(add.map(l => Object.assign({}, l, { beat: (s.beat || 0) + 1 }))).slice(-LINES_CAP),
          noise: normNoise(d.noise), noiseSeed: (s.noiseSeed || 0) + 1,
          viewers: Math.max(1, Math.round(Number(d.viewers) || s.viewers || 1)),
          endTs: (!first && d.end === true) ? Date.now() : s.endTs }));
        if (!first && d.end === true) wrapUp(id);
      } catch (e) { toast("直播间没连上：" + ((e && e.message) || "再试一次")); }
      finally { setBusy(false); }
    };
    // 一拍：我来播
    const stepHost = async (id, first) => {
      const ses = get(id); if (!ses) return;
      const chars = charsOf(ses); if (!chars.length) return;
      setBusy(true);
      try {
        const d = await props.probeMany(chars, hostInstruction(ses, uName, chars, chars.map(props.briefFor), first), HOST_SHAPE) || {};
        const names = chars.map(c => c.name);
        const chat = normChat(d.chat, names);
        const gifts = arr(d.gifts).map(g => g && { name: S(g.name), gift: S(g.gift).slice(0, 20) || "礼物", amount: Math.max(0, Math.min(100000, Math.round(Number(g.amount) || 0))) })
          .filter(g => g && names.indexOf(g.name) >= 0 && g.amount > 0).slice(0, 5);
        const priv = normChat(d.private, names).slice(0, 5);
        const add = chat.map(x => ({ kind: "char", name: x.name, text: x.text, ts: Date.now() }))
          .concat(gifts.map(g => ({ kind: "gift", name: g.name, gift: g.gift, amount: g.amount, ts: Date.now() })))
          .concat(priv.map(x => ({ kind: "private", name: x.name, text: x.text, ts: Date.now() })));
        gifts.forEach(g => {
          props.pay(toHost(g.amount), "直播收到打赏 · " + g.name + " 的「" + g.gift + "」（平台抽走一半）");
          // 送礼的钱是从TA自己钱包里出的（v75.010 补上：原来只进了她的钱包，TA那边没扣）
          const gc = chars.find(c => c.name === g.name);
          if (gc && props.charPay) props.charPay(gc.id, -g.amount, "直播打赏 · 送了「" + g.gift + "」");
        });
        priv.forEach(x => { const c = chars.find(cc => cc.name === x.name); if (c) props.onPrivate(c.id, x.text); });
        patch(id, s => ({ ...s, lines: arr(s.lines).concat(add).slice(-LINES_CAP), noise: normNoise(d.noise), noiseSeed: (s.noiseSeed || 0) + 1,
          viewers: Math.max(1, Math.round(Number(d.viewers) || s.viewers || 1)) }));
      } catch (e) { toast("直播间没连上：" + ((e && e.message) || "再试一次")); }
      finally { setBusy(false); }
    };
    // 下播：记一条事实进记忆库（不额外调模型）
    const wrapUp = id => {
      const s = get(id); if (!s) return;
      // 路人主播：给他记一笔「这个号来过」，不进角色记忆库（他不是你的角色）
      if (s.stranger) {
        const key = tieKeyOf(s.as, s.maskName);
        const mineL = arr(s.lines).filter(l => l.kind === "me");
        const spent = arr(s.lines).filter(l => l.kind === "gift" && l.mine).reduce((n, l) => n + (Number(l.amount) || 0), 0);
        const d0 = new Date(s.startTs || Date.now());
        const noteTx = (d0.getMonth() + 1) + "月" + d0.getDate() + "日那场《" + (s.title || "") + "》" + (mineL.length ? "发了 " + mineL.length + " 条弹幕，说过「" + S(mineL[mineL.length - 1].text).slice(0, 40) + "」" : "一直在看没说话")
          + (spent ? "，打赏了 " + spent + " 元" : "") + (arr(s.lines).some(l => l.kind === "me" && l.linked) ? "，还跟你连过麦" : "") + (s.mod ? "，你让这个号当了房管" : "") + "。";
        if (s.buddy) {
          const bl = arr(s.lines).filter(l => l.kind === "char" && l.name === s.buddy.name).slice(-1)[0];
          props.remember([s.buddy.charId], (s.as === "mask" ? uName + "挂着马甲「" + s.maskName + "」" : uName) + "叫你一起去看了路人主播「" + (s.host || "") + "」的直播《" + (s.title || "") + "》" + (bl ? "，你在弹幕里说过「" + S(bl.text).slice(0, 50) + "」" : "") + "。");
        }
        stPatch(s.charId, x => { const t = Object.assign({ visits: 0, notes: [] }, (x.ties || {})[key]); return Object.assign({}, x, { lastSeen: Date.now(), ties: Object.assign({}, x.ties, { [key]: Object.assign({}, t, { visits: (t.visits || 0) + 1, notes: arr(t.notes).concat([noteTx]).slice(-20) }) }) }); });
        return;
      }
      const chars = charsOf(s); if (!chars.length) return;
      const mine = arr(s.lines).filter(l => l.kind === "me").length;
      const spent = arr(s.lines).filter(l => l.kind === "gift" && l.mine).reduce((n, l) => n + (Number(l.amount) || 0), 0);
      let text;
      if (s.mode === "watch") {
        const c = chars[0];
        text = s.as === "mask"
          ? c.name + "开了一场直播《" + (s.title || "") + "》。直播间里有个叫「" + s.maskName + "」的观众" + (mine ? "发了 " + mine + " 条弹幕" : "一直在看") + (spent ? "，还打赏了 " + spent + " 元" : "") + "。" + c.name + "不知道那是谁。"
          : c.name + "开了一场直播《" + (s.title || "") + "》，" + uName + "用自己的号来看了" + (mine ? "，发了 " + mine + " 条弹幕" : "") + (spent ? "，打赏了 " + spent + " 元" : "") + "。";
        if (s.linked || arr(s.lines).some(l => l.kind === "me" && l.linked)) text += (s.as === "mask" ? "那个观众还跟" + c.name + "连了麦。" : uName + "还跟" + c.name + "连了麦，当着观众说了话。");
        if (s.rival) text += "这一场" + c.name + "跟「" + s.rival.host + "」连线 PK 了。";
        if (s.mod && s.as !== "mask") text += c.name + "让" + uName + "当了直播间的房管。";
        props.remember([c.id], text);
        if (s.rival) props.remember([s.rival.charId], s.rival.host + "跟" + (s.host || c.name) + "（" + c.name + "）连线 PK 了一场直播。");
        // 切片（她 2026-10-08）：路人把这场剪成一条视频发到片刻，原话照搬，不花调用
        const said = arr(s.lines).filter(l => l.kind === "host").map(l => l.text);
        if (said.length >= 4 && props.onClip) {
          const pick = Array.from(new Set(said)).slice(Math.max(0, Math.floor(new Set(said).size / 2) - 1)).slice(0, 3);
          const clipper = (arr(s.regulars)[0] || {}).name || "路过的切片君";
          props.onClip({ scene: "直播切片：" + (s.host || c.name) + "在直播间里说「" + pick.join("」「") + "」", caption: "《" + (s.title || "") + "》名场面", tags: ["直播切片", s.host || c.name], author: clipper + "的切片", charId: c.id });
        }
      } else {
        const said = arr(s.lines).filter(l => l.kind === "char");
        chars.forEach(c => {
          const own = said.filter(l => l.name === c.name).slice(-1)[0];
          props.remember([c.id], uName + "开了一场直播" + (s.title ? "《" + s.title + "》" : "") + "，" + c.name + "在直播间里看着" + (own ? "，在弹幕里说过「" + own.text.slice(0, 60) + "」" : "") + "。");
        });
      }
    };

    const start = cfg => {
      const ses = { id: uid("live"), mode: cfg.mode, charId: cfg.charId, charIds: cfg.charIds, stranger: !!cfg.stranger, kind: cfg.kind, topic: cfg.topic, title: cfg.title,
        as: cfg.as, maskName: cfg.maskName, lines: [], noise: [], viewers: 0, startTs: Date.now(), endTs: 0, board: {}, slotId: cfg.slotId || "", midway: cfg.midway || 0 };
      if (cfg.mode === "watch") {
        ses.fanTotal = fanTotalOf(cfg.charId, cfg.as, cfg.maskName); ses.fanLv = fanLevel(ses.fanTotal);
        const stC = cfg.stranger ? stGet(cfg.charId) : null;
        ses.club = stC ? (stC.club || null) : ((((props.liveCfg || {}).clubs) || {})[cfg.charId] || null);
        if (!ses.club && !cfg.stranger) ses.needClub = true;
        const rc = cfg.rivalId ? characters.find(c => c.id === cfg.rivalId) : null;
        if (rc && rc.id !== cfg.charId) ses.rival = { charId: rc.id, host: rc.name, brief: "【" + rc.name + "】" + (typeof groupPersonaText === "function" ? groupPersonaText(rc.persona, 3000) : String(rc.persona || "").slice(0, 3000)) };
        // ⚠️不用 briefFor：那份里有「你自己住在…」这种写给本人看的第二人称，主播读到会当成在说自己
      }
      if (cfg.mode === "watch") ses.lines.push({ kind: "enter", text: (cfg.as === "mask" ? cfg.maskName : uName) + " 进入了直播间", ts: Date.now() });
      save([ses].concat(listRef.current));
      setCurId(ses.id); setView("room");
      if (cfg.mode === "watch") stepWatch(ses.id, true); else stepHost(ses.id, true);
    };
    const say = v => {
      const s = get(curId); if (!s) return;
      if (!v) { if (s.mode === "watch") stepWatch(curId, false); else stepHost(curId, false); return; }
      const name = s.mode === "watch" ? (s.as === "mask" ? s.maskName : uName) : uName;
      patch(curId, x => ({ ...x, lines: arr(x.lines).concat([{ kind: "me", name, text: v, linked: !!x.linked, ts: Date.now() }]).slice(-LINES_CAP) }));
      if (s.mode === "watch") stepWatch(curId, false); else stepHost(curId, false);
    };
    // 看 TA 播时的几样动作：都只是给下一拍添一件事实，下一拍跟着她下一句（或这一下）一起走
    const addEvent = (fn, text, go) => { patch(curId, x => Object.assign({}, fn(x), { lines: arr(x.lines).concat([{ kind: "event", text, ts: Date.now() }]).slice(-LINES_CAP) })); if (go) stepWatch(curId, false); };
    const askLink = () => { const s = get(curId); if (!s || s.linked || s.linkAsk) return; addEvent(x => ({ ...x, linkAsk: true }), (s.as === "mask" ? s.maskName : uName) + " 申请了连麦", true); };
    const meName = () => { const s = get(curId) || {}; return s.as === "mask" ? s.maskName : uName; };
    const unlink = () => addEvent(x => ({ ...x, linked: false, linkAsk: false }), meName() + " 下麦了", false);
    const ban = n => addEvent(x => ({ ...x, banned: arr(x.banned).concat([n]) }), n + " 被房管禁言了", false);
    const invite = c => { const s = get(curId); if (!s || s.buddy || !c) return; addEvent(x => ({ ...x, buddy: { charId: c.id, name: c.name, brief: "【" + c.name + "】" + (typeof groupPersonaText === "function" ? groupPersonaText(c.persona, 2000) : String(c.persona || "").slice(0, 2000)) } }), c.name + " 跟着 " + meName() + " 进了直播间", true); };
    const pickSong = t2 => addEvent(x => ({ ...x, song: t2 }), (get(curId).as === "mask" ? get(curId).maskName : uName) + " 点了一首《" + t2 + "》", true);
    const buy = item => {
      const s = get(curId); if (!s || !item || !props.buy) return;
      if (typeof props.wallet === "number" && props.wallet < item.price) { toast("钱包余额不够"); return; }
      props.buy(item, s.host || "主播");
      addEvent(x => x, meName() + " 在直播间下单了「" + item.name + "」", false);
    };
    const gift = (g, amount) => {
      const s = get(curId); if (!s) return;
      if (typeof props.wallet === "number" && props.wallet < amount) { toast("钱包余额不够"); return; }
      const name = s.as === "mask" ? s.maskName : uName;
      props.pay(-amount, "直播打赏 · " + (s.host || "主播") + "「" + g + "」");
      // 主播只到手一半（平台抽成）
      if (props.charPay && s.charId && !s.stranger) props.charPay(s.charId, toHost(amount), "直播收到打赏 · 「" + g + "」（平台抽走一半）");
      const before = fanLevel(s.fanTotal || 0), total = (s.fanTotal || 0) + amount, after = fanLevel(total);
      patch(curId, x => ({ ...x, fanTotal: total, fanLv: after, board: Object.assign({}, x.board, { [name]: ((x.board || {})[name] || 0) + amount }),
        lines: arr(x.lines).concat([{ kind: "gift", mine: true, name, gift: g, amount, ts: Date.now() }])
          .concat(after > before ? [{ kind: "event", text: name + " 的" + (x.club ? "粉丝团" : "") + clubText(x.club, after) + "（升级了）", ts: Date.now() }] : []).slice(-LINES_CAP) }));
      stepWatch(curId, false);
    };
    const end = () => {
      const s = get(curId); if (!s || s.endTs) return;
      patch(curId, x => ({ ...x, endTs: Date.now(), linked: false, linkAsk: false }));
      wrapUp(curId);
      toast(s.mode === "watch" ? "离开了直播间" : "下播了");
    };

    // ── 路人主播的几样动作 ──
    const [stBusy, setStBusy] = useState("");
    const browse = async () => {
      if (!props.askStranger || stBusy) return;
      setStBusy("browse");
      try {
        const d0 = new Date();
        const kinds = Array.from({ length: ST_BATCH }, () => pick(SLOT_KINDS.concat(["spicy"])));
        const r = await props.askStranger(strangerSystem(ST_BATCH, props.hot ? props.hot() : [], d0.getFullYear() + " 年 " + (d0.getMonth() + 1) + " 月 " + d0.getDate() + " 日", kinds), ST_SHAPE);
        const fresh = arr(r && r.streamers).slice(0, ST_BATCH).map((x, i) => x && S(x.name) && S(x.persona) ? Object.assign({}, x, { kind: kinds[i] }) : null).filter(Boolean).map(x => {
          return { id: uid("st"), name: S(x.name).slice(0, 20), title: S(x.title).slice(0, 40), bio: S(x.bio).slice(0, 80), persona: S(x.persona).slice(0, 1200), look: S(x.look).slice(0, 120),
            fans: Math.max(0, Math.round(Number(x.fans) || 0)), viewers: Math.max(1, Math.round(Number(x.viewers) || 1)), kind: KINDS.some(k => k[0] === x.kind) ? x.kind : "free",
            values: ["money", "familiar", "both"].indexOf(x.values) >= 0 ? x.values : "both", club: normClub(x.club), ts: Date.now(), liveUntil: Date.now() + (90 + Math.floor(Math.random() * 90)) * 60000, followed: false, ties: {} };
        });
        if (!fresh.length) { toast("这一批没刷出来，再点一次"); return; }
        // 没关注的那批换掉，关注过的、加成好友的留着
        stSave(Object.assign({}, stRef.current, { list: fresh.concat(arr(stRef.current.list).filter(x => x.followed || x.promoted)) }));
      } catch (e) { toast("没刷出来：" + ((e && e.message) || "再试一次")); }
      finally { setStBusy(""); }
    };
    const follow = st => {
      if (!st.followed && arr(stRef.current.list).filter(x => x.followed).length >= ST_FOLLOW_MAX) { toast("最多关注 " + ST_FOLLOW_MAX + " 个，先取关一个"); return; }
      stPatch(st.id, x => Object.assign({}, x, { followed: !x.followed }));
    };
    const enterSt = (st, as) => start({ mode: "watch", charId: st.id, charIds: [st.id], stranger: true, kind: st.kind || "free", topic: "", title: st.title || "", as, maskName: props.maskName || "路过的", slotId: "", midway: 0 });
    const stFan = (st, key) => { const total = listRef.current.filter(s2 => s2.stranger && s2.charId === st.id && tieKeyOf(s2.as, s2.maskName) === key).reduce((n, s2) => n + arr(s2.lines).filter(l => l.kind === "gift" && l.mine).reduce((m, l) => m + (Number(l.amount) || 0), 0), 0); return { total, lv: fanLevel(total) }; };
    // 错过的那一场：剪一份高光，存成一场已经下播的回放（recap），点开就是回放间
    const [recapBusy, setRecapBusy] = useState("");
    const recap = async x => {
      if (recapBusy) return;
      const c = characters.find(cc => cc.id === x.charId), st = c ? null : stGet(x.charId);
      if (!c && !st) return;
      setRecapBusy(x.id);
      try {
        const ins = recapInstruction(x, uName);
        const d = await (st ? props.probeStranger(st, tieBlock(st, "me", stFan(st, "me").lv, stFan(st, "me").total) + "\n\n" + ins, RECAP_SHAPE) : props.probeAs(c, ins, RECAP_SHAPE)) || {};
        const host = st ? st.name : (S(d.host).slice(0, 20) || c.name);
        const lines = arr(d.flow).map(y => y && { who: S(y.who).slice(0, 20), text: S(y.text).slice(0, 400) }).filter(y => y && y.text && y.who).slice(0, 16)
          .map(y => (y.who === "主播" || y.who === host) ? { kind: "host", name: host, text: y.text, act: "", ts: x.start } : { kind: "reg", name: y.who, text: y.text, ts: x.start });
        if (!lines.length) { toast("高光没剪出来，再点一次试试"); return; }
        const ses = { id: uid("live"), mode: "watch", charId: x.charId, charIds: [x.charId], stranger: !!st, kind: x.kind, topic: "", title: S(d.title).slice(0, 40) || host + "的直播间",
          host, scene: S(d.scene).slice(0, 200), lines, noise: normNoise(d.noise), viewers: Math.max(1, Math.round(Number(d.viewers) || 1)), startTs: x.start, endTs: x.end, board: {}, slotId: x.id, recap: true, regulars: [] };
        save([ses].concat(listRef.current));
        setCurId(ses.id); setView("room");
      } catch (e) { toast("高光没剪出来：" + ((e && e.message) || "再试一次")); }
      finally { setRecapBusy(""); }
    };
    const sendDm = async (st, key, text) => {
      const t0 = Object.assign({ visits: 0, notes: [] }, (st.ties || {})[key]);
      const msgs = arr(((st.dms || {})[key])).concat([{ from: "me", text, ts: Date.now() }]);
      stPatch(st.id, x => Object.assign({}, x, { dms: Object.assign({}, x.dms, { [key]: msgs }) }));
      setStBusy("dm");
      try {
        const fan = stFan(st, key);
        const nm = key === "me" ? uName : key.slice(5);
        const d = await props.probeStranger(st, tieBlock(st, key, fan.lv, fan.total)
          + "\n\n【这一轮发生在直播平台的私信里】你的观众「" + nm + "」私信了你。这是打字，不是当面：只有你打出去的那几行字，别写动作。"
          + "\n这是你们在私信里说过的：\n" + msgs.slice(-30).map(m => (m.from === "me" ? nm : "你") + "：" + m.text).join("\n") + "\n\n回最新这句（1~3 条，一条一个气泡）。回不回、回多热络，照你这个人和你们的交情来。", '{"say":["气泡1"]}');
        const say = (Array.isArray(d && d.say) ? d.say : (d && d.say ? [d.say] : [])).map(S).filter(Boolean).slice(0, 4);
        if (say.length) stPatch(st.id, x => Object.assign({}, x, { dms: Object.assign({}, x.dms, { [key]: arr((x.dms || {})[key]).concat(say.map((y, i) => ({ from: "st", text: y.slice(0, 400), ts: Date.now() + i }))) }) }));
      } catch (e) { toast("没回上：" + ((e && e.message) || "再试一次")); }
      finally { setStBusy(""); }
    };
    // 申请加好友：他照人设和交情决定；被拒了三天后、或者粉丝团又升了一级才能再申请
    const askFriend = async (st, key) => {
      const fan = stFan(st, key);
      const myLv = stLevel(stExp(((st.ties || {})[key] || {}).visits, fan.total));
      if (myLv < ST_FRIEND_LV) { toast(ST_FRIEND_LV + " 级才能申请加好友"); return; }
      const prev = ((st.friendAsk || {})[key]) || null;
      if (prev && !prev.ok && Date.now() - prev.ts < 3 * 86400000 && myLv <= (prev.lv || 0)) { toast("他刚拒过，三天后或者再升一级再试"); return; }
      const nm = key === "me" ? uName : key.slice(5);
      setStBusy("friend");
      try {
        const d = await props.probeStranger(st, tieBlock(st, key, fan.lv, fan.total)
          + "\n\n【这一轮】你的观众「" + nm + "」申请加你的私人好友——加了以后你们就不只是主播和观众，是能私下随时联系的人。"
          + (arr((st.dms || {})[key]).length ? "\n你们私信里聊过的：\n" + arr((st.dms || {})[key]).slice(-16).map(m => (m.from === "me" ? nm : "你") + "：" + m.text).join("\n") : "")
          + "\n" + (VALUES_ZH[st.values] || VALUES_ZH.both) + "。同不同意照你这个人和你对这个号的印象来，不是到了等级就一定答应。写 accept（true/false）和 say（你回她的那一句，私信里打的字）。", '{"accept":false,"say":""}');
        const ok = !!(d && d.accept === true);
        const say = S(d && d.say).slice(0, 300);
        stPatch(st.id, x => Object.assign({}, x, { friendAsk: Object.assign({}, x.friendAsk, { [key]: { ts: Date.now(), lv: myLv, ok } }),
          dms: Object.assign({}, x.dms, { [key]: arr((x.dms || {})[key]).concat([{ from: "me", text: "（申请加你好友）", ts: Date.now() }]).concat(say ? [{ from: "st", text: say, ts: Date.now() + 1 }] : []) }) }));
        if (ok && props.promoteStranger) {
          const cid = props.promoteStranger(stGet(st.id), key, nm, fan);
          stPatch(st.id, x => Object.assign({}, x, { promoted: cid || true, followed: true }));
        } else if (!ok) toast("他没同意");
      } catch (e) { toast("没问成：" + ((e && e.message) || "再试一次")); }
      finally { setStBusy(""); }
    };
    const askDropSt = st => { const go = () => { dropSt(st); setView("home"); };
      if (props.confirm) props.confirm("不要这个主播了？", "跟他的交情和私信一起不要了。", go); else go(); };
    const rerollClub = async st => {
      if (!props.askStranger || stBusy) return;
      setStBusy("club");
      try {
        const d = await props.askStranger("你是直播平台上的主播「" + st.name + "」。" + (st.bio ? "主页简介：" + st.bio + "。" : "") + "\n" + st.persona
          + "\n\n给你的粉丝团重新起名" + (st.club ? "（原来叫「" + st.club.name + "」，换一个不一样的）" : "") + "：" + CLUB_ASK + "。", "{" + CLUB_SHAPE + "}");
        const c = normClub(d && d.club);
        if (!c) { toast("这次没起出来，再点一次"); return; }
        stPatch(st.id, x => Object.assign({}, x, { club: c }));
      } catch (e) { toast("没起成：" + ((e && e.message) || "再试一次")); }
      finally { setStBusy(""); }
    };
    const dropSt = st => stSave(Object.assign({}, stRef.current, { list: arr(stRef.current.list).filter(x => x.id !== st.id) }));

    if (view === "setup:watch" || view === "setup:host")
      return h(Setup, { mode: view === "setup:watch" ? "watch" : "host", characters, maskName: props.maskName, t, onStart: start, onBack: () => setView("home") });
    if (view === "room" && cur)
      return h(LiveRoom, { ses: cur, chars: characters, profile, busy, onSay: say, onGift: gift, onEnd: end,
        customGifts: (props.liveCfg || {}).gifts || [],
        autoSec: (props.liveCfg || {}).autoSec || 25,
        onAutoSec: n => { if (props.onLiveCfg) props.onLiveCfg(Object.assign({}, props.liveCfg || {}, { autoSec: n })); },
        onSaveCustom: (n, a) => { const c0 = props.liveCfg || {}; if (props.onLiveCfg) props.onLiveCfg(Object.assign({}, c0, { gifts: arr(c0.gifts).filter(g => !(g.name === n && g.amount === a)).concat([{ name: n, amount: a }]).slice(-12) })); },
        onDropCustom: (n, a) => { const c0 = props.liveCfg || {}; if (props.onLiveCfg) props.onLiveCfg(Object.assign({}, c0, { gifts: arr(c0.gifts).filter(g => !(g.name === n && g.amount === a)) })); },
        onInvite: cur.stranger ? invite : null, onLink: askLink, onUnlink: unlink, onBan: ban, onSong: props.songs ? pickSong : null, songs: props.songs ? props.songs() : [], onBuy: props.buy ? buy : null, onBack: () => { setView("home"); setCurId(null); },
        onShare: props.onShare ? () => setView("share") : null });
    // 发给 TA：挑一个人。落进聊天的是一张回放卡，不让TA马上开口（等她说完按回复，wait-for-her）
    if (view === "share" && cur)
      return h("div", { "data-wk": "liveshareview", className: "h-full flex flex-col", style: liveFloor(t) },
        h(Head, { zh: "发给谁", sub: S(cur.title) || "直播回放", bg: "transparent", ink: t.__pal ? t.ink : undefined, onBack: () => { if (shareTo) setShareTo(null); else setView("room"); } }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
          shareTo ? h("div", { style: { marginTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 8 } }, "发到 " + shareTo.name + " 的哪儿"),
            [{ id: "main", name: "主聊天" }].concat(roomsOf(shareTo)).map(r => h("button", { "data-wk": "livesharerow", key: r.id, onClick: () => { props.onShare(cur, shareTo, r.id); setShareTo(null); setView("room"); },
              className: "w-full text-left active:opacity-70", style: { minHeight: 46, padding: "0 14px", marginBottom: 8, borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 14 } },
              r.id === "main" ? "主聊天" : "小房间「" + (r.name || "没起名的房间") + "」"))) :
          h("div", { "data-wk": "livesharelist", className: "flex flex-wrap", style: { gap: 14, marginTop: 12 } }, characters.map(c => h("button", { "data-wk": "livesharechar", key: c.id, onClick: () => { if (roomsOf(c).length) { setShareTo(c); return; } props.onShare(cur, c, "main"); setView("room"); },
            className: "active:opacity-70 flex flex-col items-center", style: { width: 60 } },
            h(Avatar, { character: c, size: 48 }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginTop: 4, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name))))));

    // 落地页：两扇门 + 回放
    const door = (title, sub, fn) => h("button", { "data-wk": "livedoor", onClick: fn, className: "w-full text-left active:opacity-80",
      style: { position: "relative", borderRadius: 18, padding: "18px 18px", minHeight: 96, overflow: "hidden", background: "radial-gradient(130% 120% at 0% 0%,rgba(226,85,107,.85),rgba(70,50,110,.95))", color: "#fff" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, opacity: .85 } }, h(GlyphDot), "直播"),
      h("div", { "data-wk": "livedoortitle", style: { fontFamily: F_DISPLAY, fontSize: 19, marginTop: 6 } }, title),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, opacity: .85, marginTop: 4, lineHeight: 1.5 } }, sub));
    const nameOf = s => s.mode === "watch" ? ((characters.find(c => c.id === s.charId) || {}).name || s.host || "") : uName;
    const cfg = props.liveCfg || {};
    const now = Date.now();
    const followedSt = arr(stDb.list).filter(x => x.followed && !x.promoted);
    const slots = cfg.selfLive === false ? [] : slotsOf(characters.concat(followedSt), new Date(), c => followedSt.some(x => x.id === c.id) ? null : (props.liveSched ? props.liveSched(c) : null));
    const whoOf = id => characters.find(cc => cc.id === id) || followedSt.find(x => x.id === id) || null;
    const stFace = (st, size) => h("div", { style: { width: size, height: size, borderRadius: 999, flexShrink: 0, background: "linear-gradient(135deg," + LIVE_RED + ",#6a4fb0)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: size * 0.42 } }, S(st.name).slice(0, 1));
    const onAir = slots.filter(x => x.start <= now && now < x.end), later = slots.filter(x => x.start > now);
    // 本周礼物榜（她 2026-10-08）：本机按回放里这七天收到的礼物加一加，谁收得多谁在前；不花调用
    const weekRank = (() => {
      const since = now - 7 * 86400000, n = {}, mine = {};
      list.filter(s2 => s2.mode === "watch" && (s2.startTs || 0) >= since && whoOf(s2.charId)).forEach(s2 => arr(s2.lines).filter(l => l.kind === "gift").forEach(l => {
        n[s2.charId] = (n[s2.charId] || 0) + (Number(l.amount) || 0);
        if (l.mine) mine[s2.charId] = (mine[s2.charId] || 0) + (Number(l.amount) || 0);
      }));
      return Object.keys(n).filter(k => n[k] > 0).sort((a, b) => n[b] - n[a]).slice(0, 5).map(k => ({ id: k, total: n[k], mine: mine[k] || 0 }));
    })();
    // 错过的：今天已经播完的 + 昨天那场（昨天也先看昨天那张日程，没排日程才按日子算），她没进去过、也还没剪过高光的
    const missed = cfg.selfLive === false ? [] : slots.concat(slotsOf(characters.concat(followedSt), new Date(now - 86400000), c => followedSt.some(x => x.id === c.id) ? null : (props.liveSched ? props.liveSched(c, new Date(now - 86400000)) : null)))
      .filter(x => x.end <= now && now - x.end < 36 * 3600000 && whoOf(x.charId) && !list.some(s2 => s2.slotId === x.id));
    const hm = ts => { const d = new Date(ts); return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"); };
    // 点进 TA 正在播的那一场：中途进场，前面播了多久写进去；同一场进过就接着那一场
    const joinSlot = (x, as) => {
      const had = listRef.current.find(s2 => s2.slotId === x.id && !s2.endTs);
      if (had) { setCurId(had.id); setView("room"); return; }
      start({ mode: "watch", charId: x.charId, charIds: [x.charId], stranger: !characters.some(c => c.id === x.charId), kind: x.kind, topic: "", title: "", as, maskName: props.maskName || "路过的", slotId: x.id, midway: Math.max(1, Math.round((Date.now() - x.start) / 60000)) });
    };
    // ── 路人主播的主页 ──
    if (view.indexOf("st:") === 0) {
      const st = stGet(view.slice(3));
      if (!st) { setTimeout(() => setView("home"), 0); return null; }
      // 刷到的那一场播到 liveUntil 为止（关不关注都不影响）；之后按日子算的开播时间
      const onAirNow = Date.now() < (st.liveUntil || 0) || slots.some(x => x.charId === st.id && x.start <= Date.now() && Date.now() < x.end);
      const nextSlot = slots.find(x => x.charId === st.id && x.start > Date.now());
      const keys = ["me"].concat(props.maskName ? ["mask:" + props.maskName] : []);
      const row = (k) => {
        const tie = (st.ties || {})[k] || {}, fan = stFan(st, k), visits = tie.visits || 0;
        const exp = stExp(visits, fan.total), lv = stLevel(exp);
        const dmOk = lv >= ST_DM_LV, frOk = lv >= ST_FRIEND_LV;
        const asked = (st.friendAsk || {})[k];
        const btn = (txt, on, fn, key) => h("button", { key, "data-wk": "livestbtn", onClick: fn, disabled: !on || !!stBusy, className: "active:opacity-70", style: { minHeight: 36, padding: "0 14px", borderRadius: 10, background: on ? LIVE_RED : "transparent", border: "1px solid " + (on ? LIVE_RED : t.line), color: on ? "#fff" : t.fog, fontFamily: F_BODY, fontSize: 12.5, opacity: stBusy ? .6 : 1 } }, txt);
        return h("div", { key: k, "data-wk": "livesttie", style: { marginTop: 12, padding: "12px 14px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2 } },
          h("div", { className: "flex items-center", style: { gap: 6 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink } }, k === "me" ? "用自己的号" : "用马甲「" + k.slice(5) + "」"),
            // 等级：名字旁边一个小数字（像抖音）
            h("span", { "data-wk": "livestlv", style: { fontFamily: F_BODY, fontSize: 10, color: "#fff", background: "linear-gradient(90deg,#6a8cff,#9a6bff)", borderRadius: 4, padding: "0 5px", lineHeight: "16px" } }, "Lv" + lv)),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3, lineHeight: 1.6 } }, (stNext(exp) ? exp + "/" + stNext(exp) + " 经验" : "满级") + " · 来过 " + visits + " 场 · 打赏过 ¥" + fan.total),
          // 粉丝团：展开写团名和这一级叫什么
          h("div", { "data-wk": "livestclub", style: { fontFamily: F_BODY, fontSize: 11.5, color: "#c98a1a", marginTop: 3, lineHeight: 1.6 } }, fan.lv ? clubText(st.club, fan.lv) + (fanNext(fan.total) ? "（再 ¥" + (fanNext(fan.total) - fan.total) + " 升级）" : "") : (st.club ? "还没进「" + st.club.name + "」，打赏 ¥1 就进团" : "还没进粉丝团，打赏 ¥1 就进团")),
          arr(tie.notes).length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginTop: 6, lineHeight: 1.6 } }, "他记得：" + arr(tie.notes).slice(-2).join(" ")) : null,
          h("div", { className: "flex flex-wrap", style: { gap: 8, marginTop: 10 } },
            btn(dmOk ? "私信" : "私信 · 没解锁", dmOk, () => setView("dm:" + st.id + "|" + k), "dm"),
            st.promoted ? h("span", { key: "pr", style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, alignSelf: "center" } }, "已经是好友了，在人格档案馆里")
              : btn(stBusy === "friend" ? "问着…" : frOk ? (asked && !asked.ok ? "再申请一次" : "申请加好友") : "加好友 · 没解锁", frOk, () => askFriend(st, k), "fr")),
          !st.promoted ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 6, lineHeight: 1.55 } }, (!dmOk ? ST_DM_LV + " 级开私信，" : "") + (!frOk ? ST_FRIEND_LV + " 级开加好友。" : "")
            + "来一场 +30 经验，打赏一块钱 +1。" + (frOk ? "申请以后他答不答应，看他这个人更在乎什么。" : "")) : null,
          asked && !asked.ok && !st.promoted ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4 } }, "上次被拒了：三天后、或者再升一级才能再申请") : null);
      };
      return h("div", { "data-wk": "livestpage", className: "h-full flex flex-col", style: liveFloor(t) },
        h(Head, { zh: st.name, sub: (st.fans || 0) + " 粉丝", bg: "transparent", ink: t.__pal ? t.ink : undefined, onBack: () => setView("home"),
          right: h("button", { onClick: () => askDropSt(st), style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, minHeight: 40 } }, "不要了") }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
          h("div", { className: "flex items-center", style: { gap: 12, marginTop: 6 } }, stFace(st, 52),
            h("div", { className: "flex-1 min-w-0" },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, lineHeight: 1.55 } }, st.bio || "（没写简介）"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3 } }, "播" + kindZh(st.kind) + (onAirNow ? " · 正在播" : nextSlot ? " · 今晚 " + hm(nextSlot.start) + " 播" : ""))),
            h("button", { "data-wk": "livestfollow", onClick: () => follow(st), className: "active:opacity-70 shrink-0", style: { minHeight: 34, padding: "0 14px", borderRadius: 10, border: "1px solid " + LIVE_RED, background: st.followed ? "transparent" : LIVE_RED, color: st.followed ? LIVE_RED : "#fff", fontFamily: F_BODY, fontSize: 12.5 } }, st.followed ? "已关注" : "关注")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, margin: "18px 0 6px" } }, "关于他"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.sub, lineHeight: 1.75 } }, st.persona),
          h("div", { className: "flex items-center", style: { margin: "18px 0 6px" } },
            h("div", { className: "flex-1", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, st.club ? "他的粉丝团「" + st.club.name + "」" : "他的粉丝团"),
            h("button", { "data-wk": "livestclubroll", onClick: () => rerollClub(st), disabled: !!stBusy, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: LIVE_RED, minHeight: 30 } }, stBusy === "club" ? "起着…" : st.club ? "让他重新起名" : "让他起名")),
          st.club ? h("div", { className: "flex flex-wrap", style: { gap: "4px 10px", fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.6 } },
            st.club.levels.map((x, i) => h("span", { key: i }, h("span", { style: { color: t.fog } }, (i + 1) + " "), x))) : null,
          onAirNow ? h("div", { className: "flex", style: { gap: 8, marginTop: 16 } },
            h("button", { onClick: () => enterSt(st, "me"), className: "active:opacity-70", style: { flex: 1, minHeight: 44, borderRadius: 12, background: LIVE_RED, color: "#fff", fontFamily: F_BODY, fontSize: 14 } }, "进直播间"),
            h("button", { onClick: () => enterSt(st, "mask"), className: "active:opacity-70", style: { minHeight: 44, padding: "0 14px", borderRadius: 12, border: "1px solid " + t.line, color: t.sub, fontFamily: F_BODY, fontSize: 13 } }, "挂马甲"))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 16 } }, st.followed ? (nextSlot ? "今晚 " + hm(nextSlot.start) + " 开播，到点会提醒你" : "今天不播；关注着，他开播会提醒你") : "这会儿没在播"),
          keys.map(row)));
    }
    // ── 跟路人主播的私信 ──
    if (view.indexOf("dm:") === 0) {
      const [sid, key] = view.slice(3).split("|");
      const st = stGet(sid);
      if (!st) { setTimeout(() => setView("home"), 0); return null; }
      const msgs = arr((st.dms || {})[key]);
      return h(StDmPage, { st, msgs, busy: stBusy === "dm", t, title: st.name + (key === "me" ? "" : " · 马甲「" + key.slice(5) + "」"), onBack: () => setView("st:" + sid), onSend: tx => sendDm(st, key, tx) });
    }
    return h("div", { "data-wk": "livepage", className: "h-full flex flex-col", style: liveFloor(t) },
      h(Head, { zh: "直播", bg: "transparent", ink: t.__pal ? t.ink : undefined, onBack: props.embedded ? undefined : props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
        onAir.length ? h("div", { style: { marginTop: 6, marginBottom: 14 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 8 } }, h(GlyphDot), "正在播"),
          onAir.map(x => { const c = whoOf(x.charId); if (!c) return null; const isSt = !characters.some(cc => cc.id === x.charId);
            return h("div", { "data-wk": "liveonair", key: x.id, className: "flex items-center", style: { gap: 10, padding: "10px 12px", marginBottom: 8, borderRadius: 14, border: "1px solid " + LIVE_RED, background: "rgba(226,85,107,.08)" } },
              isSt ? stFace(c, 38) : h(Avatar, { character: c, size: 38 }),
              h("div", { className: "flex-1 min-w-0" },
                h("div", { "data-wk": "liveonairtitle", style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink } }, (c.remark || c.name) + " 在播" + kindZh(x.kind)),
                h("div", { "data-wk": "liveonairtime", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "已经播了 " + Math.max(1, Math.round((now - x.start) / 60000)) + " 分钟 · 到 " + hm(x.end))),
              h("button", { "data-wk": "livejoin", "data-part": "me", onClick: () => joinSlot(x, "me"), className: "active:opacity-70 shrink-0", style: { minHeight: 34, padding: "0 12px", borderRadius: 10, background: LIVE_RED, color: "#fff", fontFamily: F_BODY, fontSize: 12.5 } }, "进去"),
              h("button", { "data-wk": "livejoin", "data-part": "mask", onClick: () => joinSlot(x, "mask"), className: "active:opacity-70 shrink-0", style: { minHeight: 34, padding: "0 8px", color: t.sub, fontFamily: F_BODY, fontSize: 12 } }, "挂马甲")); })) : null,
        later.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 12, lineHeight: 1.7 } },
          "今晚还会播：" + later.map(x => ((whoOf(x.charId) || {}).name || "") + " " + hm(x.start)).join("、")) : null,
        weekRank.length ? h("div", { "data-wk": "liverank", style: { marginBottom: 14, padding: "10px 14px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 6 } }, "本周礼物榜"),
          weekRank.map((x, i) => { const c = whoOf(x.id) || {};
            return h("div", { "data-wk": "liverankrow", key: x.id, className: "flex items-center", style: { gap: 8, padding: "4px 0", fontFamily: F_BODY, fontSize: 13, color: t.ink } },
              h("span", { style: { width: 18, color: i === 0 ? LIVE_RED : t.fog, fontFamily: F_DISPLAY } }, i + 1),
              h("span", { className: "flex-1 min-w-0", style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name),
              h("span", { style: { fontSize: 11.5, color: t.sub, flexShrink: 0 } }, "收了 ¥" + x.total + (x.mine ? " · 你送了 ¥" + x.mine : ""))); })) : null,
        h("div", { style: { display: "flex", flexDirection: "column", gap: 12, marginTop: 6 } },
          characters.length ? door("去看 TA 播", "挑一个人，看 TA 在直播间里是什么样。可以用自己的号，也可以挂马甲。", () => setView("setup:watch")) : null,
          characters.length ? door("我来开播", "你开播，你的人混在观众里看着你。", () => setView("setup:host")) : null,
          !characters.length ? h("div", { "data-wk": "liveempty", style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "30px 0", textAlign: "center" } }, "先去人格档案馆建一个角色") : null),
        // 路人主播：随便逛逛一次刷一批；关注的留着
        props.askStranger ? h("div", { "data-wk": "livestrangers", style: { marginTop: 22 } },
          h("div", { className: "flex items-center", style: { marginBottom: 8 } },
            h("div", { className: "flex-1", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "路人主播"),
            h("button", { "data-wk": "livebrowse", onClick: browse, disabled: !!stBusy, className: "active:opacity-70", style: { minHeight: 32, padding: "0 12px", borderRadius: 10, border: "1px solid " + LIVE_RED, color: LIVE_RED, fontFamily: F_BODY, fontSize: 12 } }, stBusy === "browse" ? "逛着…" : "随便逛逛（刷 " + ST_BATCH + " 个）")),
          (function () {
            const fresh = arr(stDb.list).filter(x => !x.followed && !x.promoted);
            const card = x => h("button", { key: x.id, "data-wk": "livestcard", onClick: () => setView("st:" + x.id), className: "w-full text-left active:opacity-70 flex items-center", style: { gap: 10, padding: "10px 12px", marginBottom: 8, borderRadius: 14, border: "1px solid " + t.line, background: t.bg2 } },
              stFace(x, 38),
              h("div", { className: "flex-1 min-w-0" },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.name + (x.title ? " ·《" + x.title + "》" : "")),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "播" + kindZh(x.kind) + " · " + (Date.now() < (x.liveUntil || 0) ? (x.viewers || 0) + " 人在看" : (x.fans || 0) + " 粉丝") + (x.bio ? " · " + x.bio : ""))),
              Date.now() < (x.liveUntil || 0) || slots.some(y => y.charId === x.id && y.start <= Date.now() && Date.now() < y.end) ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: LIVE_RED, flexShrink: 0 } }, "● 直播中") : null);
            return h("div", null,
              fresh.length ? fresh.map(card) : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "6px 0 10px", lineHeight: 1.6 } }, "点「随便逛逛」刷一批不认识的主播，一次花一次调用。"),
              followedSt.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, margin: "12px 0 8px" } }, "我关注的（" + followedSt.length + "/" + ST_FOLLOW_MAX + "）") : null,
              followedSt.map(card));
          })()) : null,
        props.onLiveCfg ? h("button", { "data-wk": "liveselfcfg", onClick: () => props.onLiveCfg(Object.assign({}, cfg, { selfLive: cfg.selfLive === false })), className: "w-full text-left active:opacity-70", style: { marginTop: 16, minHeight: 40, fontFamily: F_BODY, fontSize: 12.5, color: t.sub } },
          (cfg.selfLive === false ? "○ " : "● ") + "TA 们会自己开播（不进去看就不花调用）") : null,
        missed.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, margin: "22px 0 8px" } }, "错过的") : null,
        missed.map(x => h("div", { "data-wk": "livemissed", key: x.id, className: "flex items-center", style: { gap: 10, padding: "10px 0", borderBottom: "1px solid " + t.line } },
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, ((whoOf(x.charId) || {}).remark || (whoOf(x.charId) || {}).name) + " 播了" + kindZh(x.kind)),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2 } }, (dayKey(new Date(x.start)) === dayKey(new Date()) ? "今天 " : "昨天 ") + hm(x.start) + "–" + hm(x.end) + " · 你没去")),
          h("button", { "data-wk": "liverecap", onClick: () => recap(x), disabled: !!recapBusy, className: "active:opacity-70 shrink-0", style: { minHeight: 34, padding: "0 12px", borderRadius: 10, border: "1px solid " + LIVE_RED, color: LIVE_RED, fontFamily: F_BODY, fontSize: 12, opacity: recapBusy && recapBusy !== x.id ? .5 : 1 } }, recapBusy === x.id ? "剪着…" : "看高光"))),
        list.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, margin: "24px 0 8px" } }, "回放") : null,
        list.map(s => h("div", { "data-wk": "livereplay", key: s.id, className: "flex items-center", style: { gap: 10, padding: "11px 0", borderBottom: "1px solid " + t.line } },
          h("button", { onClick: () => { setCurId(s.id); setView("room"); }, className: "flex-1 min-w-0 text-left active:opacity-70" },
            h("div", { "data-wk": "livereplaytitle", style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (s.endTs ? "" : "● ") + (S(s.title) || "直播间")),
            h("div", { "data-wk": "livereplaytime", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2 } },
              (s.mode === "watch" ? nameOf(s) + " 播的" + (s.recap ? " · 高光" : "") : "我播的") + " · " + new Date(s.startTs).toLocaleDateString() + " · " + arr(s.lines).length + " 条")),
          h("button", { "data-wk": "livereplaydel", onClick: () => save(listRef.current.filter(x => x.id !== s.id)), className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, minHeight: 36, padding: "0 6px" } }, "删")))));
  }

  // ── 回放卡：聊天里那一张 ─────────────────────────────────
  // 卡上存的是【发的那一刻的快照】：标题、谁播的、几个人看、最后十来行。之后这场再怎么样，卡不跟着变。
  function shareSnap(ses, hostName) {
    return { title: S(ses.title) || "直播间", host: hostName, mode: ses.mode, as: ses.as, maskName: ses.maskName, viewers: Number(ses.viewers) || 0,
      startTs: ses.startTs, lines: arr(ses.lines).slice(-14).map(l => ({ kind: l.kind, name: l.name, text: l.text, act: l.act, gift: l.gift, amount: l.amount })) };
  }
  // TA读到的那一段：经过照抄；她挂过马甲的，发给谁就等于对谁说破了
  function shareText(snap, uName, toName) {
    const who = snap.mode === "watch"
      ? (snap.as === "mask" ? uName + "当时用马甲「" + snap.maskName + "」在直播间里——直播间里那个「" + snap.maskName + "」就是她" : uName + "用自己的号在直播间里")
      : uName + "自己开的这场";
    const rows = snap.lines.map(l => l.kind === "gift" ? l.name + " 送了「" + l.gift + "」" : l.kind === "enter" ? l.text : (l.kind === "host" ? "主播 " : "") + l.name + "：" + (l.act ? "（" + l.act + "）" : "") + l.text).join("\n");
    return "[转发了一场直播回放]《" + snap.title + "》｜主播：" + snap.host + "｜" + who + "｜" + snap.viewers + " 人看过"
      + (snap.host === toName ? "｜（这就是你自己播的那一场）" : "") + "\n最后那一段：\n" + rows;
  }
  function LiveShareCard({ m, isU }) {
    const t = useTheme();
    const [open, setOpen] = useState(false);
    const v = m.live || {};
    const rows = arr(v.lines);
    return h("button", { "data-wk": "livecard", onClick: () => setOpen(o => !o), className: "text-left active:opacity-90", style: { width: 250, maxWidth: "100%", borderRadius: 14, overflow: "hidden", background: LIVE_BG, border: "1px solid " + LIVE_LINE } },
      h("div", { style: { padding: "11px 13px 9px", background: "radial-gradient(120% 120% at 0% 0%,rgba(226,85,107,.4),rgba(20,16,25,1))" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: LIVE_DIM } }, h(GlyphDot), "直播回放 · " + (v.viewers || 0) + " 人看过"),
        h("div", { "data-wk": "livecardtitle", style: { fontFamily: F_DISPLAY, fontSize: 15, color: LIVE_INK, marginTop: 4 } }, v.title || "直播间"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: LIVE_DIM, marginTop: 2 } }, "主播 " + (v.host || ""))),
      h("div", { style: { padding: "8px 13px 10px" } },
        (open ? rows : rows.slice(-3)).map((l, i) => h("div", { "data-wk": "livecardline", key: i, style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.5, color: LIVE_INK, padding: "1px 0" } },
          l.kind === "gift" ? h("span", { style: { color: "#f6c76b" } }, l.name + " 送了「" + l.gift + "」")
            : l.kind === "enter" ? h("span", { style: { color: LIVE_DIM } }, l.text)
            : h(Fragment, null, h("span", { style: { color: l.kind === "host" ? LIVE_RED : "#d6c7ff", marginRight: 5 } }, l.name), l.text))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: LIVE_DIM, marginTop: 6 } }, open ? "收起" : (rows.length > 3 ? "点开看最后 " + rows.length + " 行" : ""))));
  }
  window.LiveShareCard = LiveShareCard;
  window.LiveApp = LiveApp;
  window.LiveKit = { slotsOf, fanLevel, LIVE_CUT, recapInstruction, RECAP_SHAPE,  shareSnap, shareText, watchInstruction, hostInstruction, transcript, normNoise, normChat, KINDS, GIFTS, NoiseLayer };
})();
