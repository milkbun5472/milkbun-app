// ============================================================
// 查手机 · 页面那一半（从 js/phone.js 搬出来，她 2026-10-18 瘦身）
// ============================================================
// 查手机的二十个内层 app 页面、手机外壳这些只在点开查手机时才用到，改成用到才加载（js/lazy-mods.js，组名 phone）。
// 开机、后台、聊天要用的那一半（每周自动刷、存进手机、拼刷手机的提示词、聊天列表的小图标 PGlyph、ymd、fmtMoney……）
// 还在 phone.js、开机加载。这里的名字照旧是全局的，跟原来写在一份里时一样用；phone.js 那边不许反过来用这里的东西。
// 自己画满整屏（连顶栏和内页导航一起画）的 app：外层不套通用 Head，也不加 padding，
// 否则会叠出两层标题栏。
// 内层 app 的底衬。
// ⚠️这一块【平色是有意的】，不是还没装修。查手机里那二十个 app 扮的是【真手机上的那些 app】
//   ——微信就该是灰地白格、日历就该是白卡、便签就该是白底上一张黄条、相册就该是照片铺满。
//   给它们铺纸、铺木头，反而会拆掉「这是TA手机」这件事。判据（tabs-not-plain-pills）
//   在这一处是反过来的：**搬到别的 app 里【不成立】才对，而它们模仿的正是别的 app**——
//   所以这一处照着现实里那个东西来，就是对的。
//   （2026-09-05 在浏览器里把二十个逐个开过：购物/论坛/音乐/健康/外卖自己画皮，
//     微信/便签/相册/视频/日历落在这一块上，长相都跟它们模仿的那个东西对得上。）
//
// 起名字是为了让这份「有意」写在明面上：`style: { background: t.bg }` 那种裸写法
// 跟「忘了装修」长得一模一样，而 last-flat-shells 那道闸拦的正是后者。
function phoneAppBg(t) { return { background: t.bg }; }
// 查手机里的外语（她 2026-09-14：「能不能也接翻译，标题、内容、心里想法，
// 任何可能出现别的语言的地方」）。
// ⚠️只包一层壳，不自己写第二套翻译：聊天气泡那套（TransText）现成的——
//   探得出外语才挂「译」键，中文原样返回、一个像素都不多（施工规则/one-public-mechanism.md）。
//   译文缓存、翻译线路、「直接显示／点击显示」那个全局开关也跟着一起有了。
function PTX(v) {
  // 已经是元素／数组（整页正文、一排按钮）就原样放过——String() 了就是一行「[object Object]」，还会挂上「译」（2026-10-17 群友截图）
  if (v && typeof v === "object") return v;
  const s = String(v == null ? "" : v);
  if (!s) return s;
  return typeof TransText === "function" ? h(TransText, { text: s, ink: "currentColor", inline: true }) : s;
}
function phoneTextClamp(text, lines) {
  return typeof translatableLang === "function" && translatableLang(String(text || "")) ? "unset" : lines;
}
const FULL_BLEED_KEYS = ["music", "wechat", "album", "reading", "shopping", "takeout", "health", "bili", "latenight", "liked", "calendar", "notes", "clipboard", "browser", "calls", "timeline", "tally", "mail", "anon", "forum", "astro"];
// 桌面组件：装饰件（不是 app，点了不进任何 app，也不调任何模型）
//   clock  一只走针的表      frame  从TA相册里挑一张当相框      saying 把TA写过的一句话放大
const PHONE_DECOR = ["clock", "frame", "saying"];
// 四种桌面【不只是换几个 key】——她 2026-08-30 问「加了一堆新功能之后这四种分别怎么排比较好」。
// 原来四种的骨架一模一样（时间线 wide + 一个 hero + 一个小的 + 刷新），换的只是里面的名字，
// 摆出来就是同一部手机换了四次壁纸。现在四种各有各的节奏：
//   SOCIAL  人多话多：微信占大头，组件密、图标也多
//   ARCHIVE 记东西的：便签当主角，几乎全是字，留白多、图标最少
//   MEDIA   泡内容里：暗色、图片优先，两块大的压住整页
//   WANDER  安静的：装饰件打头（表和一句话），组件少、每块都大
// 还有一条统一的规矩：【这一页已经有组件的 app，就不在这一页再摆一个图标】——
// 她问的「哪些留图标、哪些换组件」，答案是按页去重，而不是全局二选一。
const PHONE_DESKTOP_LAYOUTS = [{
  id: "social", label: "爱聊的",
  dock: ["calls", "wechat", "browser", "music"],
  pages: [["notes", "album", "forum", "shopping"],
          ["timeline", "liked", "clipboard", "reading", "bili", "takeout", "latenight", "tally", "mail", "anon", "astro"]],
  widgets: [[{ key: "wechat", span: 2, size: "hero" }, { key: "timeline" }, { key: "clock" }, { key: "liked", span: 2, size: "wide" }, { key: "refresh" }, { key: "watch" }],
            [{ key: "frame", span: 2, size: "tall" }, { key: "health" }, { key: "calendar" }]]
}, {
  id: "archive", label: "爱记的",
  dock: ["calls", "wechat", "notes", "browser"],
  pages: [["album", "music", "clipboard", "calendar"],
          ["shopping", "forum", "liked", "bili", "health", "latenight", "takeout", "anon", "astro"]],
  widgets: [[{ key: "notes", span: 2, size: "hero" }, { key: "timeline", span: 2, size: "wide" }, { key: "tally", span: 2, size: "wide" }, { key: "refresh" }, { key: "watch" }],
            [{ key: "reading", span: 2, size: "wide" }, { key: "saying", span: 2, size: "wide" }, { key: "mail" }, { key: "clock" }]]
}, {
  id: "media", label: "泡内容的",
  dock: ["calls", "wechat", "music", "album"],
  pages: [["forum", "browser", "notes", "reading"],
          ["shopping", "clipboard", "calendar", "health", "takeout", "latenight", "tally", "mail", "anon", "astro"]],
  widgets: [[{ key: "music", span: 2, size: "hero" }, { key: "album", span: 2, size: "wide" }, { key: "bili" }, { key: "clock" }, { key: "refresh" }, { key: "watch" }],
            [{ key: "frame", span: 2, size: "tall" }, { key: "liked" }, { key: "timeline" }]]
}, {
  id: "wander", label: "安静的",
  dock: ["calls", "wechat", "browser", "album"],
  pages: [["notes", "music", "shopping", "forum"],
          ["timeline", "liked", "bili", "clipboard", "latenight", "tally", "mail", "health", "anon", "astro"]],
  widgets: [[{ key: "clock" }, { key: "health" }, { key: "saying", span: 2, size: "wide" }, { key: "timeline", span: 2, size: "wide" }, { key: "refresh" }, { key: "watch" }],
            [{ key: "reading" }, { key: "takeout" }, { key: "calendar", span: 2, size: "wide" }]]
}];
const phoneDesktopLayout = char => PHONE_DESKTOP_LAYOUTS[phoneStableHash(char && (char.id || char.name)) % PHONE_DESKTOP_LAYOUTS.length];
// 显示用的相对时间：按 _ts 现算，不用存着的那句话。
// ⚠️phoneFreezeTime 只在【合并】那一刻跑（phoneGrowList 里），而合并只在刷新时发生。
// 于是不刷新的话，昨天存进去的「1小时前」今天打开【还是写着「1小时前」】，
// 看起来就像刚刚才发的——她 2026-08-30 就是这么被骗到的：
// 「我都没刷新过TA就自己出来的」，其实是旧条目的时间戳从来没变老。
// 存的那句话仍然留着当兜底（老数据没有 _ts，或者本来就是绝对日期）。
function phoneAgo(x, nowTs) {
  if (!x || typeof x !== "object") return "";
  const f = phoneTimeField(x);
  const raw = f ? String(x[f] || "").trim() : "";
  if (x._ts == null || x._abs) return raw;      // 绝对日期／老数据：照原样
  const now = nowTs || Date.now();
  const diff = now - x._ts;
  if (diff < 0) return raw;                     // 未来时间不瞎猜
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + "分钟前";
  const d = new Date(x._ts), n = new Date(now);
  const midnight = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const yesterday = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1).getTime();
  if (x._ts >= midnight) return Math.max(1, Math.floor(diff / 3600000)) + "小时前";
  if (x._ts >= yesterday) return "昨天";
  // “几天前”也是日历格数，不是经过了几个 24 小时；否则换夏令时后的第二天会
  // 把前天深夜算成昨天，换回冬令时又会漏掉昨天凌晨。
  const days = Math.round((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())
    - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days <= 6) return days + "天前";
  return (d.getFullYear() !== n.getFullYear() ? d.getFullYear() + "年" : "") + (d.getMonth() + 1) + "月" + d.getDate() + "日";
}
// 时间线读的那份：当前的 + 归档里当前已经没有的。
// 归档独有的那些打上 gone —— 它们在 app 里已经被后来的内容顶掉了，
// 界面上不能再给一个「去便签里看」的按钮，点过去是空的。
function phoneTimelineWithArchive(charData, live, archive, nowTs) {
  const now = nowTs || Date.now();
  const cur = phoneTimeline(charData, live, now);
  const have = {};
  cur.forEach(r => { have[r.id] = 1 });
  const old = (Array.isArray(archive) ? archive : [])
    .filter(r => r && r.id && !have[r.id] && r.ts != null)
    .map(r => ({ ...r, appZh: PHONE_LABEL[r.app] || r.app, gone: true }));
  if (!old.length) return cur;
  const ahead = cur.filter(r => r.ahead);
  const rest = cur.filter(r => !r.ahead).concat(old).filter(r => r.ts != null).sort((a, b) => b.ts - a.ts);
  const loose = cur.filter(r => !r.ahead && r.ts == null);
  return ahead.concat(rest, loose);
}
// ─────────────────────────────────────────────────────────────
// 全局搜索：在TA手机里搜一个词
// ─────────────────────────────────────────────────────────────
// 所有偷看动作里最真的一个是【搜自己的名字】——看她在TA手机的几个角落出现过、
// 以什么名字出现的。不调模型：时间线已经把各 app 的碎片规范化了，
// 再补上时间线不收的那几栏（联系人、想买、口味、账本、书、名单）就够了。
function phoneSearchExtra(charData, live) {
  const d = (charData && typeof charData === "object") ? charData : {};
  const L = (live && typeof live === "object") ? live : {};
  const A = a => Array.isArray(a) ? a : [];
  const S = v => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const g = k => (d[k] && typeof d[k] === "object") ? d[k] : {};
  const out = [];
  const add = (app, tag, title, text) => {
    const ti = S(title), tx = S(text);
    if (!ti && !tx) return;
    out.push({ app, appZh: PHONE_LABEL[app] || app, tag, when: "", ts: null,
      title: ti.slice(0, 60), text: tx.slice(0, 220), thought: "",
      id: phoneEntryId(app, ti, tx, tag) });
  };
  A(g("wechat").contacts).forEach(x => x && add("wechat", "联系人", S(x.name) + (x.remark ? "（备注：" + S(x.remark) + "）" : ""), x.intro));
  const uc = g("wechat").userContact;
  if (uc) add("wechat", "TA给你的备注", S(uc.name) + "（备注：" + S(uc.remark) + "）", uc.intro);
  A(g("calls").frequent).forEach(x => x && add("calls", "常联系", x.name, x.why));
  A(g("calls").blocked).forEach(x => x && add("calls", "黑名单", x.name, x.why));
  A(g("browser").marks).forEach(f => f && A(f.items).forEach(x => x && add("browser", "书签 · " + S(f.name), x.title, x.site)));
  A(g("shopping").wish).forEach(x => x && add("shopping", "想买没买", x.title, x.why));
  A(g("shopping").gifts).forEach(x => x && add("shopping", "送出去的", x.title, S(x.who) + "｜" + S(x.note)));
  A(g("takeout").wish).forEach(x => x && add("takeout", "想吃的", x.title, x.when));
  A(g("liked").follows).forEach(x => x && add("liked", "关注的人", x.name, x.desc));
  A(g("reading").shelves).forEach(sh => sh && A(sh.books).forEach(b => b && add("reading", "书架 · " + S(sh.name), b.title, S(b.author) + "｜" + S(b.note))));
  const tl = g("tally");
  // 跟谁的那一笔要带上——不带的话时间线上一串条目全看不出各自是谁的账
  const wq = x => S(x && x.who) ? S(x.who) + "｜" : "";
  A(tl.debts).forEach(x => x && add("tally", "没结清", wq(x) + S(x.title), x.note));
  A(tl.policies).forEach(x => x && add("tally", "兜底", wq(x) + S(x.name), S(x.clause) || S(x.scope)));
  A(tl.statements).forEach(x => x && add("tally", "定论", wq(x) + S(x.text), x.heat));
  A(tl.treasures).forEach(x => x && add("tally", "估价", wq(x) + S(x.title), x.worth));
  A(tl.appraisals).forEach(x => x && add("tally", "自问", x.q, x.a));
  A(g("mail").drafts).forEach(x => x && add("mail", "写了没发", x.subject, S(x.to) + "｜" + S(x.body)));
  A(L.forumAccounts).forEach(a => a && add("forum", S(a.label) + "账号", S(a.name), a.bio));
  A(((L.playlist || {}).songs)).forEach(x => x && add("music", "歌单", S(x.title) + " · " + S(x.artist), x.note));
  return out;
}
function phoneViewTa(char) { PHONE_VIEW_TA = charTa(char); }
// 通讯录那一行的小字（她 2026-08-31：「还是看不出来哪些刷了哪些没刷」）。
// 原来写的是「每周自动刷一次 / 翻翻 Ta 的手机」——那说的是【开关状态】，不是【刷没刷】，
// 所以一屏看下来还是分不出谁的手机是新的。改成上次全刷的时间。
// ⚠️这一笔是从 v58.99 才开始记的，之前刷过的没有记录——那种显示「还没全刷过」，
// 刷一次就有了。不拿别处的时间戳凑数：宁可说不知道，也别报一个假的时刻。
function phoneLastAllLabel(ts) {
  const t = Number(ts) || 0;
  if (!t) return "还没全刷过";
  const d = new Date(t);
  // ⚠️「今天／昨天」比的是【日历上的那一天】，不是过了多少小时（她 2026-09-06：
  //   「明明是昨天晚上刷的还是显示今天刚刷」）。中午 12:01 看昨晚 20:42 刷的那次，
  //   按小时算才过了 15 小时 → 判成「今天」，屏幕上就写着「今天 20:42 刷过」
  //   ——一个还没到的时刻。翻页的时刻必须是【午夜】（跟 core.js 的 homeDayNo 同一条）。
  // ⚠️用 round 不用 floor：夏令时那两天差的是 23 或 25 小时，floor 会少算一天。
  const day0 = x => { const y = new Date(x); y.setHours(0, 0, 0, 0); return y.getTime(); };
  const days = Math.round((day0(Date.now()) - day0(t)) / 86400000);
  const hm = (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();
  if (days <= 0) return "今天 " + hm + " 刷过";
  if (days === 1) return "昨天 " + hm + " 刷过";
  if (days < 7) return days + " 天前刷过";
  return (d.getMonth() + 1) + "月" + d.getDate() + "日刷过";
}
function phoneSearch(rows, extra, q) {
  const needle = String(q == null ? "" : q).replace(/\s+/g, "").toLowerCase();
  if (needle.length < 1) return [];
  const hay = x => (String(x.title || "") + " " + String(x.text || "") + " " + String(x.thought || "") + " " + String(x.appZh || "") + " " + String(x.tag || ""))
    .replace(/\s+/g, "").toLowerCase();
  const seen = {};
  const out = [];
  (Array.isArray(rows) ? rows : []).concat(Array.isArray(extra) ? extra : []).forEach(x => {
    if (!x || seen[x.id]) return;
    if (hay(x).indexOf(needle) < 0) return;
    seen[x.id] = 1;
    out.push(x);
  });
  // 有时刻的按时间倒序在前，没时刻的（联系人、名单、账本这些）跟在后面
  const timed = out.filter(x => x.ts != null).sort((a, b) => b.ts - a.ts);
  return timed.concat(out.filter(x => x.ts == null));
}

// 今天/昨天/前天/8月28日 周五 —— 时间线按天分段用的标题
// ── 一天里的光（v59.62）──────────────────────────────────────────────
// 她 2026-09-01：「这个背景和这俩 tab 太单调了，弄点跟时间有关的元素吧」。
// 时间线的底色跟着【现在几点】走。不是随手抹的花纹——这一页讲的就是时间，
// 翻开它的那一刻是清晨还是深夜，本身就是一条信息。
// ⚠️一律用 rgba 压在 t.bg 上：深浅两套主题都得照样成立，不许硬写某一种底色。
const PHONE_HOUR_LIGHT = [
  { until: 5,  key: "night", zh: "凌晨", top: "rgba(52,60,108,.30)",   foot: "rgba(34,40,74,.20)",   glow: "rgba(196,206,236,.30)" },
  { until: 9,  key: "dawn",  zh: "清晨", top: "rgba(132,166,196,.32)", foot: "rgba(232,206,170,.24)", glow: "rgba(255,226,178,.46)" },
  { until: 17, key: "day",   zh: "白天", top: "rgba(150,176,190,.26)", foot: "rgba(216,206,178,.18)", glow: "rgba(255,246,214,.52)" },
  { until: 20, key: "dusk",  zh: "黄昏", top: "rgba(206,128,80,.32)",  foot: "rgba(132,92,108,.22)",  glow: "rgba(255,190,128,.50)" },
  { until: 24, key: "dark",  zh: "夜里", top: "rgba(66,72,118,.30)",   foot: "rgba(38,42,78,.20)",   glow: "rgba(206,214,240,.28)" }
];
// 那道光在天上的位置也跟着钟点走：正午最高，越靠两头越低，一整天从左边挪到右边。
// 一天里翻两次时间线，看到的不是同一张底。
const phoneHourLight = ts => {
  const d = new Date(ts == null ? Date.now() : ts);
  const hr = d.getHours() + d.getMinutes() / 60;
  const band = PHONE_HOUR_LIGHT.find(x => hr < x.until) || PHONE_HOUR_LIGHT[PHONE_HOUR_LIGHT.length - 1];
  return { ...band,
    gx: Math.round(9 + hr / 24 * 82),
    gy: Math.min(44, Math.round(9 + Math.abs(hr - 13) * 2.6)) };
};
function phoneDayLabel(ts, nowTs) {
  if (ts == null) return "时间不详";
  const now = new Date(nowTs || Date.now()), d = new Date(ts);
  const day0 = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(now) - day0(d)) / 86400000);
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff === 2) return "前天";
  if (diff === -1) return "明天";
  if (diff === -2) return "后天";
  const dow = "日一二三四五六"[d.getDay()];
  return (d.getFullYear() === now.getFullYear() ? "" : d.getFullYear() + "年") + (d.getMonth() + 1) + "月" + d.getDate() + "日 周" + dow;
}
const phoneClock = ts => {
  if (ts == null) return "";
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
};
const strColor = s => AV_COLORS[[...String(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
// 查手机沿用 App 主屏既有的色彩体系，不另造一套「白方块手机」。
// 键名不完全相同的 app 在这里映射到最接近的主屏模块；默认仍交给 appTone。
const PHONE_TONE_KEY = {
  wechat: "messages", notes: "memo", calls: "phone", browser: "read", shopping: "shop",
  wallet: "ledger", album: "carry", forum: "forum", music: "cast", bili: "fanfic",
  latenight: "dream", reading: "read", liked: "impression", health: "dwell",
  clipboard: "memo", calendar: "calendar", takeout: "shop", timeline: "forum",
  tally: "ledger", anon: "anon", mail: "messages", astro: "astro"
};
function phoneTone(key) {
  if (typeof appTone === "function") return appTone(PHONE_TONE_KEY[key] || key);
  return { wash: "linear-gradient(145deg,rgba(255,255,255,.92),rgba(231,225,214,.82))", glyph: "#3f6f82" };
}
// ── 这是【谁的】手机（v59.30）─────────────────────────────
// 她 2026-09-01：「查手机界面跟主界面颜色一样为啥看起来怪怪的」。
// 怪在【语义】上，不只是审美：**查手机的全部意思是「你在翻别人的手机」**，
// 那种偷看感来自它跟她自己的界面【不一样】。做成同一套纸底＋同一套彩釉图标，
// 等于给TA的手机换上了她的皮；四个角色的手机也会长得一模一样，翻谁都一个样。
// 视觉上还坏在两处：① 极淡的彩釉浮在极淡的米纸上，对比低到一排图标像蒙了雾；
// ② 玻璃质感要透出底下的东西才成立，可底下是哑光米纸，透出来只剩灰。
// 修法不是推翻 Codex 那套（每个角色自定义外观的骨架是对的），是把【默认值】改对。
function phoneHue(charId) {
  const str = String(charId || "");
  let hsh = 2166136261;
  for (let i = 0; i < str.length; i++) { hsh ^= str.charCodeAt(i); hsh = Math.imul(hsh, 16777619); }
  return (hsh >>> 0) % 360;
}
// 同一个人永远同一个色，不同人一定不同色。
// ⚠️v59.31 调亮。她 2026-09-01：「你这些颜色太深了」。
// 上一版为了跟她那张暖米纸分开，直接压到 13~26% 的暗调——分是分开了，但整屏发闷。
// 其实**区分靠色相就够了，不必靠暗**：她的主屏是暖奶油，TA的是带色相的浅色调，
// 一眼就知道不是同一台机器，而且亮着好看。
function phoneOwnPaper(charId) {
  const hu = phoneHue(charId);
  return "linear-gradient(160deg,hsl(" + hu + ",26%,90%) 0%,hsl(" + ((hu + 22) % 360) + ",24%,82%) 56%,hsl(" + hu + ",22%,86%) 100%)";
}
// 底亮了，图标线条和文字就得回到深色，不然一片白糊白
function phoneOwnInk(charId) { return "hsl(" + phoneHue(charId) + ",34%,28%)"; }
function phonePaper(charId, look) {
  if (look && look.iconPreset === "main") {
    return typeof HOME_PAPER_BG !== "undefined" ? HOME_PAPER_BG
      : "linear-gradient(155deg,#f7f2e9 0%,#eee8dc 58%,#f3efe7 100%)";
  }
  return phoneOwnPaper(charId);
}
// 她 2026-09-01：「为啥第一个的阿屿用的还是旧的 codex 那套，你之前改深色TA也没动」。
// 病不在这次的色，在【默认值只对没存过的人生效】：v59.30 把默认改成「TA自己的」，
// 可 08-31 那天她在外观页挨个点过那四张预览卡看长什么样——**点一下就写进了
// x_phoneLooks**。于是那几位被钉死在旧默认上，后面默认怎么改都跟他们无关，
// 看上去就像「这个人没跟着改」。
// 这一栏满打满算只有一天大，里面存的全是她当时挨个试看的结果、不是settled的选择，
// 所以一次性把 iconPreset 清掉，让所有人回到当前默认。
// ⚠️只清这一栏：壁纸和自定义图标是她真上传的东西，一律不动。
// 真想要主界面那套彩釉的，外观页点一下就是。
function phoneLooksBoot() {
  const raw = loadJSON("x_phoneLooks", {});
  if (loadJSON("x_lookPresetReset", false)) return raw;
  const next = {};
  Object.keys(raw).forEach(k => { const one = { ...(raw[k] || {}) }; delete one.iconPreset; next[k] = one; });
  saveJSON("x_phoneLooks", next);
  saveJSON("x_lookPresetReset", true);
  return next;
}
const PHONE_ICON_PRESETS = [
  // ⭐默认：TA的手机就该跟她自己的界面不一样，不然「翻别人手机」在视觉上不成立
  { key: "own", name: "TA自己的", sub: "一人一个底色，跟你的界面分得开" },
  { key: "main", name: "主界面彩釉", sub: "跟这个 app 主界面同一套颜色" },
  { key: "soft", name: "柔光", sub: "更浅、更像磨砂玻璃" },
  { key: "mono", name: "墨色", sub: "低饱和黑白图标" },
  { key: "glass", name: "透明玻璃", sub: "让壁纸透出来" }
];
const fmtMD = d => d.getMonth() + 1 + "月" + d.getDate() + "日";
// 根据财务档案 + 生成日期，推算「跑动余额」：每天扣一笔日常消费，每月1号进月收入/扣固定支出
function computeLedger(w) {
  if (!w) return null;
  const pool = (w.dailyPool || []).filter(x => x && typeof x.amount === "number");
  const start = new Date((w._startDate || ymd(new Date(w._at || Date.now()))) + "T00:00:00");
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  const daily = [];
  let firsts = 0,
    idx = 0;
  for (let d = new Date(start); d <= today; d = new Date(d.getTime() + dayMs)) {
    if (pool.length) {
      const p = pool[idx % pool.length];
      daily.push({
        date: fmtMD(d),
        items: p.items,
        amount: p.amount,
        ts: d.getTime()
      });
    }
    if (d.getDate() === 1 && d.getTime() !== start.getTime()) firsts++;
    idx++;
  }
  const monthly = Number(w.monthlyIncome) || 0,
    fixed = Number(w.fixedMonthly) || 0;
  const spentAll = daily.reduce((a, x) => a + x.amount, 0);
  const balance = (Number(w.baseBalance) || 0) + (Number(w.extra) || 0) + (monthly - fixed) * firsts - spentAll;
  const thisMonth = daily.filter(x => {
    const dt = new Date(x.ts);
    return dt.getMonth() === today.getMonth() && dt.getFullYear() === today.getFullYear();
  });
  const monthSpend = fixed + thisMonth.reduce((a, x) => a + x.amount, 0);
  return {
    balance,
    monthIncome: monthly,
    monthSpend,
    remain: monthly - monthSpend,
    fixed,
    daily: daily.slice().reverse()
  };
}

// app 图标（线性，黑白）
// wk：主题工作室的挂点，原样转给 Svg（图标的 stroke 是属性，皮肤压得住）
// 查手机里所有「点开一条看详情」的整页外壳（v62.59）。
// 审美审计 2026-09-04 数出 8 处子页是半窗，其中 7 处按 no-half-sheet 就该是整页：
// 它们的内容都不需要同时看见底下那一层，而半窗那一层压根没地方放题材元素——
// 「凡是掀半窗的子页，没有一处是合格的」。
// ⚠️给一个【共用的】壳，不是一处一份地各写各的：五处各写一份，迟早长成五个样子
//   （这个仓库里「一层写在两处」已经犯过很多次）。
// bg 收的是那个 app 自己的皮（style 对象），ink 是它顶栏该用的墨色。
function PhoneSubPage({ bg, ink, title, onClose, right, children }) {
  return h("div", { className: "absolute inset-0 h-full min-h-0 flex flex-col", "data-wk": "pdetail", style: Object.assign({ zIndex: 30 }, bg || {}) },
    h(Head, { zh: title || "",
      bg: "transparent",
      noLine: true,
      ink: ink,
      onBack: onClose,
      right: right }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 18px 28px" } }, children));
}

// ─────────────────────────────────────────────────────────────
// 邮件：TA对外那一面
// ─────────────────────────────────────────────────────────────
// 这个 app 的全部意义是【落差】：邮件里的TA是对陌生人和上级说话的样子，
// 客气、绕、留余地；而同一个人在便签里骂的是另一句。
// 界面照着真邮箱做：列表只露主题和那一截，点进去才是全文。
const MAIL_BG = "#f2f4f7", MAIL_INK = "#1b1f26", MAIL_DIM = "#8a919c", MAIL_LINE = "#e3e7ec", MAIL_BLUE = "#2f6fd0";
const MAIL_TABS = [{ k: "inbox", zh: "收件箱" }, { k: "sent", zh: "发出去的" }, { k: "drafts", zh: "草稿" }];
function MailView({ d, char, t, onBack, onRefresh, refreshing, onPeek, drive }) {
  const [tab, setTab] = useState("inbox");
  const [open, setOpen] = useState(null);
  // ── 「看TA玩」驱动（第五批）──
  const driveTab = drive && drive.tab, driveItem = drive && drive.item;
  useEffect(() => { if (drive && driveTab) { setTab(driveTab); setOpen(null); } }, [driveTab]);
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setOpen(null); return; }
    const want = String(driveItem);
    ["inbox", "sent", "drafts"].some(k => {
      const pool0 = (Array.isArray(d && d[k]) ? d[k] : []);
      const hit = watchPick(pool0, want, x => x && x.subject) || watchPick(pool0, want, x => x && x.from);
      if (hit) { setOpen({ ...hit, _kind: k }); return true; }
      return false;
    });
  }, [driveItem]);
  const A = a => Array.isArray(a) ? a : [];
  const S = v => String(v == null ? "" : v).trim();
  const data = (d && typeof d === "object") ? d : {};
  const me = (data.me && typeof data.me === "object") ? data.me : {};
  const rows = k => A(data[k]).filter(x => x && typeof x === "object");
  const who = x => S(x.from) || S(x.to) || "—";
  const unreadN = rows("inbox").filter(x => x.unread).length;

  const listRow = (x, i, kind) => h("button", {
    key: i, onClick: () => setOpen({ ...x, _kind: kind }), "data-wk": "pitem", "data-watch": "item:" + (x.subject || x.from || ""),
    className: "w-full text-left active:opacity-60",
    style: { display: "flex", gap: 10, padding: "13px 4px", borderBottom: "1px solid " + MAIL_LINE, background: "transparent" }
  },
  h("span", {
    "aria-hidden": "true",
    style: { width: 7, height: 7, borderRadius: 99, flexShrink: 0, marginTop: 7, background: (kind === "inbox" && x.unread) ? MAIL_BLUE : "transparent" }
  }),
  h("div", { className: "flex-1 min-w-0" },
    h("div", { className: "flex items-baseline", style: { gap: 8 } },
      h("div", {
        style: {
          flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: MAIL_INK,
          fontWeight: (kind === "inbox" && x.unread) ? 600 : 400,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }
      }, kind === "drafts" ? ("给 " + (S(x.to) || "谁")) : who(x)),
      h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(10.5px * var(--app-fs, 1))", color: MAIL_DIM, flexShrink: 0 } }, S(x.time) || S(x.savedAt))),
    h("div", {
      style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: MAIL_INK, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
    }, S(x.subject) || "（没有主题）"),
    h("div", {
      style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: MAIL_DIM, marginTop: 2, lineHeight: 1.55,
        display: "-webkit-box", WebkitLineClamp: phoneTextClamp(S(x.preview) || S(x.body), 2), WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }
    }, PTX(S(x.preview) || S(x.body))),
    S(x.kind) && kind === "inbox" ? h("span", {
      style: { display: "inline-block", marginTop: 6, fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", padding: "2px 8px", borderRadius: 99, background: "#e7ebf1", color: MAIL_DIM }
    }, S(x.kind)) : null));

  const body = rows(tab).length
    ? rows(tab).map((x, i) => listRow(x, i, tab))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: MAIL_DIM } },
        tab === "drafts" ? "草稿箱是空的" : tab === "sent" ? T("他最近没往外发什么") : "收件箱是空的");

  const detail = open ? h("div", { className: "absolute inset-0 flex flex-col", "data-wk": "pdetail", style: { background: "#fff", zIndex: 30 } },
    h(Head, { zh: open._kind === "drafts" ? "草稿 · 没发出去" : open._kind === "sent" ? "已发送" : "收件箱",
      bg: "#fff", ink: MAIL_INK, subInk: MAIL_DIM, lineInk: MAIL_LINE, onBack: () => setOpen(null) }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", lineHeight: 1.5, color: MAIL_INK, marginTop: 18, wordBreak: "break-word" } }, S(open.subject) || "（没有主题）"),
      h("div", { className: "flex items-center", style: { gap: 10, marginTop: 14, paddingBottom: 14, borderBottom: "1px solid " + MAIL_LINE } },
        h("span", {
          "aria-hidden": "true",
          style: { width: 34, height: 34, borderRadius: 99, flexShrink: 0, background: "#e7ebf1", color: MAIL_DIM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" }
        }, (who(open) || "?").slice(0, 1)),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: MAIL_INK, wordBreak: "break-word" } },
            open._kind === "inbox" ? who(open) : ("给 " + (S(open.to) || "谁"))),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: MAIL_DIM, marginTop: 2, wordBreak: "break-all" } },
            [S(open.fromAddr), S(open.time) || S(open.savedAt)].filter(Boolean).join(" · ")))),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 2, color: "#3c424b", marginTop: 16, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, S(open.body)),
      // TA心里那句：邮件那套客气话之外的真话，落差就在这儿
      S(open.thought) ? h("div", {
        style: { marginTop: 20, background: "#f5f7fa", borderRadius: 13, padding: "13px 15px" }
      },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: MAIL_DIM } }, T("他看完心里那句")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.9, color: MAIL_INK, marginTop: 5, wordBreak: "break-word" } }, PTX(S(open.thought)))) : null,
      open._kind === "drafts" ? h("div", {
        style: { marginTop: 18, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#b6473c", lineHeight: 1.8 }
      }, "这封一直没发出去。" + phoneKeptLine(open, Date.now())) : null,
      // ── 回信条：只有「看TA玩」演到打字那一下才出现 ──
      drive && drive.typing != null ? h("div", { "data-wk": "pinput", "data-watch": "input", style: { marginTop: 20, border: "1px solid " + MAIL_LINE, borderRadius: 13, padding: "13px 15px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: MAIL_DIM } }, "回复 · " + (S(open.from) || S(open.to))),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.95, color: MAIL_INK, marginTop: 7, whiteSpace: "pre-wrap", minHeight: 22 } },
          drive.typing,
          h("span", { style: { display: "inline-block", width: 1.5, height: 15, background: MAIL_INK, marginLeft: 1, verticalAlign: "-2px", animation: "wkcaret 1s steps(1) infinite" } })),
        h("div", { "data-wk": "pbtn", "data-part": "send", "data-watch": "send", style: { marginTop: 11, textAlign: "center", borderRadius: 999, padding: "8px 0", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: drive.typing ? "#fff" : "#9a9a9a", background: drive.typing ? MAIL_INK : "#eeeef2" } }, "发送")) : null,
      onPeek ? h("button", {
        onClick: () => onPeek({
          tier: open._kind === "drafts" ? "hidden" : "quiet",
          label: open._kind === "drafts" ? "邮件 · 写了没发的那封" : open._kind === "sent" ? T("他发出去的邮件") : T("他收到的邮件"),
          title: S(open.subject),
          text: [open._kind === "inbox" ? who(open) : "给 " + S(open.to), S(open.body), S(open.thought)].filter(Boolean).join("｜")
        }),
        className: "w-full active:opacity-60",
        style: {
          marginTop: 22, padding: "12px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))",
          border: "1px solid " + (open._kind === "drafts" ? "rgba(182,71,60,.42)" : MAIL_LINE),
          color: open._kind === "drafts" ? "#b6473c" : MAIL_INK
        }
      }, open._kind === "drafts" ? T("摆到他面前 · 这封他没敢发") : T("转发给 TA · 他会知道你翻了手机")) : null)) : null;

  return h("div", { className: "h-full min-h-0 flex flex-col relative", "data-wk": "papp", "data-app": "mail", style: { background: MAIL_BG } },
    h("div", { className: "shrink-0" },
      h(Head, { zh: "邮件" + (unreadN ? " · " + unreadN + " 封未读" : ""), sub: S(me.addr),
        bg: "transparent", noLine: true, ink: MAIL_INK, subInk: MAIL_DIM, onBack,
        right: h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 38, height: 38 } }, h(IRefresh, { size: 17, color: MAIL_INK })) }),
      // ── 三页＝吊挂文件夹的标签舌（tabs-not-plain-pills）─────────────
      //   原来是三颗白药丸分段：那是 iOS 的通用控件，搬到任何 app 里都成立。
      //   信箱现实里是几个夹子，夹子的舌是【梯形】——两侧斜切、宽度按名字走、
      //   不占满一行；选中那片抬到最前、变成信件区的白、压住底下那条线。
      //   跟浏览器那条标签条分得开：那条是等宽相接的方肩，这三片是斜肩、不等宽。
      h("div", { className: "flex items-end", style: { gap: 3, marginTop: 12, borderBottom: "1px solid " + MAIL_LINE } },
        MAIL_TABS.map(x => {
          const on = tab === x.k, n = rows(x.k).length;
          return h("button", {
            key: x.k, onClick: () => { setTab(x.k); setOpen(null); }, "data-wk": "ptab", "data-on": tab === x.k ? "1" : "0", "data-watch": "tab:" + x.k, className: "active:opacity-70",
            style: {
              fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: on ? "10px 16px 9px" : "8px 14px 7px",
              minHeight: 40, marginBottom: -1,
              clipPath: "polygon(9px 0, calc(100% - 9px) 0, 100% 100%, 0 100%)",
              background: on ? "#fff" : "rgba(0,0,0,.035)",
              color: on ? MAIL_INK : MAIL_DIM
            }
          }, x.zh + (n ? " " + n : ""));
        })),
      null),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingBottom: COMPOSER_PAD_BOTTOM, background: "#fff" } }, body),
    detail);
}

// ─────────────────────────────────────────────────────────────
// 账本：TA心里那本没结清的账。跟谁有账就记谁——用户只是其中一个人（v59.12）
// ─────────────────────────────────────────────────────────────
// 五栏各有各的腔调，界面也就各长各的样子——挤成一个样式就白分了。
//   负债 = 两栏对账（TA欠 / 她欠 / 悬着）
//   保单 = 条款卡（虚线框、条目式）
//   声明 = 一句一张的盖章卡
//   藏品 = 横滑的估价牌
//   估值 = 问答
const TALLY_BG = "#f4f2ee", TALLY_INK = "#1f1d1a", TALLY_DIM = "#8b8578", TALLY_LINE = "rgba(31,29,26,.12)";
// 账页那套纸（v59.63）：贴条的纸色、账本的朱色、横格线。五栏共用这一套。
const TALLY_PAPER = "#fffdf7", TALLY_RED = "#9c3f34", TALLY_RULE = "rgba(31,29,26,.055)";
const TALLY_DIR = { mine: { get zh() { return T("他欠"); }, c: "#b6473c" }, theirs: { zh: "记着", c: "#3f7f8a" }, open: { zh: "还悬着", c: "#8b8578" } };
const TALLY_TABS = [
  // ⚠️原来每一栏还挂着一个 en（OPEN / COVER / STAMP / WORTH / ASK）——
  //   全库没有一处引用它，纯粹是死字段，删干净（no-english-titles 顺手）。
  { k: "debts", zh: "没结清" },
  { k: "policies", zh: "兜底" },
  { k: "statements", zh: "定论" },
  { k: "treasures", zh: "估价" },
  { k: "appraisals", zh: "自问" }
];
// 系统里把动效关掉的人，不该被一个字一个字地喂。取不到就当没关。
function phoneCalmMotion() {
  try { return !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  catch (e) { return false; }
}
// ── 每一条的两面（v59.63）──────────────────────────────────────────────
// 她 2026-09-01：「我们都没用过那种翻面设计，就是在一面显示比较正常的话，翻了页
// 就有这句话的另一面，然后可以做这种流式显示翻过来一个字一个字慢慢往外蹦」。
// ⚠️不是给账本硬套一层壳：这五栏的数据【本来就长成两面】——
//   正面是记在账上的那一行（欠的是什么、险种名、那句话、那样东西、那个问题），
//   背面是TA心里那一句（怎么想这笔、条款正文、那句话真正的意思、TA给的估价、TA的答案）。
// ⚠️背面是空的那几条不给折角：折角在，就是说这张真有背面。空折角＝骗人点一下。
function tallyEntries(tab, data) {
  const A = a => Array.isArray(a) ? a : [];
  // 模型偶尔把一栏写成字符串或对象；String({}) 会变成 [object Object] 印在纸上
  const S = v => (v == null || typeof v === "object") ? "" : String(v).trim();
  const rows = A(data && data[tab]).filter(x => x && typeof x === "object");
  return rows.map((x, i) => {
    const b = { i, key: tab + i, kind: tab, who: S(x.who) };
    if (tab === "debts") return { ...b, dir: S(x.dir), lead: S(x.title),
      back: { label: "TA心里这笔账", text: S(x.note) } };
    if (tab === "policies") return { ...b, lead: S(x.name), scope: S(x.scope), terms: S(x.terms),
      back: { label: "条款正文", text: S(x.clause) } };
    if (tab === "statements") return { ...b, lead: S(x.text), heat: S(x.heat),
      // truth 是 v59.63 新加的一栏：这句话底下真正的意思。
      // 老存档没有它 —— 那就没有背面，别拿别的字段凑一句假的出来。
      back: { label: "这句话底下", text: S(x.truth) } };
    if (tab === "treasures") return { ...b, lead: S(x.title), kind2: S(x.kind),
      back: { label: "TA给的估价", text: S(x.worth) } };
    return { ...b, lead: S(x.q), back: { label: "TA的答案", text: S(x.a) } };
  });
}
function TallyView({ d, char, t, onBack, onRefresh, refreshing, onPeek, drive }) {
  const [tab, setTab] = useState("debts");
  // ── 「看TA玩」驱动（第五批）。账本只能看：翻开一张卡片看它背面，改不了 ──
  const driveTab = drive && drive.tab, driveItem = drive && drive.item;
  useEffect(() => { if (drive && driveTab) { setTab(driveTab); setFlip(null); } }, [driveTab]);
  // 同一时刻只翻开一张：打字机的计时器就一个，不会漏；也免得整页都在动。
  const [flip, setFlip] = useState(null);
  const [typed, setTyped] = useState(0);
  const typeRef = useRef(null);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const S = v => (v == null || typeof v === "object") ? "" : String(v).trim();
  const count = k => A(data[k]).filter(x => x && typeof x === "object").length;
  const rows = tallyEntries(tab, data);
  const openEntry = rows.find(e => e.key === flip) || null;
  // ⚠️翻开哪一张认的是 flip 这个 key（tab+下标），不是那一行本身——照这一屏自己的写法来
  const driveKey = driveItem ? ((watchPick(rows, driveItem, e => e && e.lead) || {}).key) : null;
  useEffect(() => { if (drive) setFlip(driveKey || null); }, [driveKey]);
  const backText = openEntry ? openEntry.back.text : "";
  // 翻过去之后一个字一个字往外蹦。翻回来就停——计时器只跟着「翻开的是哪一张」走。
  useEffect(() => {
    if (typeRef.current) { clearInterval(typeRef.current); typeRef.current = null; }
    const n = backText.length;
    if (!n) { setTyped(0); return; }
    if (phoneCalmMotion()) { setTyped(n); return; }
    setTyped(0);
    typeRef.current = setInterval(() => setTyped(v => {
      if (v + 1 >= n) { clearInterval(typeRef.current); typeRef.current = null; return n; }
      return v + 1;
    }), 32);
    return () => { if (typeRef.current) clearInterval(typeRef.current); typeRef.current = null; };
  }, [flip, backText]);
  // 点一下：还在蹦字就当场蹦完（别逼人等），已经蹦完了才翻回去。
  const tap = e => {
    if (!e.back.text) return;
    if (flip !== e.key) { setFlip(e.key); return; }
    if (typed < e.back.text.length) { setTyped(e.back.text.length); return; }
    setFlip(null);
  };
  // 这笔账是跟谁的。v59.12 起每条都带 who——账本不再只记用户那一本。
  // 旧数据没有 who：不显示，别硬填一个「你」上去（那正是要撤掉的那个假设）。
  const whoPill = x => S(x && x.who) ? h("span", {
    key: "w",
    style: {
      fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", padding: "2px 8px", borderRadius: 99, flexShrink: 0,
      background: "rgba(31,29,26,.05)", color: TALLY_DIM, maxWidth: 108,
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
    }
  }, S(x.who)) : null;
  const peekBtn = (label, title, text) => onPeek ? h("button", { "data-wk": "pbtn", "data-part": "peek",
    onClick: e => { e.stopPropagation(); onPeek({ tier: "hidden", label: "账本 · " + label, title, text }); },
    className: "active:opacity-60",
    style: { marginTop: 14, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", padding: "6px 12px", borderRadius: 99, border: "1px solid rgba(156,63,52,.45)", color: TALLY_RED }
  }, T("摆到他面前")) : null;
  const eyebrow = (s, c) => h("span", {
    style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(8.5px * var(--app-fs, 1))", letterSpacing: ".2em", color: c || TALLY_DIM }
  }, s);
  // 骑缝印（v59.64）：一栏一个字，盖在左边那道栏线上。
  // 五栏原来是同一列白卡往下排，翻不翻都一个样子；一列朱印下去，
  // 这一页才像一本账，而不是一叠便签。没结清那一栏按方向上色——
  // 「TA欠」和「记着」隔着老远也分得出来。
  // 没结清那一栏的印刻的是【方向】：一列 欠／记／悬 走下来，隔着老远也看得出
  // 这一页是TA欠得多还是TA记着的多。别的栏一栏一个字。
  const SEAL = { policies: "保", statements: "定", treasures: "估", appraisals: "问" };
  const DIR_SEAL = { mine: "欠", theirs: "记", open: "悬" };
  const sealOf = e => e.kind === "debts" ? (DIR_SEAL[e.dir] || DIR_SEAL.open) : (SEAL[e.kind] || "账");
  const sealColor = e => e.kind === "debts" ? ((TALLY_DIR[e.dir] || TALLY_DIR.open).c) : TALLY_RED;

  // ── 正面：五栏各长各的样子 ──────────────────────────────────────
  // 五栏渲染成同一张白卡的话，「兜底」是一张保单、「估价」是一张拍品签这件事
  // 就一个字都看不出来了——那正是这一版要改掉的。
  const faceOf = e => {
    if (e.kind === "debts") {
      // 方向不在这儿说——左边那个印就是它。同一句话说两遍，卡片上就只剩标签了。
      return [
        e.who ? h("div", { key: "h", style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 9 } }, whoPill(e)) : null,
        h("div", { key: "x", style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.55, color: TALLY_INK, wordBreak: "break-word" } }, PTX(e.lead))
      ];
    }
    if (e.kind === "policies") {
      // 保单：险种名压在顶上，承保范围和理赔条件排成两行条目表
      return [
        h("div", { key: "h", style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 } },
          eyebrow("第 " + String(e.i + 1).padStart(2, "0") + " 条"), whoPill(e)),
        h("div", { key: "n", style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.4, color: TALLY_INK, wordBreak: "break-word" } }, PTX(e.lead)),
        (e.scope || e.terms) ? h("div", { key: "t", style: { marginTop: 11, borderTop: "1px solid " + TALLY_LINE, paddingTop: 9, display: "grid", gap: 6 } },
          [["承保范围", e.scope], ["理赔条件", e.terms]].filter(r => r[1]).map(r =>
            h("div", { key: r[0], style: { display: "flex", gap: 9, alignItems: "baseline" } },
              h("span", { style: { flexShrink: 0, width: 56, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: TALLY_DIM } }, r[0]),
              h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.7, color: TALLY_INK, wordBreak: "break-word" } }, r[1])))) : null
      ];
    }
    if (e.kind === "statements") {
      // 盖了章的一句话：朱色的引号压在左上，温度是右下角那个小印
      return [
        h("div", { key: "q", style: { position: "relative", paddingLeft: 16 } },
          h("span", { "aria-hidden": "true", style: { position: "absolute", left: -1, top: -6, fontFamily: F_DISPLAY, fontSize: "calc(30px * var(--app-fs, 1))", lineHeight: 1, color: TALLY_RED, opacity: .35 } }, "“"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", lineHeight: 1.7, color: TALLY_INK, wordBreak: "break-word" } }, PTX(e.lead))),
        (e.heat || e.who) ? h("div", { key: "m", style: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, marginTop: 11 } },
          whoPill(e),
          e.heat ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", padding: "3px 9px", borderRadius: 4, border: "1px solid " + TALLY_RED, color: TALLY_RED } }, e.heat) : null) : null
      ];
    }
    if (e.kind === "treasures") {
      // 拍品签：编号在顶上，名字在中间，归类和跟谁有关在底下
      return [
        h("div", { key: "h", style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 9, borderBottom: "1px solid " + TALLY_LINE } },
          eyebrow("第 " + String(e.i + 1).padStart(2, "0") + " 号", TALLY_RED),
          e.kind2 ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: TALLY_DIM } }, PTX(e.kind2)) : null),
        h("div", { key: "x", style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.5, color: TALLY_INK, marginTop: 11, wordBreak: "break-word" } }, PTX(e.lead)),
        e.who ? h("div", { key: "w", style: { marginTop: 9 } }, whoPill(e)) : null
      ];
    }
    // 自问：一个问号压在左边，问题本身是正面
    return [
      h("div", { key: "h", style: { display: "flex", alignItems: "flex-start", gap: 11 } },
        h("span", { "aria-hidden": "true", style: { flexShrink: 0, width: 22, height: 22, borderRadius: 99, border: "1px solid " + TALLY_LINE, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(12px * var(--app-fs, 1))", color: TALLY_DIM } }, "?"),
        h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.6, color: TALLY_INK, wordBreak: "break-word" } }, PTX(e.lead))),
      e.who ? h("div", { key: "w", style: { marginTop: 10, paddingLeft: 33 } }, whoPill(e)) : null
    ];
  };
  // ── 背面：同一张纸翻过来 ────────────────────────────────────────
  // 参考里那种「翻过去是一张机密档案」不抄：这儿翻过去还是【同一张纸的背面】——
  // 纸色一样，只是格子反过来、字是朱色的。翻的是一张纸，不是打开一个新东西。
  const backOf = e => {
    // ⚠️背面一直在 DOM 里（backface-hidden 挡着），所以这两样都要认「翻开的是不是我」：
    //   光标不认的话，没翻开的每一张背面上都在闪一根竖线；
    //   按钮不认的话，每一张背面都挂着一个「摆到TA面前」——读屏读不到，
    //   但键盘能 Tab 上去按下它（aria-hidden 不管 tab 顺序）。
    const on = flip === e.key;
    const txt = e.back.text, n = on ? typed : 0, typing = on && n < txt.length;
    return [
      h("div", { key: "l", style: { marginBottom: 10 } }, eyebrow(e.back.label, TALLY_RED)),
      h("div", {
        key: "x", "aria-label": txt,
        style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.85, color: TALLY_RED, wordBreak: "break-word" }
      },
        // 还没蹦出来的那半留在原地、只是透明：不然卡片会一行一行地长高，字在跳
        h("span", { "aria-hidden": "true" }, txt.slice(0, n)),
        typing ? h("span", { "aria-hidden": "true", style: { opacity: .55 } }, "▏") : null,
        h("span", { "aria-hidden": "true", style: { color: "transparent" } }, txt.slice(n))),
      (on && !typing) ? peekBtn(TALLY_TABS.filter(x => x.k === e.kind).map(x => x.zh)[0] || "账本", e.lead, txt) : null
    ];
  };
  // ── 一张纸的两面 ────────────────────────────────────────────────
  // 在流里的那一面撑起高度、另一面绝对定位压在它上面：两面长短不一样，
  // 固定高度的话短的那面空一大截、长的那面被切掉。
  const slip = e => {
    const on = flip === e.key, has = !!e.back.text;
    const faceStyle = front => ({
      position: (front !== on) ? "relative" : "absolute",
      inset: (front !== on) ? "auto" : 0,
      backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
      transform: front ? "none" : "rotateY(180deg)",
      background: TALLY_PAPER, borderRadius: 7, border: "1px solid rgba(31,29,26,.10)",
      padding: "15px 16px", overflow: "hidden"
    });
    const sc = sealColor(e);
    return h("div", { key: e.key, style: { display: "flex", gap: 11, marginBottom: 11 } },
      // 左边那道栏线：两条细朱线，印骑在上面。整列连着走，翻页不断。
      h("div", { "aria-hidden": "true", style: { position: "relative", width: 26, flexShrink: 0 } },
        h("span", { style: { position: "absolute", left: 11, top: -11, bottom: -11, width: 1, background: "rgba(156,63,52,.28)" } }),
        h("span", { style: { position: "absolute", left: 14, top: -11, bottom: -11, width: 1, background: "rgba(156,63,52,.14)" } }),
        h("span", { style: {
          position: "absolute", left: 0, top: 13, width: 26, height: 26, borderRadius: 5,
          border: "1px solid " + sc, color: sc, background: TALLY_BG,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1
        } }, sealOf(e)),
        // 印底下那个号：账本一行一号，一列数下去这一页才有长度
        h("span", { style: {
          position: "absolute", left: 0, top: 43, width: 26, textAlign: "center",
          fontFamily: "'Archivo',sans-serif", fontSize: "calc(8.5px * var(--app-fs, 1))", letterSpacing: ".06em", color: "rgba(156,63,52,.5)"
        } }, String(e.i + 1).padStart(2, "0"))),
      h("div", { style: { flex: 1, minWidth: 0, perspective: 1000 } },
      h(has ? "button" : "div", {
        onClick: has ? () => tap(e) : undefined, "data-wk": "pitem", "data-watch": "item:" + (e.lead || ""),
        className: has ? "w-full text-left" : "w-full",
        "aria-expanded": has ? (on ? "true" : "false") : undefined,
        style: {
          display: "block", position: "relative", width: "100%", transformStyle: "preserve-3d",
          transform: on ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: phoneCalmMotion() ? "none" : "transform .5s cubic-bezier(.4,.05,.3,1)"
        }
      },
        // 背对着人的那一面读屏也不该念——两面一起念出来，等于没翻这一下
        h("div", { "aria-hidden": on ? "true" : null, style: faceStyle(true) }, faceOf(e),
          // 右下角折起来的一角＝这张真有背面。没背面的不给角，免得白点一下。
          has ? h("span", { "aria-hidden": "true", style: {
            position: "absolute", right: 0, bottom: 0, width: 17, height: 17,
            background: "linear-gradient(135deg,transparent 49%," + TALLY_LINE + " 50%," + TALLY_BG + " 52%)"
          } }) : null),
        h("div", { "aria-hidden": on ? null : "true", style: faceStyle(false) }, has ? backOf(e) : null,
          h("span", { "aria-hidden": "true", style: {
            position: "absolute", left: 0, bottom: 0, width: 17, height: 17,
            background: "linear-gradient(-135deg,transparent 49%," + TALLY_LINE + " 50%," + TALLY_BG + " 52%)"
          } })))));
  };

  // 这一栏抬头那句：说的是【这一栏】有几笔、什么样，不是笼统一句「这本账」。
  // 没结清那一栏还要拆出三个方向的数——一边倒还是三样都有，一眼看得出来。
  const headNote = () => {
    const n = rows.length;
    if (!n) return "";
    if (tab === "debts") {
      // 三个方向按各自的颜色写出来：左边那一列印是什么意思，这一行就是它的说明。
      // 另写一条【图例】是最笨的解法——把说明放在它本来就该在的地方。
      const c = k => rows.filter(e => (TALLY_DIR[e.dir] ? e.dir : "open") === k).length;
      return [["mine", c("mine")], ["theirs", c("theirs")], ["open", c("open")]]
        .filter(x => x[1]).map((x, i) => h("span", { key: x[0] },
          i ? h("span", { style: { color: TALLY_DIM } }, " · ") : null,
          h("span", { style: { color: TALLY_DIR[x[0]].c } }, TALLY_DIR[x[0]].zh + " " + x[1])));
    }
    if (tab === "policies") return "给 " + new Set(rows.map(e => e.who).filter(Boolean)).size + " 个人兜着底";
    if (tab === "statements") return n + " 句盖过章的话";
    if (tab === "treasures") return n + characterText(char, " 样他估过价的东西");
    return n + characterText(char, " 个他问自己的问题");
  };

  return h("div", { className: "h-full flex flex-col", "data-wk": "papp", "data-app": "tally", style: { background: TALLY_BG } },
    // ── 账本的封面那一块（v59.64）────────────────────────────────
    // 原来整页从上到下一个色度：米底、近白的卡、灰字，没有一处压得住。
    // 把顶上这一块做成墨色的封皮，字反白出来——账页才有个开头。
    // ⚠️封皮这一块【不许再自己垫 safeTop】：刘海归 Head 让，两层都让就顶出去一截
    h("div", { className: "shrink-0", style: { background: TALLY_INK } },
      h(Head, { zh: "账簿", bg: "transparent", noLine: true, ink: TALLY_BG, onBack,
        right: onRefresh ? h("button", { onClick: onRefresh, disabled: refreshing, className: "active:opacity-50 disabled:opacity-40", "aria-label": "重新推演", style: { width: 40, height: 40 } }, h(IRefresh, { size: 17, color: TALLY_BG })) : null }),
      // ── 五栏＝账簿边上伸出来的索引标签（v59.65）─────────────────
      // 她 2026-09-01：「这几个tab药丸形状还是有点普通」。
      // 药丸是哪儿都能用的那一种，换个 app 照样成立——按她那条老判据就是写坏了。
      // 账本自己的形状是【分栏的索引标签】：上圆下方、贴着页边；
      // 选中的那一栏满高、纸色，直接长进底下的账页里（就是翻开的那一页），
      // 没选中的往下缩一截、暗着，像压在后面几页。
      // ⚠️朱线不做成单独一条：它是这一行自己的底色，选中那张标签用纸色盖住自己
      //   那一段——线断在哪儿，就说明翻开的是哪一页。
      //   （overflow-x:auto 会连带把纵向也裁掉，所以标签不能靠负 margin 探出去。）
      h("div", {
        className: "flex px-5 overflow-x-auto",
        style: {
          gap: 3, alignItems: "stretch", scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
          background: "linear-gradient(to top,rgba(156,63,52,.55) 0 2px,transparent 2px)"
        }
      }, TALLY_TABS.map(x => h("button", {
        key: x.k, onClick: () => { setTab(x.k); setFlip(null); }, "data-wk": "ptab", "data-on": tab === x.k ? "1" : "0", "data-watch": "tab:" + x.k,
        className: "active:opacity-70",
        "aria-pressed": tab === x.k ? "true" : "false",
        style: {
          flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))",
          padding: tab === x.k ? "10px 15px 9px" : "8px 13px 7px",
          marginTop: tab === x.k ? 0 : 6,
          borderRadius: "9px 9px 0 0",
          background: tab === x.k ? TALLY_BG : "rgba(244,242,238,.08)",
          color: tab === x.k ? TALLY_INK : "rgba(244,242,238,.58)",
          boxShadow: tab === x.k ? "none" : "inset 0 1px 0 rgba(244,242,238,.14)"
        }
      }, x.zh + (count(x.k) ? " " + count(x.k) : ""))))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
      // 账页抬头：左边这一栏有几笔、什么样；右边一句话交代折角是干嘛的
      rows.length ? h("div", { className: "flex items-baseline justify-between gap-3", style: { padding: "13px 0 10px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: TALLY_INK, minWidth: 0, wordBreak: "break-word" } }, headNote()),
        // 折角不解释一句没人会去点。只说一次，说在最上面。
        h("div", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: TALLY_RED, textAlign: "right", lineHeight: 1.5, maxWidth: 118 } },
          "折了角的那几张有背面 · 点一下翻过来")) : null,
      // 账页的横格只铺到最后一条为止。铺满整个滚动框的话，一栏只有一条时
      // 底下就是大半屏空格子，看着像一张没填完的表。
      rows.length ? h("div", { style: {
        paddingTop: 4,
        background: "repeating-linear-gradient(180deg,transparent 0 31px," + TALLY_RULE + " 31px 32px)"
      } }, rows.map(slip))
        : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: TALLY_DIM, textAlign: "center", padding: "60px 20px", lineHeight: 1.9 } },
          "这一栏还是空的。"),
      // 账页收口：双线一封，底下写清楚这一栏到此为止。
      // 时间线那一页学到的：线走完最后一条就断掉，底下那片空白看着像没加载完。
      rows.length ? h("div", { style: { padding: "4px 0 30px" } },
        h("div", { style: { height: 1, background: "rgba(156,63,52,.30)" } }),
        h("div", { style: { height: 1, background: "rgba(156,63,52,.30)", marginTop: 2 } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: TALLY_DIM, marginTop: 9 } },
          characterText(char, "这一栏记到这儿。他没记下的，这儿也不会有。"))) : null));
}

// ─────────────────────────────────────────────────────────────
// 时间线视图
// ─────────────────────────────────────────────────────────────
// 每条左边是时刻，右边是内容，中间一条竖轴把一天串起来。
// 新增的（上次翻完之后才出现的）左侧有一个实心点，顶上可以切「只看新增」。
function TimelineView({ rows, char, t, onBack, onOpenApp, onPeek, newIds, newCount, onMarkRead, kept, onToggleKeep }) {
  // mode: all / new / keep —— 「我收着的」是【她自己】留的，不喂给聊天。
  // 转发＝摆到TA面前；收着＝我自己留一份。两件事，两个按钮。
  const [mode, setMode] = useState("all");
  const [sheet, setSheet] = useState(null);
  // ── 接下来 / 走过的，分两个 tab（v59.60）────────────────────────────
  // 她 2026-09-01：「时间线现在是打开看到接下来排好的下滑完一周接下来的才能看到
  // 以前的时间线。能不能改成这俩分开俩 tab」。
  // 原来是一条线：未来正序摆最前、过去倒序跟在后面。日历接了真数据之后「接下来」
  // 动辄一整周，于是【时间线本体反而要滑过一周才够得着】——这条线的主角是TA手机上
  // 已经留下的痕迹，不该被还没发生的事挡在门口。
  // 默认落在【走过的】：它才是这条线的正文；「接下来」是另一件事，自己一格。
  const [tab, setTab] = useState("past");
  const scrollRef = useRef(null);
  const list = Array.isArray(rows) ? rows : [];
  const isNew = r => !!(newIds && newIds[r.id]);
  const isKept = r => !!(kept && kept[r.id]);
  const aheadN = list.filter(r => r.ahead).length;
  const pastN = list.length - aheadN;
  // 两个 chip 只管当前这一格：在「接下来」里写着「只看新增 12」、点下去一条都没有，
  // 那个 12 说的是隔壁那一格的事。
  const pool = list.filter(r => tab === "ahead" ? !!r.ahead : !r.ahead);
  const keptCount = pool.filter(isKept).length;
  const poolNew = pool.filter(isNew).length;
  const onlyNew = mode === "new";
  const shown = mode === "new" ? pool.filter(isNew) : mode === "keep" ? pool.filter(isKept) : pool;
  // 换格时把筛选和滚动都归位：带着「我收着的」切过去、那一格一条都没收着的话，
  // chip 自己消失，人就卡在一个空列表里退不出来。
  const goTab = k => { if (k === tab) return; setTab(k); setMode("all"); if (scrollRef.current) scrollRef.current.scrollTop = 0; };
  // 轴上那个「现在」要走针。半分钟对一次就够——画秒的话整页每秒重渲染，不值。
  // 顺带让 now 跟着它走：过了午夜，「今天」那一格的标题自己会改口。
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setClockNow(Date.now()), 30000); return () => clearInterval(iv); }, []);
  const now = clockNow;
  const light = phoneHourLight(now);
  // 按天切段
  const groups = [];
  shown.forEach(r => {
    // 「接下来 · 」这个前缀 v59.60 撤了：两段已经分在两个 tab 里，
    // 整格都是未来的时候，每条标题上再挂一遍等于白说。
    const label = phoneDayLabel(r.ts, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(r); else groups.push({ label, rows: [r] });
  });
  const TL_DOT = "#c4553f";
  const row = (r, first, last) => h("button", {
    key: r.id,
    onClick: () => setSheet(r),
    className: "w-full text-left active:opacity-60",
    style: { display: "flex", gap: 12, padding: "0 2px" }
  },
  // 左侧：时刻 + 竖轴
  h("div", { style: { width: 46, flexShrink: 0, textAlign: "right", paddingTop: 11 } },
    h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(11.5px * var(--app-fs, 1))", color: isNew(r) ? TL_DOT : t.fog } },
      r.ts == null ? "—" : phoneClock(r.ts))),
  h("div", { style: { width: 15, flexShrink: 0, position: "relative", display: "flex", justifyContent: "center" } },
    // 实线＝已经发生，虚线＝还没发生。同一套话在上面那条轴上已经说过一遍，
    // 这里再说一遍，两处对得上，就不用另写一行小字去解释它。
    h("span", { style: { position: "absolute", top: first ? 15 : 0, bottom: last ? "auto" : 0, height: last ? 0 : "auto",
      width: r.ahead ? 0 : 1, borderLeft: r.ahead ? "1px dashed " + t.line : "none", background: r.ahead ? "transparent" : t.line } }),
    h("span", {
      style: {
        position: "absolute", top: 12, width: isNew(r) ? 9 : 6, height: isNew(r) ? 9 : 6, borderRadius: 9,
        background: isNew(r) ? TL_DOT : t.bg, border: "1.5px solid " + (isNew(r) ? TL_DOT : t.line)
      }
    })),
  h("div", { className: "flex-1 min-w-0", style: { paddingBottom: 14, paddingTop: 7 } },
    h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 3 } },
      h(PGlyph, { k: r.app, size: 12, color: t.fog }),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } },
        r.appZh + (r.tag ? " · " + r.tag : "") + (r.gone ? " · 已被顶掉" : "")),
      isKept(r) ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: t.ink, marginLeft: "auto" } }, "收着") : null),
    r.title && h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.45, wordBreak: "break-word" } }, PTX(r.title)),
    r.text && h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.65, marginTop: 3, wordBreak: "break-word" } },
      r.text.length > 52 ? r.text.slice(0, 52) + "…" : r.text)));
  return h("div", { className: "h-full flex flex-col", "data-wk": "papp", "data-app": "timeline", style: {
    // 上下两道光压在主题底色上：上面那道是这个钟点的天色，下面那道是它落到地上的余色
    background: "radial-gradient(58% 34% at " + light.gx + "% " + light.gy + "%," + light.glow + ",transparent 70%),"
      + "linear-gradient(180deg," + light.top + ",transparent 52%),"
      + "linear-gradient(0deg," + light.foot + ",transparent 36%)," + t.bg
  } },
    h(Head, { zh: "时间线", bg: "transparent", noLine: true, onBack }),
    // ── 两格＝这条轴的两头（v59.66）────────────────────────────────
    // 她 2026-09-01：「把时间线的也弄了吧」→ 施工规则/tabs-not-plain-pills.md。
    // v59.60 只改了一半：位置有意义了（各站一头、中间钉着现在），形状还是两颗药丸。
    // 现在【那一格就是那半条轴】：标签在外头，轨从标签一路铺到中间那个「现在」。
    // 选中的那半轨加粗、上墨、外头钉一根端点；没选的还是发丝一样细。
    // 走过的那半是实线、还没走的那半是虚线——跟下面每一条的竖轴是同一套话。
    // 两格都常驻：空着的那一格不藏起来，否则日历里排下来的事一进时间线就人间蒸发。
    h("div", { className: "shrink-0 px-5 pb-2 flex items-stretch", style: { gap: 7 } },
      [["past", "走过的", pastN], ["ahead", "接下来", aheadN]].map(([k, label, n], i) => {
        const on = tab === k;
        // 端点：只有选中那半才钉，钉在离「现在」最远的那一头
        const cap = h("span", { "aria-hidden": "true", style: {
          flexShrink: 0, width: 2, height: on ? 11 : 0, borderRadius: 2, background: t.ink
        } });
        const rail = h("span", { "aria-hidden": "true", style: k === "past"
          ? { flex: "1 1 0", minWidth: 8, height: on ? 2 : 1, borderRadius: 2, background: on ? t.ink : t.line }
          : { flex: "1 1 0", minWidth: 8, borderTop: (on ? 2 : 1) + "px dashed " + (on ? t.ink : t.line) } });
        const txt = h("span", { style: {
          flexShrink: 0, fontFamily: F_BODY, fontSize: on ? 12.5 : 11.5,
          color: on ? t.ink : t.fog, letterSpacing: on ? ".01em" : 0
        } }, label + (n ? " " + n : ""));
        return [
          i === 1 ? h("div", { key: "now", className: "flex items-center", style: { gap: 5, flexShrink: 0 },
            "aria-label": "现在是" + light.zh + phoneClock(now) },
            h("span", { style: { width: 5, height: 5, borderRadius: 9, background: t.ink } }),
            // 这两个字同时在解释背景那道光是哪儿来的：不写的话，底色变了没人知道为什么
            h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".06em", color: t.sub } },
              light.zh + " " + phoneClock(now))) : null,
          h("button", {
            key: k,
            onClick: () => goTab(k),
            className: "active:opacity-60 flex items-center",
            "aria-pressed": on ? "true" : "false",
            // 可点区域别低于 40px 的手感——轨只有 1-2px 高，靠这条撑起来
            style: { flex: "1 1 0", minWidth: 0, minHeight: 42, gap: 7 }
          }, k === "past" ? [cap, txt, rail] : [rail, txt, cap])
        ];
      })),
    // 只看新增
    h("div", { className: "shrink-0 px-5 pb-2 flex items-center justify-between" },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } },
        tab === "ahead"
          ? (aheadN ? characterText(char, "他日历上排下来的 ") + aheadN + " 件事" : "日历上还没有排下来的事")
          : pastN
            ? (() => { const g = pool.filter(r => r.gone).length; return "把 " + pastN + " 条痕迹按时间排在一起" + (g ? "，其中 " + g + " 条只在这儿还留着" : ""); })()
            : "还没有翻出任何东西"),
      h("div", { className: "flex items-center", style: { gap: 6 } },
        keptCount > 0 && h("button", {
          onClick: () => setMode(v => v === "keep" ? "all" : "keep"),
          className: "active:opacity-60",
          style: {
            fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", padding: "4px 11px", borderRadius: 99,
            background: mode === "keep" ? t.ink : "transparent", color: mode === "keep" ? t.bg : t.sub,
            border: "1px solid " + (mode === "keep" ? t.ink : t.line)
          }
        }, "我收着的 " + keptCount),
        poolNew > 0 && h("button", {
          onClick: () => setMode(v => v === "new" ? "all" : "new"),
          className: "active:opacity-60",
          style: {
            fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", padding: "4px 11px", borderRadius: 99,
            background: onlyNew ? TL_DOT : "transparent", color: onlyNew ? "#fff" : TL_DOT,
            border: "1px solid " + (onlyNew ? TL_DOT : "rgba(196,85,63,.4)")
          }
        }, "只看新增 " + poolNew))),
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto px-5 pb-8" },
      !shown.length && h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, textAlign: "center", padding: "56px 20px", lineHeight: 1.9 } },
        mode === "new" ? T("上次翻完之后，他手机上没有新东西。")
          : mode === "keep" ? "你还没收着什么。点开某一条，右下角有「收着」。"
          : tab === "ahead" ? T("他日历上还没有排下来的事。排了的话会出现在这儿。")
          : "先在桌面上刷一遍，这里才会有东西串起来。"),
      groups.map((g, gi) => h("div", { key: g.label + gi },
        h("div", {
          style: {
            fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".04em",
            color: t.fog, padding: "16px 0 8px 61px"
          }
        }, PTX(g.label)),
        g.rows.map((r, i) => row(r, i === 0, i === g.rows.length - 1 && gi === groups.length - 1)))),
      // 线走完最后一条不该就这么断掉——底下那一大片空白，本身也是时间的一部分。
      // 让竖轴接着往下走一小截、淡出去，收在一个空心的点上，旁边说清楚那头是什么。
      shown.length ? h("div", { className: "flex", style: { paddingLeft: 46 } },
        h("div", { style: { width: 15, flexShrink: 0, position: "relative", height: 88 } },
          h("span", { style: {
            position: "absolute", left: "50%", top: 0, bottom: 16, width: 1,
            background: "linear-gradient(180deg," + t.line + ",transparent)",
            opacity: tab === "ahead" ? .55 : 1
          } }),
          h("span", { style: { position: "absolute", left: "50%", marginLeft: -3.5, bottom: 8, width: 7, height: 7, borderRadius: 9, border: "1px solid " + t.line } })),
        h("div", { className: "flex-1 min-w-0", style: { paddingTop: 66, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", lineHeight: 1.7, color: t.fog } },
          tab === "ahead" ? characterText(char, "再往后，他日历上还没排。") : characterText(char, "再往前，他手机上没留下什么了。"))) : null),
    newCount > 0 && h("div", { className: "shrink-0 px-5", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
      h("button", {
        onClick: onMarkRead, className: "w-full py-3 active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", borderRadius: 13, border: "1px solid " + t.line, color: t.sub }
      // ⚠️这一下清的是【两格一起】的新增标记，不是当前这一格。所以不能写「这 N 条」
      // ——「走过的」里写着「只看新增 3」、按钮却说「这 10 条」，看上去像个 bug。
      }, "全部 " + newCount + " 条新的都看过了")),
    // 详情整页（no-half-sheet）：这一层是一条时间线上的东西被摊开——正文、TA当时的想法、
    // 三颗按钮，从来不是三行能说完的；也不需要同时看见底下那条轴。
    sheet && h(PhoneSubPage, {
      bg: { background: t.bg }, ink: t.ink,
      title: sheet.appZh + (sheet.tag ? " · " + sheet.tag : ""), onClose: () => setSheet(null)
    },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.5, wordBreak: "break-word" } }, PTX(sheet.title)),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 6 } },
        sheet.ts == null ? "时间不详（原文写的是「" + sheet.when + "」）" : phoneDayLabel(sheet.ts, now) + " " + phoneClock(sheet.ts)),
      sheet.text && h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.9, color: t.ink, marginTop: 16, wordBreak: "break-word" } }, PTX(sheet.text)),
      sheet.thought && h("div", {
        style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.8, color: t.sub, marginTop: 14, paddingLeft: 11, borderLeft: "2px solid " + t.line, wordBreak: "break-word" }
      }, PTX(sheet.thought)),
      // 归档里那些已经被后来的内容顶掉了，app 里点过去是空的——不给按钮，明说
      sheet.gone
        ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, marginTop: 20, lineHeight: 1.75 } },
            "这条已经被后来刷新的内容顶掉了，" + sheet.appZh + "里翻不到了，只剩时间线上这一份。")
        : h("button", {
            onClick: () => { const a2 = sheet.app; setSheet(null); onOpenApp && onOpenApp(a2); },
            className: "w-full mt-6 py-3 active:opacity-60",
            style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", borderRadius: 13, border: "1px solid " + t.line, color: t.ink }
          }, "去" + sheet.appZh + "里看"),
      // 转发那一层照旧走 onPeek，绝不因为点开就自动发出去（她 2026-08-29 被吓过一次）
      onPeek && h("button", {
        onClick: () => onPeek({ tier: "quiet", label: sheet.appZh + (sheet.tag ? " · " + sheet.tag : ""), title: sheet.title, text: sheet.text || sheet.thought }),
        className: "w-full mt-2 py-3 active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", borderRadius: 13, border: "1px solid " + t.line, color: t.ink }
      }, T("转发给 TA · 他会知道你翻了手机")),
      // 收着 ≠ 转发。转发是摆到TA面前，收着是【她自己留一份】，
      // 不进TA的上下文、不影响任何生成——只给她自己看。
      onToggleKeep && h("button", {
        onClick: () => onToggleKeep(sheet.id),
        className: "w-full mt-2 py-3 active:opacity-60",
        style: {
          fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", borderRadius: 13,
          border: "1px solid " + (isKept(sheet) ? t.ink : t.line),
          background: isKept(sheet) ? t.ink : "transparent",
          color: isKept(sheet) ? "#fff" : t.sub
        }
      }, isKept(sheet) ? "已经收着了 · 再点取消" : "收着 · 只有你看得到")));
}

// ─────────────────────────────────────────────────────────────
// 锁屏：拿起TA手机的第一眼
// ─────────────────────────────────────────────────────────────
// 一叠还没点开的通知横幅，每条只露半句——要看全文得进去。
// 通知就是 delta：上次翻完之后才出现的那些。没有新的就摆最近几条，灰着。
function phonePickLookImage(file, done) {
  if (!file || !/^image\//.test(file.type || "")) return;
  const reader = new FileReader();
  reader.onload = async () => {
    let ref = String(reader.result || "");
    if (typeof imgToVault === "function") ref = await imgToVault(ref);
    done(ref);
  };
  reader.readAsDataURL(file);
}

// 手机 · 数据：清空重生 + 这台手机里的字写哪种语言
// ─────────────────────────────────────────────────────────────
// 两件事摆一页是因为它们是同一个病的两头（她 2026-09-14）：
// 人设里的英文去掉了、手机还在写英文——语言那一档是治本的（下一轮就照新的写），
// 清空是止血的（不想等它自己走出来，就整份扔掉重生成）。
// ⚠️清空是全 App 唯一会主动删手机数据的地方，所以按之前那条事故规矩
//   （.claude/rules/never-say-delete-first.md）：确认框里必须先说「先导出一份」。
function PhoneDataSettings({ char, t, look, lang, onLang, saved, onReset, onBack }) {
  const apps = PHONE_APPS.filter(a => !a.soon && PHONE_LIVE_KEYS.indexOf(a.key) < 0);
  const tone = phoneTone("notes");
  const mode = PHONE_LANG_MODES.indexOf(lang) >= 0 ? lang : "persona";
  const LANG_SUB = {
    persona: "人设和世界书里写TA说什么，就写什么；两处都没写的写中文",
    zh: "不管TA是哪儿人，手机里的字都写中文；人名店名歌名照原样",
    native: "按TA真正生活的那个地方通行的语言写"
  };
  const row = (a, i) => {
    const has = !!saved[a.key];
    return h("div", { key: a.key, className: "flex items-center", style: { minHeight: 58, padding: "9px 13px", gap: 11, borderTop: i ? "1px solid rgba(34,31,27,.08)" : "none" } },
      h("div", { style: { width: 36, height: 36, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: phoneTone(a.key).wash, flexShrink: 0 } },
        h(PGlyph, { k: a.key, size: 18, color: phoneTone(a.key).glyph })),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink } }, a.zh),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 3 } }, has ? "存着一份" : "还没生成过")),
      has ? h("button", {
        className: "active:opacity-60 shrink-0",
        onClick: () => requestAppConfirm("清空「" + a.zh + "」？",
          characterText(char, "这个 app 里存的那一份会整份删掉（时间线上属于它的那几条也一起走），下次打开会重新生成一份全新的——他这个 app 现在的样子，只有你事先导出的那份备份里还有。\n\n") +
          "⚠️舍不得的话先去 设置 → 数据 → 导入与导出 → 导出全部数据，存成 json 放桌面上，存好了再清。",
          () => onReset && onReset(a.key), "清空"),
        style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#9f5149", padding: "6px 10px", borderRadius: 99, border: "1px solid rgba(159,81,73,.30)" }
      }, "清空") : null);
  };
  return h("div", { "data-wk": "phoneapppage", "data-part": "phonedatasettings", className: "h-full flex flex-col overflow-hidden", style: { background: phonePaper(char && char.id, look) } },
    h(Head, { zh: "手机数据", sub: (char && char.name || "TA") + " 的这一部", bg: "transparent", noLine: true, onBack }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
      h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".16em", color: t.fog, margin: "12px 2px 10px" } }, "手机里的字写哪种语言"),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.7, color: t.fog, margin: "0 2px 10px" } },
        "这一档对所有角色生效，下一次刷新开始算。它管的是【往后写出来的字】——已经存着的那些不会被改写（名册和账号改了名字就会攒成两份），想读外语的旧内容点「译」就行。"),
      h("div", { "data-wk": "block", style: { borderRadius: 20, overflow: "hidden", background: "rgba(255,255,255,.66)", border: "1px solid rgba(255,255,255,.80)" } },
        PHONE_LANG_MODES.map((k, i) => h("button", {
          key: k, onClick: () => onLang && onLang(k), className: "w-full text-left active:opacity-65",
          style: { display: "block", padding: "12px 14px", background: mode === k ? "rgba(255,255,255,.92)" : "transparent", borderTop: i ? "1px solid rgba(34,31,27,.08)" : "none" }
        }, h("div", { className: "flex items-center", style: { gap: 8 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink } }, PHONE_LANG_ZH[k]),
          mode === k ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: tone.glyph } }, "现在用这一档") : null),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.6, color: t.fog, marginTop: 4 } }, LANG_SUB[k])))),
      h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".16em", color: t.fog, margin: "24px 2px 10px" } }, "清空重生"),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.7, color: t.fog, margin: "0 2px 10px" } },
        characterText(char, "刷新不是从零开始的：旧那份会原样发回去当料，所以他这个 app 的样子会一直接着上一份走。只想让往后写的字换个语言，改上面那一档就够了；确定要连现在这一份一起不要了，才来清空——清之前先导出一份备份。")),
      h("div", { "data-wk": "block", style: { borderRadius: 22, overflow: "hidden", background: "rgba(255,255,255,.66)", border: "1px solid rgba(255,255,255,.80)" } }, apps.map(row))));
}

function PhoneLookSettings({ char, look, onPatch, onBack, t }) {
  // 桌面上「外观」「数据」那两格也能换图（她 2026-10-19：查手机这俩美化不了）；PGlyph 用它们桌面上那个图案
  const apps = PHONE_APPS.filter(a => !a.soon).concat([{ key: "__look", zh: "外观", glyph: "settings" }, { key: "__data", zh: "数据", glyph: "notes" }]);
  const tone = phoneTone("phone");
  const uploadCard = (kind, title, sub) => {
    const ref = look[kind];
    const src = phoneImage(ref);
    return h("div", {
      style: { borderRadius: 20, padding: 13, background: "rgba(255,255,255,.72)", border: "1px solid rgba(255,255,255,.82)" }
    }, h("div", { className: "flex items-center", style: { gap: 12 } },
      h("label", {
        className: "active:opacity-70",
        style: {
          width: 76, height: 104, flexShrink: 0, borderRadius: 16, overflow: "hidden", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: src ? "#ddd" : phonePaper(char && char.id, look), backgroundSize: "cover", backgroundPosition: "center",
          border: "1px solid rgba(34,31,27,.10)"
        }
      }, src ? h("img", { src, alt: "", style: { width: "100%", height: "100%", objectFit: "cover" } })
        : h(PGlyph, { k: kind === "lockWallpaper" ? "settings" : "album", size: 24, color: tone.glyph }),
      h("input", {
        type: "file", accept: "image/*", style: { display: "none" },
        onChange: e => { const el = e.target; phonePickLookImage(e.target.files && e.target.files[0], v => openWallPreview({ src: phoneImage(v) || v, kind: kind === "lockWallpaper" ? "phonelock" : "phonehome", onUse: () => onPatch({ [kind]: v }), onRepick: () => el.click() })); }
      })),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink } }, title),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.6, color: t.fog, marginTop: 4 } }, sub),
        h("div", { className: "flex items-center", style: { gap: 12, marginTop: 10 } },
          h("label", { className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: tone.glyph, cursor: "pointer" } }, ref ? "更换" : "选一张图",
            h("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const el = e.target; phonePickLookImage(e.target.files && e.target.files[0], v => openWallPreview({ src: phoneImage(v) || v, kind: kind === "lockWallpaper" ? "phonelock" : "phonehome", onUse: () => onPatch({ [kind]: v }), onRepick: () => el.click() })); } })),
          ref && h("button", { onClick: () => onPatch({ [kind]: "" }), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "恢复默认")))));
  };
  const iconPreset = look.iconPreset || "own";   // 设置页高亮的那一档也要跟默认一致，不然看着像选了「主界面彩釉」
  return h("div", { "data-wk": "phoneapppage", "data-part": "phonelooksettings", className: "h-full flex flex-col overflow-hidden", style: { background: phonePaper(char && char.id, look) } },
    h(Head, { zh: "手机外观", sub: (char && char.name || "TA") + " 的这一部", bg: "transparent", noLine: true, onBack }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
      h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".16em", color: t.fog, margin: "12px 2px 10px" } }, "壁纸"),
      h("div", { className: "grid grid-cols-2", style: { gap: 10 } }, uploadCard("lockWallpaper", "锁屏", "拿起手机第一眼"), uploadCard("homeWallpaper", "主页", "解锁后的桌面")),
      h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".16em", color: t.fog, margin: "24px 2px 10px" } }, "图标长什么样"),
      h("div", { className: "grid grid-cols-2", style: { gap: 9 } }, PHONE_ICON_PRESETS.map(p => h("button", {
        key: p.key, onClick: () => onPatch({ iconPreset: p.key }), className: "text-left active:opacity-65",
        style: { padding: 13, minHeight: 86, borderRadius: 18, background: iconPreset === p.key ? "rgba(255,255,255,.92)" : "rgba(255,255,255,.50)", border: "1.5px solid " + (iconPreset === p.key ? tone.glyph : "rgba(255,255,255,.70)") }
      }, h("div", { className: "flex items-center", style: { gap: 9 } },
        h("div", { style: { width: 34, height: 34, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: p.key === "mono" ? "#ecebe7" : p.key === "glass" ? "rgba(255,255,255,.40)" : p.key === "soft" ? "linear-gradient(rgba(255,255,255,.46),rgba(255,255,255,.46))," + tone.wash : tone.wash } }, h(PGlyph, { k: "settings", size: 17, color: p.key === "mono" ? "#4d4b47" : tone.glyph })),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, T(p.name))),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.5, marginTop: 7 } }, PTX(p.sub))))),
      h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".16em", color: t.fog, margin: "24px 2px 10px" } }, "逐个换图标"),
      h("div", { "data-wk": "block", style: { borderRadius: 22, overflow: "hidden", background: "rgba(255,255,255,.66)", border: "1px solid rgba(255,255,255,.80)" } }, apps.map((a, i) => {
        const custom = look.icons && look.icons[a.key];
        const src = phoneImage(custom);
        const at = phoneTone(a.key);
        return h("div", { key: a.key, className: "flex items-center", style: { minHeight: 62, padding: "9px 13px", gap: 11, borderTop: i ? "1px solid rgba(34,31,27,.08)" : "none" } },
          h("div", { style: { width: 40, height: 40, borderRadius: 12, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: at.wash, flexShrink: 0 } },
            src ? h("img", { src, alt: "", style: { width: "100%", height: "100%", objectFit: "cover" } }) : h(PGlyph, { k: a.glyph || a.key, size: 20, color: at.glyph })),
          h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, a.zh),
          h("label", { className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: tone.glyph, cursor: "pointer", padding: "8px 0" } }, custom ? "更换" : "自定义",
            h("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: e => phonePickLookImage(e.target.files && e.target.files[0], v => onPatch({ icons: { ...(look.icons || {}), [a.key]: v } })) })),
          custom && h("button", { onClick: () => { const icons = { ...(look.icons || {}) }; delete icons[a.key]; onPatch({ icons }); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, padding: "8px 0 8px 8px" } }, "移除"));
      })),
      h("button", { onClick: () => onPatch({ lockWallpaper: "", homeWallpaper: "", iconPreset: "", icons: {} }), className: "w-full active:opacity-60", style: { marginTop: 18, padding: 14, borderRadius: 17, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, background: "rgba(255,255,255,.48)", border: "1px solid rgba(255,255,255,.72)" } }, "恢复这一部手机的默认外观")));
}

function LockScreen({ char, t, rows, newIds, newCount, onUnlock, onOpenApp, onTimeline, look }) {
  // 锁屏上的钟照 TA 那只（虚拟时间开着时，她 2026-10-11「查手机看看能不能也跟着虚拟时间」）
  const now = new Date(char && typeof vclockMap === "function" ? vclockMap(Date.now(), char.id) : Date.now());
  const lockSrc = phoneImage(look && look.lockWallpaper);
  // 群里 2026-10-22：「char 换了我的照片，全被消息挡住了」——通知从顶上一路排到底，把锁屏壁纸整个盖住。
  //   换上照片本来就是想看的，所以有壁纸时通知【贴底排】（真机锁屏就是这样，上半屏留给图）。
  //   ⚠️「不想再看这几条」那一半不在这儿：同一轮另一处做了「× 清除」（永久划掉），别再加第二颗收起键。
  // 通知说的是【刚发生了什么】，不是日程提醒——所以还没发生的那一段不进锁屏
  // 清掉的那几条不再挡锁屏（群友 2026-10-22「锁屏的那些消息能不能不显示或者有个叉掉，char 换了我的照片全被消息挡住了」）：
  //   记的是这几条的 id，之后新来的照样出来——跟 iPhone 锁屏上清通知一个意思
  const lockKey = "x_phoneLockClear";
  const [cleared, setCleared] = useState(() => new Set(((loadJSON(lockKey, {}) || {})[char && char.id] || []).map(String)));
  const clearAll = ids => { const all = loadJSON(lockKey, {}) || {}; const next = [...new Set([...ids.map(String), ...(all[char.id] || [])])].slice(0, 2000);
    // ⚠️原来是旧的在前、新清的接在后面、再留最后 200 条：通知一多过 200（她 2026-10-27：359 条新的），
    //   刚清的那几条（排在最前面的最新几条）正好被切掉，点了跟没点一样。现在刚清的排最前、留 2000 条
    saveJSON(lockKey, { ...all, [char.id]: next }); setCleared(new Set(next)); };
  const list = (Array.isArray(rows) ? rows : []).filter(r => !r.ahead && !cleared.has(String(r.id)));
  const fresh = list.filter(r => newIds && newIds[r.id]);
  const pool = (fresh.length ? fresh : list).slice(0, 5);
  const dim = !fresh.length;
  const dow = "日一二三四五六"[now.getDay()];
  const card = r => h("button", {
    key: r.id,
    onClick: () => onOpenApp && onOpenApp(r.app),
    className: "w-full text-left active:opacity-70",
    style: {
      display: "block", padding: "11px 13px", borderRadius: 17, marginBottom: 8,
      background: dim ? "rgba(255,255,255,.42)" : "rgba(255,255,255,.72)",
      border: "1px solid rgba(255,255,255,.6)",
      backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)"
    }
  }, h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 } },
    h(PGlyph, { k: r.app, size: 12, color: "rgba(30,28,24,.55)" }),
    h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "rgba(30,28,24,.55)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.appZh + (r.tag ? " · " + r.tag : "")),
    h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(10px * var(--app-fs, 1))", color: "rgba(30,28,24,.45)" } }, r.ts == null ? "" : phoneClock(r.ts))),
  h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: "#1e1c18", lineHeight: 1.45, wordBreak: "break-word" } },
    (r.title || r.text || "").slice(0, 22) + ((r.title || r.text || "").length > 22 ? "…" : "")),
  r.text && r.title && h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "rgba(30,28,24,.6)", lineHeight: 1.55, marginTop: 2, wordBreak: "break-word" } },
    r.text.slice(0, 26) + (r.text.length > 26 ? "…" : "")));
  return h("div", { "data-wk": "phonelockpage", "data-part": "lockscreen",
    className: "h-full flex flex-col",
    style: lockSrc ? { backgroundImage: "linear-gradient(rgba(246,243,237,.22),rgba(246,243,237,.42)),url(\"" + lockSrc.replace(/\"/g, "%22") + "\")", backgroundSize: "cover", backgroundPosition: "center" }
      : { background: phonePaper(char && char.id, look) }
  },
  h("div", { className: "shrink-0 px-6", style: { paddingTop: safeTop(30) } },
    h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(12px * var(--app-fs, 1))", letterSpacing: ".2em", color: "rgba(30,28,24,.5)" } },
      (now.getMonth() + 1) + "月" + now.getDate() + "日 星期" + dow),
    h("div", { style: { fontFamily: "'Archivo',sans-serif", fontWeight: 300, fontSize: "calc(68px * var(--app-fs, 1))", lineHeight: 1.06, color: "#1e1c18", marginTop: 2 } },
      String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0")),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "rgba(30,28,24,.55)", marginTop: 6 } },
      (char && char.name || "TA") + " 的手机" + (newCount > 0 ? " · " + newCount + " 条新的" : ""))),
  h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pt-5",
    style: lockSrc ? { display: "flex", flexDirection: "column", justifyContent: "flex-end" } : null },
    !pool.length && h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "rgba(30,28,24,.5)", textAlign: "center", padding: "40px 20px", lineHeight: 1.9 } },
      cleared.size ? "" : "锁屏上什么都没有。解锁进去刷一遍吧。"),
    pool.length ? h("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 6 } },
      h("button", { "data-wk": "phonelockclear", onClick: () => clearAll(list.map(r => r.id)), "aria-label": "清除锁屏通知", className: "active:opacity-60",
        style: { minHeight: 32, padding: "0 12px", borderRadius: 999, background: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.6)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "rgba(30,28,24,.7)" } }, "× 清除")) : null,
    pool.map(card),
    pool.length > 0 && newCount > pool.length && h("button", {
      onClick: onTimeline, className: "w-full active:opacity-60",
      style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "rgba(30,28,24,.6)", padding: "6px 0 2px" }
    }, "还有 " + (newCount - pool.length) + " 条 · 全部看")),
  h("div", { className: "shrink-0 px-6", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
    h("button", {
      onClick: onUnlock, className: "w-full active:opacity-60",
      style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "rgba(30,28,24,.62)", padding: "16px 0 10px" }
    }, T("解锁 · 进他的桌面"))));
}



function WechatNavIcon({ kind, active }) {
  const color = active ? "#07c160" : "#777";
  const common = { fill: "none", stroke: color, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = kind === "chats" ? [h("path", { ...common, d: "M4 5.5h16v11H9l-4.5 3 .9-3H4z" }), h("circle", { cx: 8, cy: 11, r: .7, fill: color }), h("circle", { cx: 12, cy: 11, r: .7, fill: color }), h("circle", { cx: 16, cy: 11, r: .7, fill: color })]
    : kind === "contacts" ? [h("circle", { ...common, cx: 12, cy: 7.2, r: 3.2 }), h("path", { ...common, d: "M5 20c.5-4.4 3-6.7 7-6.7s6.5 2.3 7 6.7" })]
    : kind === "moments" ? [h("circle", { ...common, cx: 12, cy: 12, r: 8 }), h("circle", { ...common, cx: 12, cy: 12, r: 3.2 }), h("path", { ...common, d: "M12 4v4M12 16v4M4 12h4M16 12h4" })]
    : [h("circle", { ...common, cx: 12, cy: 8, r: 3.4 }), h("path", { ...common, d: "M5.5 20c.7-4.3 3-6.4 6.5-6.4s5.8 2.1 6.5 6.4" })];
  return h("svg", { width: 24, height: 24, viewBox: "0 0 24 24" }, ...paths);
}

// 查手机微信里的照片：跟主聊天同一份图（她发的走 imageRef，TA拍的在 IndexedDB 里按 imgKey 取）。
//   图还没取出来/取不到，就退回那张写着描述的小卡。
function PeekPhotoMsg({ m }) {
  const idb = typeof useIdbImgUrl === "function" ? useIdbImgUrl(m.imageRef ? null : m.imgKey) : null;
  const src = m.imageRef ? (typeof resolveImg === "function" ? resolveImg(m.imageRef) : m.imageRef) : idb;
  if (!src) return h("div", { "data-wk": "pcard", "data-label": m.label, style: { width: 210, borderRadius: 6, background: "#fff", padding: "10px 12px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.5, color: "#171717" } }, m.body || m.label);
  return h("img", { "data-wk": "pphoto", src: src, alt: m.body || "照片", style: { display: "block", maxWidth: 160, maxHeight: 220, borderRadius: 6, objectFit: "cover", background: "#ddd" } });
}
function WeChatViewFull({ d, char, t, profile, onBack, onRefresh, refreshing, drive, onSendAs, onTransferAs, onTfReplyAs, onShopAs, transferPeers, sendAsWaiting, onRemark, onDelFriend, onDissolve, onBlockFriend }) {
  // 情头跟着进他手机（群友 2026-10-26）：他在聊天里换的头像（chatAvatar）就是他微信头像，
  //   给你换的那张（myChatAvatar）就是他微信里你的头像；没换过就照旧档案那张、你资料那张
  const selfFace = typeof chatFace === "function" ? chatFace(char) : char;
  const herAv = (char && char.myChatAvatar) || (profile && profile.avatarImage);
  const [tab, setTab] = useState("chats");
  const [thread, setThread] = useState(null);
  // 她改TA通讯录里的备注（她 2026-10-07）：null＝没在改，字符串＝正在改的草稿
  const [remarkDraft, setRemarkDraft] = useState(null);
  // ── 她自己在TA手机上打的那一句（她 2026-09-14）──────────────────────────
  //   只给【真实会话】：她建的旁观群、有TA的群、她跟TA的私聊——这些在她那头本来就有记录。
  //   推演出来的那几条会话没有这个口子（那是手机数据，不是聊天记录）。
  //   气泡本身就是回执：发出去那一下它立刻出现在这一屏上，所以这儿不另做「发送中」的状态。
  const [asDraft, setAsDraft] = useState("");
  // ── 「看TA玩」在开着的时候，这一屏由外面那串动作驱动（js/phone-watch.js）──
  // ⚠️不另做一份「TA的微信」：TA操作的就是她平时翻的这一屏，这才是这个玩法成立的地方。
  //   所以只加一条同步——drive 变了就把内部状态搬过去，drive 不在时一个像素都没变。
  const driveTab = drive && drive.tab, driveChat = drive && drive.item;
  // ⚠️她 2026-09-10 报的两条：「发微信不会显示屏幕最底下，发出去的动画也没有」。
  //   ① 新气泡加进去之后没人把这一屏滚下去——新消息挂在看不见的地方，等于没发。
  //   ② 那条气泡是【凭空出现】的，没有真手机上「冒出来」的那一下。
  const threadRef = useRef(null);
  const driveCount = drive ? (drive.sent || []).length : 0;
  // 真聊天那几条是活的：她替他发出去的、对面刚回的，都会让这个数变大。
  // 不跟着它滚的话，新气泡挂在看不见的地方——跟「发出去没反应」一个样。
  const actualCount = (Array.isArray(d && d.actualChats) ? d.actualChats : [])
    .reduce((n, c) => n + (((c && c.messages) || []).length), 0);
  useEffect(() => {
    if (!threadRef.current) return;
    const el = threadRef.current;
    // 两拍：这一帧 React 刚把气泡插进去，下一帧才量得到新的 scrollHeight
    const toEnd = () => { el.scrollTop = el.scrollHeight; };
    requestAnimationFrame(() => requestAnimationFrame(toEnd));
    // 表情包是图，图是后到的：它一落地整条就变高，刚才那一下就白滚了。
    // ⚠️只在【她还贴着底】的时候补这一下——她要是已经往上翻了，不许把她拽回来。
    const tid = setTimeout(() => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) toEnd();
    }, 320);
    return () => clearTimeout(tid);
    // ⚠️thread 也要在这串里（她 2026-09-15：「点进去不是聊天框最下面，返回聊天
    //   也是到屏幕中间」）。原来只认「看TA玩」那几个量和消息条数——
    //   她自己点开一条会话时这个 effect 根本不跑，于是停在浏览器给的那个位置。
    //   真微信点进任何一条对话，都是停在最后一句上。
  }, [driveCount, driveChat, actualCount, sendAsWaiting, thread && thread.id, thread && thread.name]);
  useEffect(() => { if (drive && driveTab) setTab(driveTab); }, [driveTab]);
  useEffect(() => {
    if (!drive) return;
    if (!driveChat) { setThread(null); return; }
    // chats 在下面才算出来，但 effect 是渲染完才跑的，这时候它已经有值了
    const hit = watchPick(chats, driveChat, c => c && c.name);
    if (hit) setThread(hit);
  }, [driveChat]);
  useEffect(() => { setAsDraft(""); }, [thread && thread.id]);
  const [publicPage, setPublicPage] = useState(false);
  const [article, setArticle] = useState(null);
  const arr = a => Array.isArray(a) ? a : [];
  // ⚠️她和这个角色一条消息都没聊过时，TA手机里【压根没有跟她的那条对话】：
  //   真聊天是从消息里长出来的（app.js phoneWechatActual：direct.length 才 push），
  //   而模型推演出来的那条又会被下面 meLike 那道闸滤掉（不然TA手机里会有两条跟她的）。
  //   于是「看TA玩」里TA想点开她也点不着，屏幕上一声不响——她 2026-09-12 点名的那个 bug。
  //   补一条空的：名字、头像都在，里头还没有话。TA在里头打一句发出去就是**真发到她手机上**
  //   （watchSend 那条路一个字没动），真聊天当场长出来，下一帧 actual 自己顶上来。
  const actual0 = arr(d.actualChats);
  const meRow = { id: "actual:private:" + char.id, type: "private", name: userName(profile),
    avatarImage: herAv, time: "", last: "", ts: 0, messages: [], _empty: 1 };
  const hasMe = actual0.some(c => c && c.type !== "group"
    && (typeof phoneSamePerson === "function" ? phoneSamePerson(c.name, meRow.name) : String(c.name || "").trim() === meRow.name));
  const actual = (hasMe || !meRow.name) ? actual0 : actual0.concat([meRow]);
  // ⚠️她 2026-09-10：「我发睡了吗TA回了，我查手机，然后就一直被固定住在那儿了，
  //   下次再聊几轮进去都不会显示，除非我再刷一次微信。」
  //   病根：模型刷新时会照着【TA给她的备注】另造一条跟她的私聊（「小笨蛋」），
  //   而避重名单里只有她的本名——于是TA手机里有两条跟她的对话：
  //   一条是真的（活的），一条是推演出来的（永远停在刷新那一刻）。她点开的是后面那条。
  //   落盘那头也补了（phoneTakenNames 收下备注），但已经存着的那些得在这儿挡住，
  //   否则她得再刷一次微信才好——那正是她说的「除非我再刷一次」。
  const meLike = [userName(profile), profile && profile.name,
    (d.userContact && d.userContact.remark), (d.userContact && d.userContact.name)]
    .concat(actual.filter(c => c && c.type !== "group").map(c => c && c.name))
    .map(x => String(x || "").trim()).filter(Boolean);
  const generated = arr(d.chats).filter(c => !(c && c.type !== "group"
    && meLike.some(n => (typeof phoneSamePerson === "function" ? phoneSamePerson(c.name, n) : String(c.name || "").trim() === n))));
  // ⚠️显示这一端也要按时间排。存的那一端（phoneGrowList）v59.41 起会排，
  // 但那只在【刷新时】发生——已经存着的那份还是乱的，她得等下一次刷新才看得对。
  // 会话列表乱序是一眼就假的：今天下午那条掉在前天下面，微信不会长这样。
  // 认得出时刻的按新→旧，认不出的沉底、彼此保持原来的先后（跟存那一端同一条规矩）。
  // 真实互通的那几条永远在最前面——那是她跟TA此刻正在说的话，不跟推演出来的比时间。
  const byWhen = list => {
    const known = [], unknown = [];
    list.forEach(x => (x && typeof x === "object" && x._ts != null ? known : unknown).push(x));
    known.sort((a, b) => b._ts - a._ts);
    return known.concat(unknown);
  };
  // 同名的会话只摆一个（群友 2026-10-21 截图：NXX调查组、26课题组各摆了三个）：真聊天那个优先，推演里同名的不再摆；
  //   推演自己重复的，留最新那个。认名字去掉空格和括号
  const _chn = v => String(v == null ? "" : v).replace(/[\s（）()「」【】·]/g, "");
  const _seenChat = new Set(actual.map(c => _chn(c && c.name)));
  const chats = [...actual, ...byWhen(generated).filter(c => { const k = _chn(c && c.name); if (!k || _seenChat.has(k)) return false; _seenChat.add(k); return true; })];
  // ⚠️thread 存的是【点开那一刻的那个对象】，是一张快照。真聊天那几条是活的
  //   （actual 每次渲染都从最新的消息重算），可快照不会跟着长——于是她在聊天里
  //   刚说的话、TA刚回的那条，在TA手机上要退出去再点进来才看得见
  //   （她 2026-09-10：「微信消息能不能做实时联动……而不是只有刷新才有」）。
  //   所以每一帧都按名字把它认回来：认名字走公共那条规矩。
  const liveThread = thread ? (watchPick(chats, thread.name, c => c && c.name) || thread) : null;
  const meName = userName(profile);
  const selfNames = new Set([char.name, d.me && d.me.wechatName, "我", "本人"].filter(Boolean));
  // 联系人的脸（群里 2026-10-17 许愿）：她给这一位换过的那张 → 同名的配角／角色那张 → 没有就是色块
  const [, bumpFace] = useState(0);
  const faceOf = name => (typeof window !== "undefined" && typeof window.__phoneFaceOf === "function") ? window.__phoneFaceOf(char && char.id, name) : null;
  const person = (name, avatarImage) => ({ name: name || "?", avatarImage: faceOf(name) || avatarImage, color: strColor(name) });
  const avatarForMessage = (m, c) => m.avatarImage || (selfNames.has(m.from) ? selfFace.avatarImage : m.from === meName ? herAv : c.avatarImage);
  // ⚠️查手机里这些内层 app【不换成公共 Head】：它们扮的是真手机上的微信、便签、相册……
  //   换成这个 app 自己的标题栏，扮演就散了（界面装修工单：「判据在这一处是反过来的」）。
  //   挂点还是要有——只加属性，长相一个像素没动。
  const innerHead = (title, sub, back) => h("div", { "data-wk": "head", className: "shrink-0 flex items-center gap-3 px-4 pb-3", style: { paddingTop: safeTop(16), borderBottom: `1px solid ${t.line}`, background: "rgba(248,247,243,.96)" } }, h("button", { onClick: back, "aria-label": "返回", "data-watch": "back", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -10, flexShrink: 0 } },
    // 本尊那根细尖角照旧，但它得是画出来的，而且要有 40px 可点区
    // （mobile-ui-layout §1；原来是一个 26px 的「‹」字符，点击区只有那几个像素）
    h("svg", { width: 11, height: 20, viewBox: "0 0 11 20", "aria-hidden": "true" },
      h("path", { d: "M9 1.5 2 10l7 8.5", fill: "none", stroke: t.ink, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }))), h("div", { className: "flex-1 min-w-0 text-center", style: { paddingRight: 24 } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" } }, title), sub && h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: t.fog } }, sub)));
  // 「看TA玩」里TA刚打出去的那几条：先挂在这一屏上，落盘那一头照旧走 savePhoneApp
  // ⚠️认名字必须走公共那份（watchSame）。这两行原来是严格等号：模型把会话名写成
  //   「《长夜》」而聊天叫「长夜」时，上面那个 effect 会正常打开聊天（它用的是 watchSame），
  //   可输入框和TA发出去的气泡一个都不显示——屏幕上就是「点开了，然后什么也没发生」。
  const driveOn = !!(drive && drive.item && thread && watchSame(thread.name, drive.item));
  const th = liveThread || thread;
  // ⚠️落盘是同步的，数据那一头下一帧就有了；再挂一条演出气泡就是同一句话两遍。
  //   去重收在 PhoneWatch.dropEchoBubbles 一处（微信和短信两屏共用）。
  const driveSent0 = driveOn ? arr(drive.sent) : [];
  const driveSent = (typeof window !== "undefined" && window.PhoneWatch && window.PhoneWatch.dropEchoBubbles)
    ? window.PhoneWatch.dropEchoBubbles((liveThread || {}).messages, driveSent0) : driveSent0;
  const driveTyping = driveOn && drive.typing != null ? String(drive.typing || "") : null;
  // 真实会话才给她这条口子：id 以 actual: 开头的那几条（app.js phoneWechatActual 长出来的），
  // 判据只写在【id 前缀】这一处，落盘那头（phoneSendAs）再照同一条判一次。
  // 群里那一枪跑着的时候，末尾挂三个点。私聊那一条不挂：她自己的回话由她自己说，没人在打字。
  // 删掉的好友（她 2026-10-22「做吧」）：名单只存在这台手机的 x_phoneWxDel 里，刷新不会把人放回来
  const [delTick, bumpDel] = useState(0);
  const delSet = new Set(((loadJSON("x_phoneWxDel", {}) || {})[char.id] || []));   // delTick 变了就重读
  const isDel = nm => delSet.has(String(nm || "").trim());
  // 解散掉的群（2026-10-22 她「搞个解散群聊吧」）：同一个道理，存 x_phoneWxGone
  const goneSet = new Set(((loadJSON("x_phoneWxGone", {}) || {})[char.id] || []));
  const isGone = nm => goneSet.has(String(nm || "").trim());
  // 拉黑（她 2026-10-22「不能单独搞个拉黑嘛」）：人还在通讯录里，只是他收不到对方的消息。存 x_phoneWxBlock，跟上面两样同一个口子（app.js 的 PHONE_WX_MARKS）
  const blockSet = new Set(((loadJSON("x_phoneWxBlock", {}) || {})[char.id] || []));
  const isBlk = nm => blockSet.has(String(nm || "").trim());
  const asWaiting = !!(th && sendAsWaiting && sendAsWaiting === (th.id || "fake:" + th.name));
  const asCanSend = !!(onSendAs && th && String(th.id || "").indexOf("actual:") === 0 && th.type !== "contact");
  // 刷新编出来的私聊也能发（2026-10-22）：对面那个人照这段聊天接话；删了的好友发不了
  const asFake = !!(onSendAs && th && String(th.id || "").indexOf("actual:") !== 0 && ((th.type === "group" && !isGone(th.name)) || (th.type === "private" && !isDel(th.name))));
  const asCanType = asCanSend || asFake;
  // 拿他手机转账那一小块（群友 2026-10-13）：点「转账」展开金额、留言，群里再挑转给谁
  // 「＋」展开（她 2026-10-13「跟聊天一样搞个加号」）：null 收着 / "menu" 一排功能 / "tf" 转账；购物、外卖直接开那两页（花他的钱）
  const [plus, setPlus] = useState(null);
  // 红包（她 2026-10-25「查手机加号里也加个红包」）：跟转账同一块输入，多一个「几个」，群里点名就是专属红包
  const rpOpen = plus === "rp";
  const tfOpen = plus === "tf" || rpOpen;
  const [rpCount, setRpCount] = useState("");
  const [tfAmt, setTfAmt] = useState(""), [tfNote, setTfNote] = useState(""), [tfTo, setTfTo] = useState("");
  const tfPeers = tfOpen && th && th.type === "group" && transferPeers ? transferPeers(th) : [];
  const tfSend = () => {
    if (!onTransferAs || !th) return;
    if (th.type === "group" && !tfTo && !rpOpen) return;
    if (onTransferAs(th, tfAmt, tfNote, tfTo, rpOpen ? { packet: true, count: Number(rpCount) || 0 } : null) === false) return;
    setPlus(null); setTfAmt(""); setTfNote(""); setTfTo(""); setRpCount("");
  };
  const canBuy = !!(onShopAs && th && th.type !== "group");
  const asSend = () => {
    const body = asDraft.trim();
    if (!body || !asCanType) return;
    if (onSendAs(th, body) === false) return;
    setAsDraft("");
    // 刚发出去那条在看不见的地方＝等于没发（她 2026-09-10 报过同一个毛病）
    requestAnimationFrame(() => requestAnimationFrame(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; }));
  };
  if (thread && thread.type !== "contact") return h("div", { className: "h-full min-h-0 flex flex-col", "data-wk": "papp", "data-app": "wechat", style: { background: "#ededed" } }, innerHead(th.name, th.type === "group" ? "群聊" : null, () => setThread(null)),
    // 推演出来的群能解散（她拿他的手机）：解散了就停在那儿，聊天记录还在，发不了；点「恢复」撤回
    !drive && onDissolve && th.type === "group" && String(th.id || "").indexOf("actual:") !== 0 ? h("div", { "data-wk": "pdissolve", "data-on": isGone(th.name) ? "1" : "0", className: "shrink-0 flex items-center justify-end", style: { gap: 10, padding: "6px 14px", background: "#f2f2f2", borderBottom: "1px solid #e4e4e4", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } },
      isGone(th.name) ? h("span", { style: { flex: 1, color: "#999" } }, "这个群已经被解散了") : null,
      h("button", { className: "active:opacity-60", style: { color: isGone(th.name) ? "#07c160" : "#fa5151" },
        onClick: () => isGone(th.name) ? (onDissolve(char, th.name, true), bumpDel(x => x + 1))
          : requestAppConfirm("解散这个群？", "以 " + char.name + " 的名义解散「" + th.name + "」。聊天记录还在，这里随时能恢复；" + char.name + " 下次说话时会发现。", () => { onDissolve(char, th.name, false); bumpDel(x => x + 1); }, "解散") },
        isGone(th.name) ? "恢复" : "解散这个群")) : null,h("div", { ref: threadRef, "data-wk": "pdetail", "data-watch": "thread", className: "flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4" }, arr(th.messages).concat(driveSent).map((m, i) => {
    const self = selfNames.has(m.from);
    // 表情包不套气泡：真微信里表情就是光秃秃一张图（走公共那份 EmoteBubble，
    // 跟主聊天同一颗——她 2026-09-15 要的「渲染成聊天真发了的表情包」）
    // 转账卡：微信那种橙色卡。她转给TA、还挂着的那一笔，TA手机上这张卡能替TA点「收下 / 退回」
    const tfWait = m.kind === "transfer" && m.dir === "toChar" && m.status === "pending" && !drive && !!onTfReplyAs && th.type !== "group";
    const body = (m.kind === "emote" && m.url)
      ? h("div", { style: { animation: m._new ? "wkpop .26s cubic-bezier(.2,1.5,.4,1) both" : undefined } },
          h(EmoteBubble, { url: m.url, keyword: m.keyword, max: 108 }))
      : m.kind === "voice" ? h("div", { "data-wk": "pvoice", style: { padding: "9px 11px", borderRadius: 5, fontFamily: F_BODY, background: self ? "#95ec69" : "#fff", boxShadow: "0 1px 1px rgba(0,0,0,.05)", minWidth: Math.min(200, 70 + (m.dur || 1) * 4) } },
          h("div", { className: "flex items-center", style: { gap: 6, flexDirection: self ? "row-reverse" : "row", fontSize: "calc(14px * var(--app-fs, 1))", color: "#171717" } },
            h(Svg, { size: 18, color: "#171717", sw: 1.8 }, h("path", { d: self ? "M15 8a5 5 0 010 8M18 5a9 9 0 010 14" : "M9 8a5 5 0 000 8M6 5a9 9 0 000 14" })), (m.dur || 1) + "″"),
          m.body ? h("div", { style: { marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(0,0,0,.08)", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.5, color: "#555" } }, PTX(m.body)) : null)
      : m.kind === "card" && (m.imageRef || m.imgKey) ? h(PeekPhotoMsg, { m: m })
      : m.kind === "card" ? h("div", { "data-wk": "pcard", "data-label": m.label, style: { width: 210, borderRadius: 6, overflow: "hidden", background: "#fff", boxShadow: "0 1px 1px rgba(0,0,0,.05)", fontFamily: F_BODY } },
          h("div", { style: { padding: "10px 12px", fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.5, color: "#171717", minHeight: 22 } }, m.body ? PTX(m.body) : m.label),
          h("div", { style: { padding: "4px 12px 6px", fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#9a9a9a", borderTop: "1px solid #eee" } }, PTX(m.label)))
      : m.kind === "transfer" ? h("div", { "data-wk": "ptfcard", "data-status": m.status, "data-packet": m.packet ? "1" : "0", style: { width: 210, borderRadius: 6, overflow: "hidden", background: m.packet ? (m.status === "pending" ? "#f35543" : "#f5a99f") : m.status === "pending" ? "#fa9d3b" : "#fbd3a7", color: "#fff", fontFamily: F_BODY } },
          h("div", { className: "flex items-center", style: { gap: 10, padding: "11px 12px" } },
            h(Svg, { size: 30, color: "#fff", sw: 1.6 }, h("path", { d: "M7 4h10l3 4H4z" }), h("rect", { x: 4, y: 8, width: 16, height: 12, rx: 1.5 }), h("path", { d: "M9 12l3 3 3-3M12 15v-3" })),
            h("div", { className: "min-w-0" },
              h("div", { style: { fontSize: "calc(15.5px * var(--app-fs, 1))", fontWeight: 600 } }, m.packet ? (m.note || "恭喜发财，大吉大利") : "¥" + (Number(m.amount) || 0).toFixed(2)),
              h("div", { style: { fontSize: "calc(11.5px * var(--app-fs, 1))", opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                m.packet ? (m.status === "accepted" ? "已被领取 ¥" + (Number(m.amount) || 0).toFixed(2) : m.status === "returned" ? "已退回" : self ? "等对方拆开" : "领取红包") : m.status === "accepted" ? "已收款" : m.status === "returned" || m.status === "rejected" ? "已退还" : (m.note || (self ? "等对方收款" : "请收款"))))),
          tfWait ? h("div", { className: "flex", style: { borderTop: "1px solid rgba(255,255,255,.35)" } },
            [["no", "退回"], ["ok", m.packet ? "替" + char.name + "拆开" : "替" + char.name + "收下"]].map(([k, zh]) => h("button", { key: k, "data-wk": "ptfbtn", "data-part": k, onClick: () => onTfReplyAs(m.tid, k === "ok"), className: "flex-1 active:opacity-60", style: { padding: "8px 0", fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#fff", fontWeight: k === "ok" ? 600 : 400 } }, zh)))
            : h("div", { style: { padding: "4px 12px 6px", fontSize: "calc(10.5px * var(--app-fs, 1))", opacity: 0.85, borderTop: "1px solid rgba(255,255,255,.3)" } }, "转账"))
      : h("div", { "data-wk": "pbubble", "data-me": self ? "1" : "0", style: { position: "relative", padding: "9px 11px", borderRadius: 5, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.55, color: "#171717", background: self ? "#95ec69" : "#fff", boxShadow: "0 1px 1px rgba(0,0,0,.05)", animation: m._new ? "wkpop .26s cubic-bezier(.2,1.5,.4,1) both" : undefined } }, PTX(m.text));
    // 一批新话的开头画一条时间线（真微信隔一阵就有一行灰字时间）。没打过 _at 的老消息不画。
    const prevM = i > 0 ? arr(th.messages).concat(driveSent)[i - 1] : null;
    // 隔十分钟以上才画一条（她替他发一句、对面回一句，不该各冒一行）；不是今天的，模型给的「14:20」前面补上日子
    //   （群里 2026-10-23：「日期过了好几天那个时间戳能不能显示出来」）
    const batchLine = (m && m._at && (!prevM || !prevM._at || Math.abs(m._at - prevM._at) > 10 * 60000))
      ? h("div", { key: "t" + i, className: "text-center", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#a3a3a3", margin: "4px 0 -4px" } },
          (function (d) {
            const md = (d.getMonth() + 1) + "月" + d.getDate() + "日";
            const hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
            const lb = String(m._atLabel || "");
            if (!lb) return md + " " + hm;
            return d.toDateString() === new Date().toDateString() || /月|日|昨|前天|周|星期/.test(lb) ? lb : md + " " + lb;
          })(new Date(m._at)))
      : null;
    const row = h("div", { key: i, className: "flex items-start gap-2 " + (self ? "flex-row-reverse" : "") }, h(Avatar, { character: person(m.from, avatarForMessage(m, th)), size: 37, radius: 7 }), h("div", { style: { maxWidth: "72%" } }, thread.type === "group" && !self && h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: "#888", margin: "0 4px 3px" } }, PTX(m.from)), body));
    return batchLine ? h(React.Fragment, { key: i }, batchLine, row) : row;
  }),
    // 她替他发完、群里那一枪正在跑：屏幕上得看得见（她 2026-09-15）。
    // ⚠️这一颗跟主聊天那三个点是同一份（components.js 的 TypingDots），
    //   只有外面那层气泡换成微信的皮（白底、5 圆角）。
    asWaiting ? h("div", { key: "asw", className: "flex items-start gap-2" },
      h(Avatar, { character: person(th.name, th.avatarImage), size: 37, radius: 7 }),
      h("div", { role: "status", "aria-label": "对面正在回复",
        style: { padding: "11px 13px", borderRadius: 5, background: "#fff", boxShadow: "0 1px 1px rgba(0,0,0,.05)" } },
        h(TypingDots, { color: "#9a9a9a" }))) : null),
    // 她自己打的那一栏：只在【没在看TA玩】时出现。真实会话照旧；推演出来的私聊（2026-10-22 起）也给，
    //   对面由模型照这段聊天接话（app.js phoneSendAsFake）；推演出来的群也给（2026-10-22 她「群聊也开了吧」），群里的人接。删掉的好友不给。
    // ⚠️「按了没反应的按钮比没有按钮更糟」：给了就得真有人回。
    !drive && asCanSend && plus === "menu" ? h("div", { "data-wk": "pplus", className: "shrink-0 flex", style: { gap: 18, padding: "14px 18px 8px", background: "#f7f7f7", borderTop: "1px solid #dcdcdc" } },
      [onTransferAs ? ["tf", "转账", [h("rect", { key: 1, x: 3, y: 6, width: 18, height: 13, rx: 2 }), h("path", { key: 2, d: "M9 9.5l3 3.5 3-3.5M12 13v4M9.5 14h5" })]] : null,
       onTransferAs ? ["rp", "红包", [h("rect", { key: 1, x: 5, y: 3, width: 14, height: 18, rx: 2 }), h("path", { key: 2, d: "M5 8.5c4 2.5 10 2.5 14 0" }), h("circle", { key: 3, cx: 12, cy: 11, r: 1.8 })]] : null,
       canBuy ? ["shop", "购物", [h("path", { key: 1, d: "M5 8h14l-1.2 12H6.2z" }), h("path", { key: 2, d: "M9 10V6.5a3 3 0 016 0V10" })]] : null,
       canBuy ? ["takeout", "外卖", [h("path", { key: 1, d: "M4 11h16a8 8 0 01-16 0z" }), h("path", { key: 2, d: "M3 11h18M9 7c0-1 1-1.5 1-2.5M13 7c0-1 1-1.5 1-2.5" })]] : null].filter(Boolean).map(([k, zh, ic]) => h("button", { key: k, "data-wk": "pplusitem", "data-part": k,
        onClick: () => { if (k === "tf" || k === "rp") setPlus(k); else { setPlus(null); onShopAs(k); } }, className: "flex flex-col items-center active:opacity-60", style: { gap: 5, minWidth: 56 } },
        h("div", { style: { width: 52, height: 52, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" } }, h(Svg, { size: 24, color: "#555", sw: 1.6 }, ic)),
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#666" } }, zh)))) : null,
    !drive && asCanSend && tfOpen ? h("div", { "data-wk": "ptransfer", className: "shrink-0", style: { padding: "10px 12px 4px", background: "#f7f7f7", borderTop: "1px solid #dcdcdc" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#888", marginBottom: 6 } }, rpOpen ? (th.type === "group" ? "以" + char.name + "的名义在群里发红包（点一个人就是只给他的专属红包，不点就大家抢）" : "以" + char.name + "的名义给你发个红包，拆开前看不到多少") : th.type === "group" ? "从" + char.name + "的钱包转给群里的谁" : "从" + char.name + "的钱包转给你，回到聊天里点收下才到账"),
      tfPeers.length ? h("div", { className: "flex flex-wrap", style: { gap: 6, marginBottom: 8 } }, tfPeers.map(p => h("button", { key: p.id, onClick: () => setTfTo(rpOpen && tfTo === p.id ? "" : p.id),
        style: { minHeight: 34, padding: "0 12px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid " + (tfTo === p.id ? "#07c160" : "#dcdcdc"), background: tfTo === p.id ? "#07c160" : "#fff", color: tfTo === p.id ? "#fff" : "#333" } }, PTX(p.name)))) : null,
      h("div", { className: "flex items-center gap-2" },
        rpOpen && th.type === "group" && !tfTo ? h("input", { "data-wk": "input", value: rpCount, onChange: e => setRpCount(e.target.value.replace(/[^\d]/g, "").slice(0, 2)), inputMode: "numeric", placeholder: "几个",
          style: { width: 56, minHeight: 40, borderRadius: 5, border: "1px solid #e0e0e0", background: "#fff", padding: "0 8px", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", outline: "none" } }) : null,
        h("input", { "data-wk": "input", value: tfAmt, onChange: e => setTfAmt(e.target.value.replace(/[^\d.]/g, "")), inputMode: "decimal", placeholder: "金额",
          style: { width: 96, minHeight: 40, borderRadius: 5, border: "1px solid #e0e0e0", background: "#fff", padding: "0 10px", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", outline: "none" } }),
        h("input", { "data-wk": "input", value: tfNote, onChange: e => setTfNote(e.target.value), maxLength: 40, placeholder: rpOpen ? "写在红包上的一句（可不填）" : "留言（可不填）",
          style: { flex: 1, minWidth: 0, minHeight: 40, borderRadius: 5, border: "1px solid #e0e0e0", background: "#fff", padding: "0 10px", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", outline: "none" } }),
        h("button", { onClick: tfSend, disabled: !(Number(tfAmt) > 0) || (th.type === "group" && !tfTo && !rpOpen),
          style: { flexShrink: 0, minHeight: 40, borderRadius: 5, padding: "0 14px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: "#fff", background: (Number(tfAmt) > 0 && (th.type !== "group" || tfTo || rpOpen)) ? (rpOpen ? "#d9443a" : "#f0a020") : "#ddd" } }, rpOpen ? "塞钱进红包" : "转账"))) : null,
    !drive && th && ((th.type === "private" && isDel(th.name)) || (th.type === "group" && isGone(th.name) && String(th.id || "").indexOf("actual:") !== 0)) ? h("div", { "data-wk": "pdelnote", className: "shrink-0", style: { padding: "12px 14px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 12px)", background: "#f7f7f7", borderTop: "1px solid #dcdcdc", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#999", textAlign: "center" } }, th.type === "group" ? "群已经解散了，点上面「恢复」才能发" : "已经不是好友了，去通讯录点开 TA 加回来才能发") : null,
    !drive && asCanType ? h("div", { className: "shrink-0 flex items-end gap-2", style: { padding: "8px 10px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 8px)", background: "#f7f7f7", borderTop: "1px solid #dcdcdc" } },
      asCanSend && (onTransferAs || canBuy) ? h("button", { "data-wk": "pbtn", "data-part": "plus", onClick: () => setPlus(v => v ? null : "menu"), "aria-label": "更多",
        style: { flexShrink: 0, width: 40, height: 40, borderRadius: 999, border: "1.5px solid #444", color: "#444", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", transform: plus ? "rotate(45deg)" : "none", transition: "transform .15s" } },
        h("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" }, h("path", { d: "M12 5v14M5 12h14" }))) : null,
      h("textarea", { "data-wk": "pinput", value: asDraft, onChange: e => setAsDraft(e.target.value), rows: 1,
        placeholder: "以" + char.name + "的身份发一条",
        onKeyDown: e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); asSend(); } },
        className: "flex-1 min-w-0 resize-none",
        style: { minHeight: 36, maxHeight: 96, borderRadius: 5, background: "#fff", border: "1px solid #e0e0e0", padding: "8px 10px", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.5, color: "#171717", outline: "none" } }),
      h("button", { "data-wk": "pbtn", "data-part": "send", onClick: asSend, disabled: !asDraft.trim(),
        style: { flexShrink: 0, minHeight: 36, borderRadius: 5, padding: "8px 14px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: asDraft.trim() ? "#fff" : "#9a9a9a", background: asDraft.trim() ? "#07c160" : "#e6e6e6" } }, "发送")) : null,
    // TA正在打字的那一栏：只在「看TA玩」里出现（那会儿她自己那一栏收起来，屏幕上只有TA的手）。
    // 光标那一竖是 CSS 动画，逐字出现由外面那串动作控制。
    driveTyping != null ? h("div", { "data-wk": "pinput", "data-watch": "input", className: "shrink-0 flex items-end gap-2", style: { padding: "8px 10px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 8px)", background: "#f7f7f7", borderTop: "1px solid #dcdcdc" } },
      h("div", { "data-wk": "block", className: "flex-1 min-w-0", style: { minHeight: 36, borderRadius: 5, background: "#fff", border: "1px solid #e0e0e0", padding: "8px 10px", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.5, color: "#171717", wordBreak: "break-word" } },
        driveTyping || h("span", { style: { color: "#bbb" } }, "\u00a0"),
        h("span", { "aria-hidden": "true", style: { display: "inline-block", width: 1.5, height: 15, marginLeft: 1, verticalAlign: "-2px", background: "#07c160", animation: "wkcaret 1s steps(2) infinite" } })),
      h("div", { "data-wk": "pbtn", "data-part": "send", "data-watch": "send", style: { flexShrink: 0, borderRadius: 5, padding: "8px 14px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: driveTyping ? "#fff" : "#9a9a9a", background: driveTyping ? "#07c160" : "#e6e6e6" } }, "发送")) : null);
  const accounts = arr(d.me && d.me.accounts);
  if (publicPage) return h("div", { "data-wk": "block", className: "h-full min-h-0 flex flex-col", "data-wk": "papp", "data-app": "wechat", style: { background: "#f5f5f5" } }, innerHead(article ? "文章" : "公众号", null, () => article ? setArticle(null) : setPublicPage(false)), h("div", { "data-wk": "pdetail", className: "flex-1 min-h-0 overflow-y-auto" }, article ? h("article", { style: { background: "#fff", minHeight: "100%", padding: "24px 22px 48px" } }, h("h1", { style: { fontFamily: F_DISPLAY, fontSize: "calc(24px * var(--app-fs, 1))", lineHeight: 1.35, color: "#191919" } }, PTX(article.title)), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#8a8a8a", marginTop: 10 } }, [article.source, article.time].filter(Boolean).join(" · ")), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 2, color: "#333", marginTop: 25, whiteSpace: "pre-wrap" } }, PTX(article.summary)), h("div", { style: { marginTop: 32, padding: 18, borderRadius: 8, background: "#f7f7f7" } }, h("div", { "data-wk": "block", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#8a8a8a", marginBottom: 8 } }, char.name + " 读到这里时"), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.8, color: "#444" } }, PTX(article.thought)))) : h("div", null, h("div", { style: { height: 118, background: "linear-gradient(135deg,#234635,#79a185)", padding: "34px 22px", color: "#fff" } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(25px * var(--app-fs, 1))" } }, "订阅号消息"), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", opacity: .8, marginTop: 5 } }, char.name + " 最近打开过的文章")), h("div", { style: { padding: "10px 14px" } }, accounts.map((a, i) => h("button", { key: i, onClick: () => setArticle(a), className: "w-full text-left active:opacity-60", style: { padding: "17px 0", borderBottom: "1px solid #ddd" } }, h("div", { className: "flex gap-13" }, h("div", { className: "flex-1" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", lineHeight: 1.45, color: "#222" } }, PTX(a.title)), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#999", marginTop: 8 } }, [a.source, a.time].filter(Boolean).join(" · "))), h("div", { style: { width: 72, height: 58, borderRadius: 5, background: `linear-gradient(135deg,${strColor(a.source)},#ddd)` } }))))))));
  // 会话列表照通讯录的备注显示（她 2026-10-25「他给我的备注没应用上来」）：真微信里列表上写的就是备注，
  //   通讯录里她是「最爱的老婆」，聊天列表却还写着她的名字。跟她那一栏用 userContact，别人按名字去 contacts 里找
  const chatRemarkOf = c => {
    if (!c || c.type === "group") return (c && c.name) || "";
    const cn = v => String(v == null ? "" : v).replace(/[\s（）()「」【】·]/g, "");
    const uc = d.userContact;
    const isMe = [userName(profile), profile && profile.name].some(n => n && (typeof phoneSamePerson === "function" ? phoneSamePerson(c.name, n) : cn(c.name) === cn(n)));
    if (isMe) return (uc && String(uc.remark || "").trim()) || c.name;
    const ct = arr(d.contacts).find(x => x && cn(x.name) === cn(c.name));
    return (ct && String(ct.remark || "").trim()) || c.name;
  };
  const chatRow = (c, i) => h("button", { key: c.id || i, "data-wk": "pitem", "data-watch": "item:" + (c.name || ""), onClick: () => setThread(chatRemarkOf(c) !== c.name ? { ...c, remark: chatRemarkOf(c) } : c), className: "w-full text-left flex items-center gap-3 active:opacity-60", style: { minHeight: 67, borderBottom: "1px solid #e5e5e5", background: "#fff", padding: "8px 14px" } }, h(Avatar, { character: person(c.name, c.avatarImage), size: 47, radius: c.type === "group" ? 8 : 7 }), h("div", { className: "flex-1 min-w-0" }, h("div", { className: "flex justify-between gap-2" }, h("span", { "data-wk": "ptitle", style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: "#191919" } }, PTX(chatRemarkOf(c))), h("span", { "data-wk": "ptime", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#aaa", flexShrink: 0 } }, phoneChatWhen(c))), h("div", { "data-wk": "ptext", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: c._empty ? "#bbb" : "#999", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.last || (c._empty ? "还没说过话" : ""))));
  const userContact = d.userContact || { name: meName, remark: meName, intro: "TA 把你放在最重要的位置，但这次刷新还没写下具体的话。" };
  // 通讯录不会比聊天列表还空（群友 2026-10-21：刷了两遍，通讯录里只有她自己）：模型那一份 contacts 漏写了也照样有人——
  //   跟TA有私聊的那几位（真聊天、推演出来的都算）都是联系人，名字没在 contacts 里的补在后面
  const _cn = v => String(v == null ? "" : v).replace(/[\s（）()「」【】·]/g, "");
  const _listed = new Set(arr(d.contacts).flatMap(c => [_cn(c && c.name), _cn(c && c.remark)]).concat([_cn(meName)]));
  const _fromChats = chats.filter(c => c && c.type !== "group" && c.name && !_listed.has(_cn(c.name)) && !_listed.has(_cn(c.remark)))
    .map(c => { _listed.add(_cn(c.name)); return { name: c.name, remark: c.remark || "", intro: "" }; });
  // 关系网上连着的人（角色、配角）本来就是TA认识的人：模型没写进 contacts、也还没开私聊的，照样列进通讯录
  const _fromRel = arr(d.relContacts).filter(n => n && !_listed.has(_cn(n))).map(n => { _listed.add(_cn(n)); return { name: n, remark: "", intro: "" }; });
  const contacts = [{ ...userContact, name: meName, avatarImage: herAv, _me: true }, ...arr(d.contacts), ..._fromChats, ..._fromRel];
  const contactRow = (c, i) => h("button", { key: i, "data-wk": "pitem", "data-kind": "contact", onClick: () => { setRemarkDraft(null); setThread({ ...c, type: "contact" }); }, className: "w-full flex items-center gap-3 text-left active:opacity-60", style: { minHeight: 64, padding: "8px 14px", background: "#fff", borderBottom: "1px solid #e7e7e7" } }, h(Avatar, { character: person(c.name, c.avatarImage), size: 43, radius: 7 }), h("div", null, h("div", { "data-wk": "ptitle", style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: "#1c1c1c" } }, c.remark || c.name), h("div", { "data-wk": "ptext", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#999", marginTop: 3 } }, PTX(c.intro))));
  const searchBox = h("div", { "data-wk": "block", className: "flex-1 flex items-center justify-center gap-2", style: { height: 39, borderRadius: 8, background: "#fff", border: "1px solid #e5e5e5", color: "#9a9a9a", boxShadow: "0 1px 1px rgba(0,0,0,.025)" } },
    h("svg", { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" }, h("circle", { cx: 10.5, cy: 10.5, r: 6.5 }), h("path", { d: "m16 16 4 4" })),
    h("span", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, "搜索"));
  const searchHead = h("div", { "data-wk": "head", className: "shrink-0 flex items-center gap-2 px-3 pb-2", style: { paddingTop: safeTop(9), background: "#f5f5f5", borderBottom: "1px solid #e2e2e2" } },
    h("button", { onClick: onBack, className: "shrink-0 active:opacity-50", style: { width: 34, height: 42, fontSize: "calc(29px * var(--app-fs, 1))", lineHeight: 1, color: "#222" }, "aria-label": "返回" }, "‹"),
    searchBox,
    h("button", { onClick: onRefresh, disabled: refreshing, className: "shrink-0 active:opacity-50 disabled:opacity-35", style: { width: 34, height: 42, display: "flex", alignItems: "center", justifyContent: "center" }, "aria-label": "刷新微信" }, h(IRefresh, { size: 18, color: "#333" })));
  const contactsHead = h("div", { "data-wk": "head", className: "shrink-0", style: { paddingTop: safeTop(10), background: "#f5f5f5", borderBottom: "1px solid #e2e2e2" } },
    h("div", { className: "flex items-center px-3", style: { height: 43 } }, h("button", { onClick: onBack, className: "active:opacity-50", style: { width: 34, fontSize: "calc(29px * var(--app-fs, 1))", lineHeight: 1 }, "aria-label": "返回" }, "‹"), h("div", { className: "flex-1 text-center", style: { paddingRight: 34, fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", fontWeight: 700 } }, "通讯录")),
    h("div", { className: "px-3 pb-3" }, searchBox));
  const plainHead = h("div", { "data-wk": "head", className: "shrink-0 flex items-center px-3 pb-2", style: { paddingTop: safeTop(12), minHeight: 54, background: "#f5f5f5", borderBottom: "1px solid #e2e2e2" } },
    h("button", { onClick: onBack, className: "active:opacity-50", style: { width: 34, fontSize: "calc(29px * var(--app-fs, 1))", lineHeight: 1 }, "aria-label": "返回" }, "‹"),
    h("div", { className: "flex-1 text-center", style: { paddingRight: 34, fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", fontWeight: 700 } }, tab === "moments" ? "朋友圈" : "我"));
  const topBar = tab === "chats" ? searchHead : tab === "contacts" ? contactsHead : plainHead;
  let body;
  if (thread && thread.type === "contact") body = null;
  if (tab === "chats") body = h("div", null, chats.map(chatRow));
  else if (tab === "contacts") body = h("div", null, h("div", { style: { padding: "7px 14px", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#888", background: "#f4f4f4" } }, "联系人 · " + contacts.length), contacts.map(contactRow));
  else if (tab === "moments") {
    // 挂点挂在【谁发的】上：TA半夜翻谁的朋友圈，圆点要落在那一条上（原来朋友圈那一栏
    // 一个挂点都没有，切过去之后圆点还停在别处，看着像卡住）。
    const momentCard = (m, i) => h("div", { key: i, "data-watch": "item:" + (m.author || ""), "data-wk": "pitem", className: "flex gap-3", style: { padding: "15px 14px", borderBottom: "1px solid #eee" } },
      h(Avatar, { character: person(m.author), size: 40, radius: 6 }),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { "data-wk": "ptitle", style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#526786" } }, PTX(m.author)),
        h("div", { "data-wk": "ptext", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.7, color: "#222", marginTop: 5 } }, PTX(m.content)),
        h("div", { "data-wk": "ptime", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#999", marginTop: 7 } }, phoneAgo(m) || m.time || ""),
        h("div", { "data-wk": "block", style: { background: "#f3f3f3", borderRadius: 4, marginTop: 8, padding: "7px 9px" } },
          arr(m.likes).length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#526786", paddingBottom: arr(m.comments).length ? 5 : 0, borderBottom: arr(m.comments).length ? "1px solid #ddd" : "none" } }, "♡ " + arr(m.likes).join("、")) : null,
          arr(m.comments).map((x, j) => h("div", { key: j, style: { fontFamily: F_BODY, fontSize: "calc(11.8px * var(--app-fs, 1))", lineHeight: 1.55, color: "#333", marginTop: 4 } }, h("b", { style: { color: "#526786" } }, x.from + "："), PTX(x.text))))));
    body = h("div", { style: { background: "#fff" } },
      h("div", { style: { height: 140, background: "linear-gradient(135deg,#4d6655,#c6c2ad)", position: "relative", marginBottom: 34 } }, h("div", { style: { position: "absolute", right: 18, bottom: -28, display: "flex", alignItems: "center", gap: 10 } }, h("span", { style: { color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", textShadow: "0 1px 3px #000" } }, d.me && d.me.wechatName || char.name), h(Avatar, { character: selfFace, size: 60, radius: 7 }))),
      // 真发过的那几条（TA自己和关系网上的人）跟推演出来的混在一起，按时间新的在上（她 2026-10-21：「按实际顺序，推演的按推演时间穿插」）；
      //   同一句话不摆两遍；拿不到时间的（老数据）沉到最后，彼此保持原来的先后
      (() => {
        const tsOf = m => m && m._ts != null ? Number(m._ts) : (typeof phoneWhenTs === "function" ? (phoneWhenTs(m && m.time, Date.now()) || 0) : 0);
        // 真角色的朋友圈只认真发的：推演里冒名写的那几条（老数据、或模型没听话）不摆
        const realA = new Set(arr(d.actualMoments && d.actualMoments.realAuthors));
        const all = arr(d.actualMoments).concat(arr(d.moments).filter(m => !realA.has(String(m.author || "").trim()) && !arr(d.actualMoments).some(r => r.content === m.content)));
        return all.map((m, i) => ({ m, i, t: tsOf(m) })).sort((a, b) => (b.t - a.t) || (a.i - b.i)).map(x => x.m);
      })().map(momentCard));
  }
  else body = h("div", { "data-wk": "block", style: { background: "#f5f5f5", minHeight: "100%", paddingTop: 14 } }, h("div", { className: "flex items-center gap-4", style: { background: "#fff", padding: "22px 18px" } }, h(Avatar, { character: selfFace, size: 67, radius: 8 }), h("div", { className: "flex-1 min-w-0" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", color: "#1b1b1b" } }, d.me && d.me.wechatName || char.name), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#888", marginTop: 6 } }, "微信号：" + (d.me && d.me.wechatId || "wx_" + String(char.id || "user").slice(0, 8))), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#777", marginTop: 5 } }, d.me && d.me.signature || "还没有写个性签名"))), h("button", { onClick: () => setPublicPage(true), className: "w-full flex items-center gap-3 text-left active:opacity-60", style: { marginTop: 10, background: "#fff", padding: "16px 18px" } }, h("div", { style: { width: 34, height: 34, borderRadius: 7, background: "#07c160", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))" } }, "文"), h("div", { className: "flex-1" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: "#222" } }, "公众号"), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#999", marginTop: 3 } }, "最近读过 " + accounts.length + " 篇文章")), h("span", { style: { color: "#aaa", fontSize: "calc(22px * var(--app-fs, 1))" } }, "›")));
  // ── 联系人详情（v62.60 重做）────────────────────────────────────────
  // 审美审计 2026-09-04 把这一页判成【基础款】：灰底 + 头像 + 一张白色圆角卡。
  // 换成任何一个 app 的「某某的资料」都成立——而这个 app 仿的是本尊，
  // 本尊的联系人页是【分组 cell】：几块白，块与块之间空一段灰，行与行之间一道浅线。
  // 往本尊靠，不是往通用卡靠。
  if (thread && thread.type === "contact") {
    // 通讯录点「发消息」进对应的会话（她 2026-10-25）：原来只认名字一字不差，她那一栏、按备注起名的会话都对不上，按钮就不出来。
    //   现在跟会话列表认人用同一把尺：名字或备注对得上就是同一个人；她自己那一栏认她的会话
    const _sn = v => String(v == null ? "" : v).replace(/[\s（）()「」【】·]/g, "");
    const sess = chats.find(c2 => c2 && c2.type !== "group" && (thread._me
      ? [userName(profile), profile && profile.name].some(n => n && (typeof phoneSamePerson === "function" ? phoneSamePerson(c2.name, n) : _sn(c2.name) === _sn(n)))
      : [thread.name, thread.remark].some(n => n && _sn(n) === _sn(c2.name))));
    const cell = (label, value, last) => h("div", { className: "flex items-baseline", style: { gap: 12, padding: "13px 16px", borderTop: last === "first" ? "none" : "1px solid #ededed" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: "#191919", flexShrink: 0 } }, label),
      h("div", { style: { flex: 1, minWidth: 0, textAlign: "right", fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: "#8a8a8a", wordBreak: "break-word" } }, value));
    const block = (kids, extra) => h("div", { style: Object.assign({ background: "#fff", marginTop: 10 }, extra || {}) }, kids);
    return h("div", { className: "h-full min-h-0 flex flex-col", "data-wk": "papp", "data-app": "wechat", "data-view": "contact", style: { background: "#ededed" } },
      innerHead(thread.remark || thread.name, null, () => setThread(null)),
      h("div", { className: "flex-1 overflow-y-auto", style: { paddingBottom: 28 } },
        block(h("div", { className: "flex items-center", style: { gap: 14, padding: "18px 16px" } },
          // 点头像换一张（配角的脸跟配角页走，在那边换）
          (window.__phoneFaceIsNpc && window.__phoneFaceIsNpc(char && char.id, thread.name)) || drive
            ? h(Avatar, { character: person(thread.name, thread.avatarImage), size: 60, radius: 6 })
            : h("label", { "data-wk": "pcontactface", style: { cursor: "pointer", position: "relative", display: "block" } },
                h(Avatar, { character: person(thread.name, thread.avatarImage), size: 60, radius: 6 }),
                h("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: e => phonePickLookImage(e.target.files && e.target.files[0], ref => {
                  const all = loadJSON("x_phoneContactAv", {}) || {}; const mine = Object.assign({}, all[char.id] || {}); mine[thread.name] = ref;
                  saveJSON("x_phoneContactAv", Object.assign({}, all, { [char.id]: mine })); bumpFace(x => x + 1);
                }) })),
          h("div", { style: { minWidth: 0 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: "#191919" } }, thread.remark || thread.name),
            thread.remark && thread.remark !== thread.name
              ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#8a8a8a", marginTop: 4 } }, "昵称：" + thread.name) : null))),
        block([
          // 备注可以改：点开就地改，改完TA会知道（app.js phoneRemarkEdit）
          onRemark && !drive && remarkDraft != null
            ? h("div", { key: "rm", className: "flex items-center", style: { gap: 10, padding: "9px 16px" } },
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: "#191919", flexShrink: 0 } }, "备注"),
                h("input", { "data-wk": "input", value: remarkDraft, autoFocus: true, maxLength: 30, onChange: e => setRemarkDraft(e.target.value), placeholder: "留空就是删掉备注",
                  style: { flex: 1, minWidth: 0, height: 34, borderRadius: 5, border: "1px solid #e0e0e0", padding: "0 9px", fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: "#171717", outline: "none" } }),
                h("button", { onClick: () => setRemarkDraft(null), className: "active:opacity-60", style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: "#8a8a8a" } }, "取消"),
                h("button", { onClick: () => { const v = remarkDraft.trim(); onRemark(char, thread, v); setThread({ ...thread, remark: v }); setRemarkDraft(null); },
                  className: "active:opacity-60", style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: "#07c160" } }, "改好了"))
            : onRemark && !drive
              ? h("button", { key: "rm", onClick: () => setRemarkDraft(thread.remark && thread.remark !== thread.name ? thread.remark : ""), className: "w-full text-left active:opacity-60" },
                  cell("备注", (thread.remark && thread.remark !== thread.name ? thread.remark : "无") + "  ›", "first"))
              : cell("备注", thread.remark && thread.remark !== thread.name ? thread.remark : "无", "first"),
          cell("来源", sess ? "微信联系人" : "通讯录")
        ]),
        // 这一块是我们独有的东西（不是本尊有的），所以它单独成一组，
        // 用一行灰色小字点明它是什么，正文才不会被误读成「个性签名」
        block(h("div", { style: { padding: "14px 16px 17px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#8a8a8a", marginBottom: 9 } }, char.name + " 对这个人的备注与真实感想"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.9, color: "#333", whiteSpace: "pre-wrap" } }, PTX(thread.intro || "（没写）")))),
        onDelFriend && !drive && isDel(thread.name) ? block(h("div", { "data-wk": "pdelfriend", "data-on": "1", style: { padding: "18px 16px", textAlign: "center" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#999", marginBottom: 12 } }, "已经从 " + char.name + " 的好友里删掉了"),
          h("button", { onClick: () => { onDelFriend(char, thread.name, true); bumpDel(x => x + 1); }, className: "active:opacity-70", style: { padding: "9px 22px", borderRadius: 6, background: "#07c160", color: "#fff", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }, "加回好友"))) : null,
        // 发消息只在真有这个人的会话时才给——按了没反应的按钮比没有按钮更糟
        sess && !isDel(thread.name) ? h("button", {
          onClick: () => setThread(chatRemarkOf(sess) !== sess.name ? { ...sess, remark: chatRemarkOf(sess) } : sess),
          className: "w-full active:opacity-70",
          style: { marginTop: 10, background: "#fff", padding: "14px 0", fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: "#07c160" }
        }, "发消息") : null,
        onDelFriend && !drive && !thread._me && !isDel(thread.name) ? h("button", { "data-wk": "pdelfriend", "data-on": "0",
          onClick: () => requestAppConfirm("删掉这个好友？", "从 " + char.name + " 的微信里删掉「" + (thread.remark || thread.name) + "」。聊天记录还在，随时能在这里加回来；" + char.name + " 下次说话时会发现。", () => { onDelFriend(char, thread.name, false); bumpDel(x => x + 1); }, "删除"),
          className: "w-full active:opacity-70",
          style: { marginTop: 10, background: "#fff", padding: "14px 0", fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: "#fa5151" } }, "删除好友") : null,
        onBlockFriend && !drive && !thread._me && !isDel(thread.name) ? h("button", { "data-wk": "pblockfriend", "data-on": isBlk(thread.name) ? "1" : "0",
          onClick: () => isBlk(thread.name) ? (onBlockFriend(char, thread.name, true), bumpDel(x => x + 1))
            : requestAppConfirm("拉黑这个人？", "把「" + (thread.remark || thread.name) + "」加进 " + char.name + " 的微信黑名单：人还在通讯录里，他收不到对方发来的消息。随时能在这里放出来；" + char.name + " 下次说话时会发现。", () => { onBlockFriend(char, thread.name, false); bumpDel(x => x + 1); }, "拉黑"),
          className: "w-full active:opacity-70",
          style: { marginTop: 10, background: "#fff", padding: "14px 0", fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: isBlk(thread.name) ? "#07c160" : "#fa5151" } }, isBlk(thread.name) ? "已拉黑 · 移出黑名单" : "加入黑名单") : null));
  }
  const navs = [["chats", "聊天"], ["contacts", "联系人"], ["moments", "朋友圈"], ["me", "我"]];
  return h("div", { className: "h-full min-h-0 flex flex-col", "data-wk": "papp", "data-app": "wechat", style: { background: "#f5f5f5" } }, topBar, h("div", { className: "flex-1 min-h-0 overflow-y-auto" }, body), h("div", { className: "shrink-0 grid grid-cols-4", style: { minHeight: 61, paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4)", background: "rgba(250,250,250,.98)", borderTop: "1px solid #ddd" } }, navs.map(([k, label]) => h("button", { key: k, "data-wk": "ptab", "data-on": tab === k ? "1" : "0", "data-watch": "tab:" + k, onClick: () => setTab(k), className: "flex flex-col items-center justify-center gap-0.5 active:opacity-60", style: { color: tab === k ? "#07c160" : "#777" } }, h(WechatNavIcon, { kind: k, active: tab === k }), h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))" } }, label)))));
}

function AlbumNavIcon({ kind, active }) {
  const stroke = active ? ALBUM_ACCENT : ALBUM_DIM;
  const p = { fill: "none", stroke, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (kind === "library") return h("svg", { width: 23, height: 23, viewBox: "0 0 24 24", "aria-hidden": true },
    h("rect", { ...p, x: 3.5, y: 3.5, width: 6.5, height: 6.5, rx: 1.2 }), h("rect", { ...p, x: 14, y: 3.5, width: 6.5, height: 6.5, rx: 1.2 }),
    h("rect", { ...p, x: 3.5, y: 14, width: 6.5, height: 6.5, rx: 1.2 }), h("rect", { ...p, x: 14, y: 14, width: 6.5, height: 6.5, rx: 1.2 }));
  if (kind === "collections") return h("svg", { width: 23, height: 23, viewBox: "0 0 24 24", "aria-hidden": true },
    h("rect", { ...p, x: 4, y: 6, width: 13, height: 15, rx: 2.3 }), h("path", { ...p, d: "M8 3h10a2 2 0 0 1 2 2v12" }));
  return h("svg", { width: 23, height: 23, viewBox: "0 0 24 24", "aria-hidden": true }, h("path", { ...p, d: "M20.8 4.7a5.4 5.4 0 0 0-7.7 0L12 5.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.7Z" }));
}

// ── 相册（v59.50 换骨架）─────────────────────────────────────────────────
// 她 2026-09-01：「选的相册叫个人收藏、最近保存、最近删除、私密这些也都是照抄，
// 甚至都叫精选集」。对——连这上面那行注释原来都写着「iPhone 风图库/精选集/收藏夹」，
// 配色是 #0a84ff。那是**别人家系统相册的词表**，一个字都不该留。
//
// 换的是【名字和骨架】，不是数据：五个 key（memory/favorite/saved/private/deleted）
// 全部照旧——它们撑着回收站 30 天过期、五类保底、私密走 hidden 档那几条规矩。
// canon() 仍然认得出旧标签，老存档翻开就是新名字。
//
// 起名的判据：**这一摞在TA自己嘴里叫什么。**
// 「最近删除」是系统的说法；TA心里那句是「删了又没真删的」——TA按了删除，
// 可它还在那儿躺着。那才是翻别人相册时真正扎人的一摞。
const ALBUM_ACCENT = "#8a6478";   // 藕：这一路谁都没用过（外卖暖、购物靛、健康草药）
const ALBUM_ALERT = "#a8524a";    // 只给「删了又没真删的」和「锁起来的」
const ALBUM_DIM = "#948e96";
function AlbumView({ d, char, t, onBack, onRefresh, refreshing, onPeek, onDrawPhoto, drawing, drive, onPhotoEdit }) {
  const [keep, setKeep] = useState(() => phoneKeepLoad());
  const [tab, setTab] = useState("collections");
  const [opened, setOpened] = useState(null);
  const [photo, setPhoto] = useState(null);
  // ──「看TA玩」驱动：这一路【零写入】——TA只是点开一张已有的照片看看。
  //   她 2026-09-10：「不一定是每次要加新东西，可以是比如说点开一张已有的照片
  //   然后屏幕某处有TA的想法之类的」。素材本来就在TA手机里，一个字都不用现编。
  const driveTab = drive && drive.tab, driveItem = drive && drive.item;
  useEffect(() => { if (drive && driveTab) { setTab(driveTab); setOpened(null); } }, [driveTab]);
  // ⚠️她 2026-09-10：「照片也是打开显示全部而不是TA的几摞」。
  //   这一屏默认停在【TA的几摞】——那是她自己翻手机时想看的（TA把照片分成了哪几堆）；
  //   可TA自己刷相册不会先看分类，是直接往下翻。所以【只在看TA玩时】改默认。
  useEffect(() => { if (drive) { setTab("library"); setOpened(null); } }, [!!drive]);
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setPhoto(null); return; }
    const all = Array.isArray(d && d.items) ? d.items : [];
    const hit = watchOpenPick(all, driveItem, x => x && x.caption);
    if (hit) setPhoto(hit);
  }, [driveItem]);
  const scrollRef = useRef(null);
  const returnScroll = useRef({ top: 0, pending: false });
  const openPhoto = p => {
    returnScroll.current = { top: scrollRef.current ? scrollRef.current.scrollTop : 0, pending: false };
    setPhoto(p);
  };
  const closePhoto = () => {
    returnScroll.current.pending = true;
    setPhoto(null);
  };
  useEffect(() => {
    if (photo || !returnScroll.current.pending) return;
    const top = returnScroll.current.top;
    returnScroll.current.pending = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = top;
    }));
  }, [photo, opened, tab]);
  // 模型偶尔会把 items 返回成字符串或对象；a || [] 会原样放行，下一步 .map 就是白屏
  const arr = a => Array.isArray(a) ? a : [];
  const albums = [
    { key: "memory", label: "总翻出来看的", why: "隔一阵就点开一次" },
    { key: "favorite", label: "舍不得删的", why: "存了很久了" },
    { key: "saved", label: "从别处存下来的", why: characterText(char, "不是他拍的") },
    { key: "private", label: "锁起来的", why: characterText(char, "只有他打得开") },
    { key: "deleted", label: "删了又没真删的", why: "按了删除，还在这儿躺着" }
  ];
  // ⚠️旧标签必须继续认得出：老存档里存的是「个人收藏」那一套，
  // 不认的话它们会全部掉进「没分类」，等于翻开就丢了一半。
  const canon = v => ({
    "回忆": "memory", "总翻出来看的": "memory",
    "个人收藏": "favorite", "舍不得删的": "favorite",
    "最近保存": "saved", "从别处存下来的": "saved",
    "私密": "private", "锁起来的": "private",
    "最近删除": "deleted", "删了又没真删的": "deleted"
  }[v] || (["memory", "favorite", "saved", "private", "deleted"].includes(v) ? v : ""));
  const dateMs = p => {
    const n = Date.parse(String(p && (p.date || p.time) || ""));
    return Number.isFinite(n) ? n : 0;
  };
  // 模型偶尔分配失衡：25 张时机械挪动超额项，保证五册各至少 4 张；
  // 老相册不伪造照片，刷新后才升级到新版 25 张。
  const normalize = source => {
    const items = arr(source).map((p, i) => ({ ...p, _albumId: p.id || (String(p.caption || "照片") + "|" + String(p.date || p.time || "") + "|" + i), category: canon(p.category) }));
    const buckets = Object.fromEntries(albums.map(a => [a.key, []]));
    const loose = [];
    items.forEach(p => (p.category ? buckets[p.category] : loose).push(p));
    if (items.length >= 20) {
      for (const a of albums) while (buckets[a.key].length < 4) {
        let donor = albums.map(x => buckets[x.key]).sort((x, y) => y.length - x.length)[0];
        const moved = loose.shift() || (donor && donor.length > 4 ? donor.pop() : null);
        if (!moved) break;
        moved.category = a.key; buckets[a.key].push(moved);
      }
    }
    let li = 0;
    loose.forEach(p => { const k = albums[li++ % albums.length].key; p.category = k; buckets[k].push(p); });
    return albums.flatMap(a => buckets[a.key]).sort((a, b) => dateMs(b) - dateMs(a));
  };
  const items = normalize(d.items);
  const sig = phonePhotoSig;
  const saved = arr(keep[char.id]);
  const isSaved = p => saved.some(s => sig(s) === sig(p));
  const toggle = p => setKeep(prev => {
    const list = arr(prev[char.id]);
    const exists = list.some(s => sig(s) === sig(p));
    const nl = exists ? list.filter(s => sig(s) !== sig(p)) : [{ ...p, _at: Date.now() }, ...list];
    const n = { ...prev, [char.id]: nl };
    saveJSON("x_phoneKeep", n);
    return n;
  });
  // 画出来的那张图挂在【我收着的】那条记录上（v59.59）。详情页和缩略图翻的都是
  // 本轮 items，不是 keep——两边都得看一眼，否则刚画完当场还是程序化缩略图。
  const keptOf = p => saved.find(s => sig(s) === sig(p)) || null;
  // ⚠️v66.61 之前画好的图存的是【聊天自拍那个仓】的 img_pk_ 键，而这一屏渲染走
  //   resolveImg（只认图库的 iv_）——她那几张会显示成碎图标。重画一次要再花一枪，
  //   所以读的时候异步捞一把，捞到就换成 objectURL 缓存起来（只此一次，之后走缓存）。
  const [oldRefUrls, setOldRefUrls] = useState({});
  const pullOldRef = k => {
    if (!k || typeof idbImgGet !== "function") return "";
    if (oldRefUrls[k] !== undefined) return oldRefUrls[k] || "";
    setOldRefUrls(m => (m[k] !== undefined ? m : { ...m, [k]: "" }));
    idbImgGet(k).then(b => {
      if (!b) return;
      try { const u = URL.createObjectURL(b); setOldRefUrls(m => ({ ...m, [k]: u })); } catch (e) {}
    }).catch(() => {});
    return "";
  };
  const drawnRef = p => { const k = keptOf(p); return p.imageRef || (k && k.imageRef) || ""; };
  const drawnUrl = p => { const k = keptOf(p); return p.imageUrl || p.imgUrl || (k && k.imageUrl) || ""; };
  // 画完了要当场看见：keep 是这个组件自己的 state，App 那边写完 localStorage
  // 不会通知它，所以画完再读一遍。
  // ── 回收站是真的能进能出（她 2026-09-10）────────────────────────
  // 「删了又没真删的」原来只是一摞【看得见的】照片：按了删除还在这儿躺着，可她
  // 既不能真删掉，也不能把它捞回来，更不能把别的照片扔进去。
  // ⚠️「我收着的」那一摞【永远不动】：那是她自己挑着留下的（x_phoneKeep 另一份数据），
  //   跟TA手机里这份 items 是两回事——删这边不该碰到那边。
  const editPhoto = (p, how) => {
    if (!onPhotoEdit || !p) return;
    const all = arr(d && d.items);
    const next = how === "gone"
      ? all.filter(x => sig(x) !== sig(p))
      : all.map(x => sig(x) === sig(p) ? { ...x, category: how } : x);
    onPhotoEdit(next);
    if (how === "gone") closePhoto(); else setPhoto({ ...p, category: how });
  };
  const editDrawPhoto = p => {
    if (!onDrawPhoto || typeof requestAppPrompt !== "function") return;
    const cur = [p.caption, p.desc].map(x => String(x || "").trim()).filter(Boolean).join("｜");
    requestAppPrompt("改画面描述再画", "写这张照片上该看见什么，照新的画。", cur, txt => { if (String(txt || "").trim()) drawPhoto(p, String(txt)); }, "照这个画", { multiline: true });
  };
  const drawPhoto = (p, override) => {
    if (!onDrawPhoto) return;
    Promise.resolve(onDrawPhoto(p, sig(p), override)).then(() => {
      const k = phoneKeepLoad();
      setKeep(k);
      // ⚠️她 2026-09-10：「TA说画好了但是图不会动，要我重开 app 进一次才会替换」。
      //   光 setKeep 不够稳：正看着的这一张是 photo 这份【快照】，而 drawnRef 先看
      //   p.imageRef、再回落到收藏那条记录。把新的 ref 直接盖回手上这份快照，
      //   这一屏就当场换图，不用等任何一层 state 对上。
      const rec = arr(k[char.id]).find(s => sig(s) === sig(p));
      if (rec) setPhoto(cur => (cur && sig(cur) === sig(p))
        ? { ...cur, imageRef: rec.imageRef || "", imageUrl: rec.imageUrl || "" } : cur);
    });
  };
  // 零 API 的程序化缩略图：按照片内容稳定生成不同色光、景深与构图；不是灰色占位，
  // 也不会为 25 张照片额外烧生图额度。若将来数据带 imageRef/imageUrl，会优先显示真图。
  // bare=true：不在缩略图上烧那行说明文字。缩略图上要它（那是替代照片的全部信息），
  // 点开满幅之后底下已经有大标题了，再烧一行就是同一句话写两遍。
  const art = (it, radius, bare) => {
    const seed = phoneStableHash((it.caption || "") + (it.desc || ""));
    const hue = seed % 360, hue2 = (hue + 45 + seed % 70) % 360;
    // imageRef 是本机保险箱里的键，得先解出来才能给 <img>（v59.59 起「我收着的」
    // 那几张可以真画出来，画完就存成 imageRef）。解不出来就照旧画程序化缩略图。
    const ref = drawnRef(it);
    const legacy = String(ref || "").indexOf("img_") === 0;
    const img = drawnUrl(it)
      || (legacy ? pullOldRef(ref) : (ref && typeof resolveImg === "function" ? resolveImg(ref) : ""))
      || "";
    return h("div", { style: { position: "absolute", inset: 0, overflow: "hidden", borderRadius: radius || 0,
      background: img ? "#ddd" : `linear-gradient(${110 + seed % 80}deg,hsl(${hue} 42% 75%),hsl(${hue2} 48% 37%))` } },
      img ? h("img", { src: img, alt: it.caption || "照片", style: { width: "100%", height: "100%", objectFit: "cover" } }) : h(React.Fragment, null,
        h("span", { style: { position: "absolute", width: "72%", height: "72%", borderRadius: "50%", left: `${-12 + seed % 35}%`, top: `${-8 + (seed >> 3) % 35}%`, background: "rgba(255,255,255,.28)", filter: "blur(10px)" } }),
        h("span", { style: { position: "absolute", width: "46%", height: "70%", borderRadius: "46% 54% 30% 70%", right: `${-8 + (seed >> 5) % 20}%`, bottom: "-12%", background: "rgba(18,18,24,.28)", transform: `rotate(${seed % 28 - 14}deg)` } }),
        bare ? null : h("span", { style: { position: "absolute", left: 9, right: 9, bottom: 8, color: "rgba(255,255,255,.92)", fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", lineHeight: 1.25, textShadow: "0 1px 4px rgba(0,0,0,.45)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } }, PTX(it.caption || "照片"))));
  };
  const tile = (it, i, rounded) => h("button", { key: sig(it) + ":" + i, "data-wk": "pitem", "data-watch": "item:" + (it.caption || ""), onClick: () => openPhoto(it), className: "active:opacity-70", style: { position: "relative", aspectRatio: "1 / 1", overflow: "hidden", borderRadius: rounded ? 14 : 0, minWidth: 0 } }, art(it, rounded ? 14 : 0),
    isSaved(it) ? h("span", { style: { position: "absolute", top: 6, right: 6, width: 23, height: 23, borderRadius: 99, background: "rgba(255,255,255,.9)", display: "flex", alignItems: "center", justifyContent: "center" } }, h(IHeart, { size: 13, color: "#ff375f", filled: true })) : null,
    it.category === "private" ? h("span", { style: { position: "absolute", left: 6, bottom: 6, borderRadius: 7, padding: "2px 5px", color: "#fff", background: "rgba(0,0,0,.5)", fontSize: "calc(9px * var(--app-fs, 1))" } }, "锁") : it.category === "deleted" ? h("span", { style: { position: "absolute", left: 6, bottom: 6, borderRadius: 7, padding: "2px 5px", color: "#fff", background: "rgba(0,0,0,.5)", fontSize: "calc(9px * var(--app-fs, 1))" } }, "已删除") : null);
  const grid = (list, rounded, cols) => h("div", { className: `grid ${cols === 2 ? "grid-cols-2 gap-2" : "grid-cols-3 gap-0.5"}` }, list.map((x, i) => tile(x, i, rounded)));
  const chrome = (title, sub, back) => h("div", { "data-wk": "head", className: "shrink-0 flex items-center", style: { padding: `${safeTop(10)} 13px 8px`, minHeight: 56, background: "rgba(255,255,255,.97)", borderBottom: "1px solid #e5e5ea" } },
    h("button", { onClick: back || onBack, "aria-label": "返回", "data-watch": "back", className: "active:opacity-50", style: { width: 36, fontSize: "calc(29px * var(--app-fs, 1))", lineHeight: 1, color: "#111" } }, "‹"),
    h("div", { className: "flex-1 min-w-0 text-center" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", fontWeight: 700, lineHeight: 1.15, color: "#111" } }, title), sub ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: "#8e8e93", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, sub) : null),
    h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "刷新相册", className: "active:opacity-50 disabled:opacity-35", style: { width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" } }, h(IRefresh, { size: 18, color: "#333" })));
  // 高度以主聊天输入栏为标尺：只吃 0.4 条底部安全区，不再 +4px、也不用 minHeight 垫高
  // （施工规则/mobile-ui-layout.md §2）
  const nav = h("div", { className: "shrink-0 grid grid-cols-3", style: { padding: "5px 20px", paddingBottom: COMPOSER_PAD_BOTTOM, background: "rgba(250,250,252,.97)", borderTop: "1px solid #e5e5ea" } }, [["library", "全部"], ["collections", characterText(char, "他的几摞")], ["saved", "我收着的"]].map(([k, label]) => h("button", { key: k, "data-wk": "ptab", "data-on": tab === k ? "1" : "0", "data-watch": "tab:" + k, onClick: () => { setTab(k); setOpened(null); }, className: "flex flex-col items-center justify-center active:opacity-60", style: { color: tab === k ? ALBUM_ACCENT : ALBUM_DIM, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))" } }, h(AlbumNavIcon, { kind: k, active: tab === k }), h("span", { style: { marginTop: 2 } }, label))));
  // ── 一张照片（v62.60 重做）─────────────────────────────────────────
  // 审美审计 2026-09-04 把这一页判成【基础款】：白底 + 圆角 20 的缩略图 +
  // 一块 #f2f2f7 圆角 17 的灰卡——换成任何一个 app 的详情页都成立。
  // 这个 app 仿的是本尊（iOS 相册），而本尊点开一张照片是【黑底、照片满幅】：
  // 白底加圆角缩略图恰恰是本尊【不会】做的事。所以这里往本尊靠，不是往通用卡靠。
  if (photo) return h("div", { className: "h-full min-h-0 flex flex-col", "data-wk": "papp", "data-app": "album", style: { background: "#000" } },
    // 顶栏也跟着进黑：白底顶栏压在满幅照片上是两套皮
    h(Head, { zh: "照片", sub: photo.date || photo.time || "日期未记", bg: "transparent", noLine: true, ink: "#fff", onBack: closePhoto,
      right:
      // ⚠️收藏键必须还在。本尊把它放在工具栏里，所以这里也进顶栏右位——
      // 改版时它差点被我连着那张灰卡一起删掉（测试拦住了）。
      h("button", { onClick: () => toggle(photo), "aria-label": "收藏", className: "active:scale-90 flex items-center justify-center", style: { width: 40, height: 40, marginRight: -6 } },
        h(IHeart, { size: 21, color: isSaved(photo) ? "#ff375f" : "rgba(255,255,255,.65)", filled: isSaved(photo) })) }),
    h("div", { className: "flex-1 overflow-y-auto" },
      // 满幅、不切角、不投影——本尊就是把照片摊在黑底上
      h("div", { style: { position: "relative", width: "100%", aspectRatio: "1 / 1.12", overflow: "hidden" } }, art(photo, 0, true)),
      // 字底下自己垫一层黑（群里 2026-10-26：有人查手机相册是白底白字——美化把整页底色换浅了，这几行字还是写死的白）。
      //   底色和字色挂在同一个钩子上，想换浅色就在 palbuminfo 上两样一起改
      h("div", { "data-wk": "palbuminfo", style: { padding: "20px 20px 30px", background: "#000", color: "#fff" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: "#fff" } }, PTX(photo.caption || "照片")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.8, color: "rgba(255,255,255,.6)", marginTop: 8, whiteSpace: "pre-wrap" } }, PTX(photo.desc || "没有留下介绍。")),
        // TA的想法：黑底上用一道细线分栏，不再套一块浅灰圆角卡
        h("div", { style: { marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.14)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(255,255,255,.42)", marginBottom: 9 } }, char.name + " 对这张照片的想法"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.9, color: "rgba(255,255,255,.9)", whiteSpace: "pre-wrap" } }, photo.thought ? PTX(photo.thought) : T("他没多说什么。"))),
        // ── 画出来（v59.59）──────────────────────────────────────────────────
        // 她 2026-09-01：「相册放进我的收藏后可以给TA一个按钮生成真图吧，
        // 就按图上的 prompt 生成」。
        // ⚠️只给【已经收着的】那几张：收藏是她自己挑的，刷新不会冲掉，
        //   画出来的图才有地方留着；随手给二十五张都配个按钮等于劝人烧额度。
        // ⚠️走 buildScenePrompt（空景那条路），不走 buildPhotoPrompt——
        //   后者是【画一个人】的说明书（身份锁、骨架、手指、参考照），
        //   外挂一句「不要有人」压不住它（v59.16 那次的教训）。
        //   相册里绝大多数是景和物（窗外那场雨、桌上那根发绳），空景那条路才对得上。
        // 没收着的这张没有「画出来」那颗键——原地说一句怎么才有（群里 2026-10-31：不知道要先收藏）
        !isSaved(photo) && onDrawPhoto ? h("div", { "data-wk": "palbumdrawhint", style: { marginTop: 20, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.7, color: "rgba(255,255,255,.5)" } },
          "想把这张画成真图：先点右上角的 ♡ 收藏，收着的照片底下才有「把这张画出来」。") : null,
        isSaved(photo) && onDrawPhoto ? h("button", {
          onClick: () => drawPhoto(photo),
          disabled: !!drawing,
          className: "w-full active:opacity-60 disabled:opacity-45",
          style: { marginTop: 20, padding: "13px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid " + ALBUM_ACCENT, color: ALBUM_ACCENT }
        }, drawing === sig(photo) ? "正在画…（这一步会调一次画图）"
          : (drawnRef(photo) || drawnUrl(photo)) ? "再画一张" : "把这张画出来") : null,
        isSaved(photo) && onDrawPhoto && (drawnRef(photo) || drawnUrl(photo)) ? h("button", {
          "data-wk": "palbumedit",
          onClick: () => editDrawPhoto(photo),
          disabled: !!drawing,
          className: "w-full active:opacity-60 disabled:opacity-45",
          style: { marginTop: 10, padding: "12px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid rgba(255,255,255,.28)", color: "rgba(255,255,255,.82)" }
        }, "改画面描述再画") : null,
        // ── 回收站进出（她 2026-09-10）──────────────────────────
        // ⚠️「我收着的」那一摞不给这几颗键：那是她自己留的，不该在TA手机上被删掉。
        (onPhotoEdit && tab !== "saved") ? h("div", { className: "flex", style: { gap: 9, marginTop: 12 } },
          canon(photo.category) === "deleted"
            ? [h("button", { key: "back", onClick: () => editPhoto(photo, "memory"), "data-watch": "move:memory",
                className: "flex-1 active:opacity-60",
                style: { padding: "12px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid rgba(255,255,255,.28)", color: "rgba(255,255,255,.82)" } }, "捞回来"),
               h("button", { key: "gone", onClick: () => editPhoto(photo, "gone"), "data-watch": "move:gone",
                className: "flex-1 active:opacity-60",
                style: { padding: "12px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid rgba(255,90,80,.5)", color: "#ff8a80" } }, "真的删掉")]
            : h("button", { onClick: () => editPhoto(photo, "deleted"), "data-watch": "move:deleted",
                className: "w-full active:opacity-60",
                style: { padding: "12px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid rgba(255,255,255,.28)", color: "rgba(255,255,255,.72)" } }, "扔进「删了又没真删的」")) : null,
        onPeek ? (function () {
          // 锁起来的和删了又没真删的是TA藏起来的；另外三摞只是TA没主动提起
          const hid = photo.category === "private" || photo.category === "deleted";
          return h("button", {
            onClick: () => onPeek({ tier: hid ? "hidden" : "quiet", label: photo.category === "deleted" ? "相册·删了又没真删的" : photo.category === "private" ? "相册·锁起来的" : "相册", title: photo.caption || "一张照片", text: [photo.desc, photo.thought].filter(Boolean).join("｜") }),
            className: "w-full active:opacity-60",
            style: { marginTop: 10, padding: "13px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid " + (hid ? "rgba(224,115,107,.55)" : "rgba(255,255,255,.22)"), color: hid ? "#e0736b" : "rgba(255,255,255,.82)" }
          }, hid ? T("摆到 TA 面前 · 这是他藏起来的") : T("转发给 TA · 他会知道你翻了手机"));
        })() : null)));

  if (opened) {
    const meta = albums.find(a => a.key === opened);
    const list = items.filter(p => p.category === opened);
    return h("div", { "data-wk": "phoneapppage", "data-part": "albumview", className: "h-full min-h-0 flex flex-col", style: { background: "#fff" } }, chrome(meta ? meta.label : "相簿", list.length + " 张", () => setOpened(null)), h("div", { ref: scrollRef, className: "flex-1 overflow-y-auto", style: { padding: "8px 20px 28px" } }, grid(list, true, 3)), nav);
  }
  const library = h("div", { style: { paddingTop: 14, paddingBottom: 26 } }, (() => {
    const groups = [];
    items.forEach(p => { const raw = String(p.date || p.time || "日期未记"); const m = raw.match(/(\d{4})[-\/.年](\d{1,2})/); const label = m ? (m[1] + "年" + Number(m[2]) + "月") : "日期未记"; let g = groups.find(x => x.label === label); if (!g) { g = { label, list: [] }; groups.push(g); } g.list.push(p); });
    return groups.map((g, i) => h("section", { key: g.label + i, style: { marginBottom: 22 } }, h("div", { className: "flex justify-between", style: { padding: "0 20px 10px", fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: "#444" } }, h("span", null, g.label), h("span", { style: { color: "#999", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, g.list.length)), grid(g.list, false, 3)));
  })());
  // ── TA的几摞（v59.50 换骨架）───────────────────────────────────────────
  // 原来是【回忆一排横滑大卡 + 相簿一排横滑小卡】——那是别人家系统相册的首页，
  // 连分区名都一样。横滑一次只看得见一张半，还得划；而这五摞本来就该一眼看全。
  // 改成竖着五行，一行一摞：名字、TA为什么把这些归在一起、几张、一排缩略。
  // 「删了又没真删的」摆在最上面并标出来——**TA按了删除，可它还在那儿躺着**，
  // 那是翻别人相册时真正扎人的一摞，系统相册只会管它叫「最近删除」。
  const dayLeft = p => {
    const t2 = dateMs(p);
    if (!t2) return null;
    const n = 30 - Math.floor((Date.now() - t2) / 86400000);
    return n > 0 && n <= 30 ? n : null;
  };
  const pileRow = a => {
    const list = items.filter(p => p.category === a.key);
    if (!list.length) return null;
    const hot = a.key === "deleted" || a.key === "private";
    const soon = a.key === "deleted" ? list.map(dayLeft).filter(x => x != null).sort((x, y) => x - y)[0] : null;
    return h("section", { key: a.key, style: { padding: "0 20px", marginBottom: 26 } },
      h("button", { onClick: () => setOpened(a.key), className: "w-full text-left active:opacity-60", style: { display: "block" } },
        h("div", { className: "flex items-baseline", style: { gap: 9 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: hot ? ALBUM_ALERT : "#171417" } }, a.label),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: ALBUM_DIM } }, list.length + " 张")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.7, color: ALBUM_DIM, marginTop: 3 } },
          soon != null ? "还有 " + soon + " 天就真的没了" : a.why)),
      h("div", { className: "flex", style: { gap: 6, marginTop: 11 } },
        list.slice(0, 4).map((p2, i2) => h("button", {
          key: sig(p2), "data-watch": "item:" + (p2.caption || ""), onClick: () => openPhoto(p2), "data-wk": "pitem", className: "active:opacity-70",
          style: { flex: 1, minWidth: 0, aspectRatio: "1 / 1", borderRadius: 11, overflow: "hidden", background: "#eae7ea", position: "relative" }
        }, art(p2, 11)))));
  };
  const collections = h("div", { style: { padding: "18px 0 30px" } },
    // 藏起来的那两摞排在最前：翻TA手机时，那才是你真正在找的
    albums.slice().sort((a, b) => (b.key === "deleted" || b.key === "private" ? 1 : 0) - (a.key === "deleted" || a.key === "private" ? 1 : 0)).map(pileRow).filter(Boolean),
    items.length ? null : h("div", { style: { margin: "0 20px", padding: "40px 18px", borderRadius: 16, background: "#f4f2f4", color: ALBUM_DIM, textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))" } }, characterText(char, "刷新相册后，这里会出现他分好的那几摞。")));
  const favorites = h("div", { style: { padding: "4px 20px 30px" } }, saved.length ? grid(saved, true, 3) : h("div", { style: { textAlign: "center", padding: "70px 18px", color: "#8e8e93", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.8 } }, "还没有收藏照片。\n点开一张照片，再点爱心就会一直留在这里。"));
  const title = tab === "library" ? "全部" : tab === "saved" ? "我收着的" : characterText(char, "他的几摞");
  const sub = tab === "library" && items.length ? ((items[items.length - 1].date || items[items.length - 1].time || "") + " – " + (items[0].date || items[0].time || "")) : tab === "collections" ? characterText(char, "他把 ") + items.length + " 张分成了这几摞" : saved.length + " 张 · 刷新也不会丢";
  return h("div", { className: "h-full min-h-0 flex flex-col", "data-wk": "papp", "data-app": "album", style: { background: "#fff", animation: "qqIn .3s ease both" } }, chrome(title, sub, onBack), h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto" }, tab === "library" ? library : tab === "saved" ? favorites : collections), nav);
}

// 各 app 详情内容
// ============================================================
// 阅读 —— 五个书架、三十本书（她 2026-08-29 给了参考稿）
// 书架名不是分类标签，是【TA自己给这堆书起的名字】：
// 「导师以为我在看的论文」「凌晨两点的关东煮哲学」「怎么对付某个麻烦精」——
// 一看名字就知道是谁的书架。点开一本能看到TA读到哪、划了哪句、写了什么批注。
// 「我的」里是阅读档案：最爱的一本、本周读了多久、打算下一本读什么。
// ============================================================
const READ_PALETTES = [
  { id: "sage",  accent: "#9dc49a", shelf: "rgba(157,196,154,.12)", rail: "rgba(157,196,154,.20)", spine: ["#a9c9a2", "#d0e0c7"], text: "#22301f" },
  { id: "sand",  accent: "#d3bd91", shelf: "rgba(211,189,145,.12)", rail: "rgba(211,189,145,.20)", spine: ["#d6c39a", "#ebe0c5"], text: "#33291a" },
  { id: "steel", accent: "#93b1cc", shelf: "rgba(147,177,204,.12)", rail: "rgba(147,177,204,.20)", spine: ["#9db7d0", "#c9d9e7"], text: "#1d2a35" },
  { id: "rose",  accent: "#d3a2b0", shelf: "rgba(211,162,176,.12)", rail: "rgba(211,162,176,.20)", spine: ["#d6a9b6", "#edd1d9"], text: "#341f27" },
  { id: "amber", accent: "#d9a97e", shelf: "rgba(217,169,126,.12)", rail: "rgba(217,169,126,.20)", spine: ["#dcae86", "#f1d7bc"], text: "#35240f" }
];
// 深色阅读底：暖黑，不是纯灰黑（纯灰黑配暖色书脊会发脏）
const READ_BG = "#15140f";
const READ_CARD = "#1e1c16";
const READ_INK = "#ece6d8";
const READ_DIM = "rgba(236,230,216,.45)";
const READ_LINE = "rgba(236,230,216,.13)";
// 本周阅读目标环：颜色就是「离目标还有多远」，不用再写一行字解释
const readGoalColor = p => p >= 1 ? "#8fc98a" : p >= 0.66 ? "#d7c07a" : p >= 0.33 ? "#dda86e" : "#d4826a";
// 「7小时5分」→ 425
const readMinutes = v => {
  const str = String(v || "");
  const hh = /(\d+)\s*(?:小时|个?小?时|h)/i.exec(str);
  const mm = /(\d+)\s*(?:分钟|分|min)/i.exec(str);
  const n = (hh ? Number(hh[1]) * 60 : 0) + (mm ? Number(mm[1]) : 0);
  if (n) return n;
  const bare = /^\s*(\d+(?:\.\d+)?)\s*$/.exec(str);
  return bare ? Math.round(Number(bare[1]) * 60) : 0;
};
const readFmtMin = n => {
  n = Math.max(0, Math.round(Number(n) || 0));
  const hh = Math.floor(n / 60), mm = n % 60;
  return hh ? hh + " 小时" + (mm ? " " + mm + " 分" : "") : mm + " 分";
};
function ReadingView({ d, char, t, onBack, onRefresh, refreshing, onPeek, drive }) {
  const [tab, setTab] = useState("shelf");
  const [book, setBook] = useState(null);
  // ── 「看TA玩」驱动（第五批）──
  const driveTab = drive && drive.tab, driveItem = drive && drive.item;
  useEffect(() => { if (drive && driveTab) { setTab(driveTab); setBook(null); } }, [driveTab]);
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setBook(null); return; }
    // 先摊平再挑：书分在几个架子上，一架一架各挑各的就会「挑到哪一本看运气」
    const A0 = a => Array.isArray(a) ? a : [];
    const flat = [];
    A0(d && d.shelves).forEach(sh => A0(sh && sh.books).forEach((b, i) => {
      if (b) flat.push({ b: b, shelf: (sh && sh.name) || "", no: i + 1 });
    }));
    const hit = watchOpenPick(flat, driveItem, x => x && x.b && x.b.title);
    // ⚠️照这一屏自己的写法来：详情里还挂着 _shelf / _no 两栏（openBook 那一处）
    if (hit) setBook({ ...hit.b, _shelf: hit.shelf, _no: hit.no });
  }, [driveItem]);
  const scrollRef = useRef(null);
  const returnScroll = useRef({ top: 0, pending: false });
  const shelves = (Array.isArray(d && d.shelves) ? d.shelves : []).filter(x => x && typeof x === "object");
  const total = shelves.reduce((n, sh) => n + (Array.isArray(sh.books) ? sh.books.length : 0), 0);
  const marked = shelves.reduce((n, sh) => n + (Array.isArray(sh.books) ? sh.books.filter(b => b && String(b.quote || "").trim()).length : 0), 0);
  const archive = (d && typeof d.archive === "object" && d.archive) || {};
  // 详情返回要回到原来的位置（施工规则/mobile-ui-layout.md §3）
  const openBook = (b, sh, i) => {
    returnScroll.current = { top: scrollRef.current ? scrollRef.current.scrollTop : 0, pending: false };
    setBook({ ...b, _shelf: sh.name || "", _no: i + 1 });
  };
  const closeBook = () => { returnScroll.current.pending = true; setBook(null); };
  useEffect(() => {
    if (book || !returnScroll.current.pending) return;
    const top = returnScroll.current.top;
    returnScroll.current.pending = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = top; }));
  }, [book, tab]);
  const palOf = i => READ_PALETTES[i % READ_PALETTES.length];
  const chrome = h(Head, { zh: tab === "shelf" ? "书架" : "阅读档案", bg: READ_BG, noLine: true, ink: READ_INK, onBack,
    right:
    h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演书架", className: "active:opacity-50 disabled:opacity-35 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: READ_INK })) });
  // 书脊：深底上一律浅色书脊配深字——保证每一架都看得清，也不会有哪一架糊进背景
  const spineStyle = (pal, w, ht) => ({
    width: w, height: ht, borderRadius: "3px 8px 8px 3px", position: "relative", overflow: "hidden",
    background: "linear-gradient(152deg," + pal.spine[0] + "," + pal.spine[1] + ")",
    boxShadow: "0 8px 18px rgba(0,0,0,.42)", padding: "15px 12px", flexShrink: 0
  });
  const spineEdge = h("div", { "aria-hidden": "true", style: { position: "absolute", right: 0, top: 0, bottom: 0, width: 8, background: "linear-gradient(90deg,rgba(0,0,0,.10),#fbf8f0 45%,#eee9dd)" } });
  // ── 一架书（v59.49 换骨架）───────────────────────────────────────────────
  // 她 2026-09-01（配了对比图）：「书架也是……layout is just straight up plagiarism」。
  // 抄的是这三样：**大号编号 01/02**、**「/ english_slug」那行**、
  // **一排横滑的书脊卡片**。前两样是目录和货架的编号法——书架名本身已经很有脾气了
  //（「老头以为我在读的」），前面挂个 01 只会把它降格成目录项；那行英文 slug 更是
  // 对这些角色毫无意义（一个古代王爷的书架不会有 frontier）。
  // 横滑书脊则是**书店的陈列方式**：一次只看得见两三本，还得划。
  //
  // 一个人自己的书架和书店的区别只有一样：**TA读到哪儿了、哪本放着没动。**
  // 书店永远不会告诉你这个。所以竖着一本一行，把「读到哪儿」摆在最显眼处，
  // 底下一条细线画出TA走了多远；停住的那本自己说话。
  const lastUpd = Number(d && d._lastUpd) || 0;
  const readPct = txt => {
    const t2 = String(txt || "");
    let m = /(\d{1,3})\s*%/.exec(t2);
    if (m) return Math.max(0, Math.min(100, +m[1]));
    m = /第?\s*(\d+)\s*[\/／]\s*(\d+)/.exec(t2);                      // 128/357
    if (m && +m[2] > 0) return Math.max(0, Math.min(100, Math.round(+m[1] / +m[2] * 100)));
    // ⚠️「快看完了」要排在「读完」前面——它里面含着「看完」，顺序反了就成了 100。
    if (/快完|快看完|快读完|最后|尾声|剩几页|就差/.test(t2)) return 92;
    if (/读完|看完|通读|全本|重读|第二遍|第三遍/.test(t2)) return 100;
    if (/没翻|没开|还没|一页都没|买来就/.test(t2)) return 0;
    if (/过半|一半/.test(t2)) return 50;
    if (/开头|前几页|刚开|才起头/.test(t2)) return 8;
    return null;
  };
  const stalled = txt => /放着|搁着|没再|停在|再没动|落灰|一直没/.test(String(txt || ""));
  const bookRow = (b, sh, i, pal) => {
    const pct = readPct(b.readAt);
    const cold = stalled(b.readAt);
    return h("button", {
      key: i, onClick: () => openBook(b, sh, i), "data-wk": "pitem", "data-watch": "item:" + (b.title || ""), className: "w-full text-left active:opacity-60",
      style: { display: "block", padding: "13px 2px 14px", borderTop: i ? "1px solid " + READ_LINE : "none" }
    },
      h("div", { className: "flex items-baseline", style: { gap: 10 } },
        // 红点＝**这一轮刷新动过这本**（她 2026-09-01：「只是改了这俩的话就在书上放个红点」）。
        // 比的是这本的 _upd 和整份的 _lastUpd：**同一个时间戳才算数**，
        // 所以下一次刷新如果没动它，点自己就灭了，不用另存一份「看过没」。
        (b._upd && b._upd === lastUpd) ? h("span", { "aria-hidden": "true", style: { width: 7, height: 7, borderRadius: 99, background: "#d9705f", flexShrink: 0, alignSelf: "center" } }) : null,
        h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.5, color: READ_INK, wordBreak: "break-word" } }, PTX(b.title || "无题")),
        b.author ? h("div", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: READ_DIM } }, PTX(b.author)) : null),
      b.readAt ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.7, color: cold ? pal.accent : READ_DIM, marginTop: 5 } }, PTX(b.readAt)) : null,
      // 走了多远：有百分比就画那么长，认不出来的不画——不画比画错强
      pct != null ? h("div", { "aria-hidden": "true", style: { height: 2, borderRadius: 2, background: READ_LINE, marginTop: 9, overflow: "hidden" } },
        h("div", { style: { width: Math.max(2, pct) + "%", height: "100%", borderRadius: 2, background: pal.accent } })) : null);
  };
  const shelfCard = (sh, si) => {
    const pal = palOf(si);
    const books = Array.isArray(sh.books) ? sh.books : [];
    return h("section", { key: si, style: { marginBottom: 30 } },
      h("div", { style: { borderLeft: "3px solid " + pal.accent, paddingLeft: 12, marginBottom: 4 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", lineHeight: 1.35, color: READ_INK, wordBreak: "break-word" } }, PTX(sh.name || "没起名的一架")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: READ_DIM, marginTop: 4 } },
          books.length ? books.length + " 本 · " + (function () {
            const done = books.filter(b => readPct(b.readAt) === 100).length;
            const cold = books.filter(b => stalled(b.readAt)).length;
            return [done ? "读完 " + done : "", cold ? cold + " 本放着没动" : ""].filter(Boolean).join(" · ") || "都还在读";
          })() : "还是空的")),
      books.map((b, i) => bookRow(b, sh, i, pal)));
  };
  const shelfPage = h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "2px 16px 20px", background: READ_BG } },
    h("div", { className: "flex items-center gap-3", style: { padding: "8px 24px 16px" } },
      h("div", { style: { flex: 1, height: 1, background: READ_LINE } }),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: READ_DIM } }, "共 " + total + " 本书"),
      h("div", { style: { flex: 1, height: 1, background: READ_LINE } })),
    shelves.length ? shelves.map(shelfCard) : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: READ_DIM } }, T("书架还是空的，点右上角让他把书摆出来")));
  // ── 阅读档案 ──
  // iOS 图书那种目标环：颜色本身就是进度，不用再写一句「完成度 62%」
  const goalRing = (pct, size) => {
    const r = (size - 15) / 2, circ = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
    const col = readGoalColor(p);
    const cx = size / 2;
    return h("svg", { width: size, height: size, viewBox: "0 0 " + size + " " + size, "aria-hidden": "true" },
      h("circle", { cx: cx, cy: cx, r: r, fill: "none", stroke: "rgba(236,230,216,.10)", strokeWidth: 12 }),
      h("circle", {
        cx: cx, cy: cx, r: r, fill: "none", stroke: col, strokeWidth: 12, strokeLinecap: "round",
        strokeDasharray: circ, strokeDashoffset: circ * (1 - p), transform: "rotate(-90 " + cx + " " + cx + ")"
      }));
  };
  const fav = (archive.favorite && typeof archive.favorite === "object") ? archive.favorite : {};
  const plan = (archive.plan && typeof archive.plan === "object") ? archive.plan : {};
  const doneMin = readMinutes(archive.weekTime);
  const goalMin = readMinutes(archive.weekGoal) || 300;
  const pct = goalMin ? doneMin / goalMin : 0;
  const miniBook = (b, pal, label) => h("div", { className: "flex items-center gap-4" },
    h("div", { style: spineStyle(pal, 62, 88) }, spineEdge,
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(10.5px * var(--app-fs, 1))", lineHeight: 1.3, color: pal.text, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", paddingRight: 4 } }, (b && b.title) || "—")),
    h("div", { className: "flex-1 min-w-0" },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: READ_DIM } }, label),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", lineHeight: 1.35, color: READ_INK, marginTop: 5 } }, PTX((b && b.title) || "—")),
      (b && b.author) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: READ_DIM, marginTop: 4 } }, PTX(b.author)) : null));
  const statCell = (n, label) => h("div", { className: "flex-1 text-center" },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", color: READ_INK } }, n),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: READ_DIM, marginTop: 3 } }, label));
  const minePage = h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 18px 22px", background: READ_BG } },
    (archive.name || archive.uid) ? h("div", { className: "flex items-baseline", style: { gap: 9, padding: "6px 4px 12px" } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: READ_INK } }, archive.name || ""),
      archive.uid ? h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(11px * var(--app-fs, 1))", color: READ_DIM } }, "书友号 " + archive.uid) : null) : null,
    h("div", { "data-wk": "block", style: { background: READ_CARD, borderRadius: 18, padding: "22px 20px" } },
      h("div", { className: "flex items-center gap-5" },
        h("div", { style: { position: "relative", width: 108, height: 108, flexShrink: 0 } }, goalRing(pct, 108),
          h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: READ_INK, lineHeight: 1 } }, Math.round(Math.min(1, pct) * 100) + "%"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: READ_DIM, marginTop: 4 } }, "本周目标"))),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: READ_DIM } }, "这周读了"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(25px * var(--app-fs, 1))", color: READ_INK, marginTop: 4 } }, archive.weekTime || readFmtMin(doneMin)),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: READ_DIM, marginTop: 6 } },
            pct >= 1 ? T("已经超过他给自己定的 ") + readFmtMin(goalMin) : "离 " + readFmtMin(goalMin) + " 还差 " + readFmtMin(goalMin - doneMin)))),
      h("div", { className: "flex", style: { marginTop: 20, paddingTop: 16, borderTop: "1px solid " + READ_LINE } },
        statCell(total, "本书"), statCell(shelves.length, "个书架"), statCell(marked, "处划线"))),
    h("div", { "data-wk": "block", style: { background: READ_CARD, borderRadius: 18, padding: "20px", marginTop: 14 } }, miniBook(fav, palOf(0), "最爱的一本")),
    h("div", { "data-wk": "block", style: { background: READ_CARD, borderRadius: 18, padding: "20px", marginTop: 12 } }, miniBook(plan, palOf(2), "打算下一本读")),
    onPeek ? h("button", {
      onClick: () => onPeek({ tier: "quiet", label: "阅读档案", title: T("他最近在读的"), text: [fav.title ? "最爱《" + fav.title + "》" : "", archive.weekTime ? "这周读了 " + archive.weekTime : "", plan.title ? "打算读《" + plan.title + "》" : ""].filter(Boolean).join("｜") }),
      className: "w-full active:opacity-60",
      style: { marginTop: 18, padding: "13px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid " + READ_LINE, color: READ_INK }
    }, T("转发给 TA · 他会知道你翻了手机")) : null);
  // 内页底栏：高度以主聊天输入栏为标尺（施工规则/mobile-ui-layout.md §2）——
  // 只吃 0.4 条底部安全区，不许再 + Npx，也不给 minHeight 垫高
  const nav = h("div", {
    className: "shrink-0 grid grid-cols-2",
    style: { padding: "5px 30px", paddingBottom: COMPOSER_PAD_BOTTOM, background: READ_CARD, borderTop: "1px solid " + READ_LINE }
  }, [["shelf", "书架"], ["mine", "我的"]].map(([k, label]) => h("button", {
    key: k, onClick: () => { setTab(k); setBook(null); }, "data-wk": "ptab", "data-on": tab === k ? "1" : "0", "data-watch": "tab:" + k,
    className: "flex flex-col items-center justify-center active:opacity-60",
    style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: tab === k ? "#9dc49a" : READ_DIM, paddingTop: 2, paddingBottom: 2 }
  }, h("div", { style: { width: 30, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: tab === k ? "rgba(157,196,154,.18)" : "transparent" } },
    h(PGlyph, { k: k === "shelf" ? "reading" : "me", size: 14, color: tab === k ? "#9dc49a" : READ_DIM })),
  h("span", { style: { marginTop: 2 } }, label))));
  // 一本书的详情：书签 + 书名作者 + 读到 + 划的那句 + 批注
  const detail = book ? h("div", { "data-wk": "pdetail",
    className: "absolute inset-0 flex flex-col justify-center px-4",
    style: { background: "rgba(6,6,4,.62)", zIndex: 30 }, onClick: closeBook
  }, h("div", {
    onClick: e => e.stopPropagation(),
    style: { background: READ_CARD, borderRadius: 16, maxHeight: "82%", overflowY: "auto", boxShadow: "0 22px 50px rgba(0,0,0,.55)" }
  }, h("div", { className: "relative flex items-center justify-between px-4", style: { minHeight: 60, borderBottom: "1px solid " + READ_LINE } },
    h("button", { onClick: closeBook, "aria-label": "关闭", className: "active:opacity-60 flex items-center justify-center", style: { width: 34, height: 34, borderRadius: 99, border: "1px solid " + READ_LINE, fontSize: "calc(15px * var(--app-fs, 1))", color: READ_DIM } }, "✕"),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: READ_DIM, textAlign: "right" } }, (book._shelf || "书架") + " · Vol." + String(book._no).padStart(2, "0")),
    h("div", { "aria-hidden": "true", style: { position: "absolute", left: "50%", top: -11, marginLeft: -16, width: 32, height: 40, background: "#2a2720", clipPath: "polygon(0 0,100% 0,100% 100%,50% 76%,0 100%)" } })),
  h("div", { style: { padding: "22px 22px 26px" } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(26px * var(--app-fs, 1))", lineHeight: 1.25, color: READ_INK } }, PTX(book.title || "无题")),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: READ_DIM, marginTop: 7 } }, PTX(book.author || "")),
    book.readAt ? h("div", { "data-wk": "block", style: { marginTop: 20, borderLeft: "3px solid #9dc49a", background: "rgba(157,196,154,.09)", padding: "13px 15px", borderRadius: "0 8px 8px 0" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: READ_DIM } }, "读到"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: READ_INK, marginTop: 6 } }, PTX(book.readAt))) : null,
    book.quote ? h("div", { "data-wk": "block", style: { marginTop: 11, borderLeft: "3px solid #d3bd91", background: "rgba(211,189,145,.09)", padding: "13px 15px", borderRadius: "0 8px 8px 0" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: READ_DIM } }, T("他划的一句")),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.85, color: READ_INK, marginTop: 6 } }, PTX(book.quote))) : null,
    // ── 批注条：只有「看TA玩」演到写批注那一下才出现 ──
    drive && drive.typing != null ? h("div", { "data-wk": "pinput", "data-watch": "input", style: { marginTop: 11, borderLeft: "3px solid #d3a2b0", background: "rgba(211,162,176,.09)", padding: "13px 15px", borderRadius: "0 8px 8px 0" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: READ_DIM } }, characterText(char, "他正在写的批注")),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.95, color: READ_INK, marginTop: 6, whiteSpace: "pre-wrap", minHeight: 22 } },
        drive.typing,
        h("span", { style: { display: "inline-block", width: 1.5, height: 15, background: READ_INK, marginLeft: 1, verticalAlign: "-2px", animation: "wkcaret 1s steps(1) infinite" } })),
      h("div", { "data-wk": "pbtn", "data-part": "send", "data-watch": "send", style: { marginTop: 10, textAlign: "center", borderRadius: 8, padding: "7px 0", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: drive.typing ? "#fff" : "#9a9a9a", background: drive.typing ? "#b07f8e" : "rgba(0,0,0,.06)" } }, "记下")) : null,
    book.note ? h("div", { "data-wk": "block", style: { marginTop: 11, borderLeft: "3px solid #d3a2b0", background: "rgba(211,162,176,.09)", padding: "13px 15px", borderRadius: "0 8px 8px 0" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: READ_DIM } }, "批注"),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.95, color: READ_INK, marginTop: 6, whiteSpace: "pre-wrap" } }, PTX(book.note))) : null,
    onPeek ? h("button", {
      onClick: () => onPeek({ tier: "quiet", label: T("他读的书"), title: "《" + (book.title || "") + "》" + (book.readAt ? " · " + book.readAt : ""), text: [book.quote ? T("他划了：") + book.quote : "", book.note].filter(Boolean).join("｜") }),
      className: "w-full active:opacity-60",
      style: { marginTop: 20, padding: "13px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid " + READ_LINE, color: READ_INK }
    }, T("转发给 TA · 他会知道你翻了手机")) : null))) : null;
  return h("div", { className: "h-full min-h-0 flex flex-col relative", "data-wk": "papp", "data-app": "reading", style: { background: READ_BG } },
    chrome, tab === "shelf" ? shelfPage : minePage, nav, detail);
}
// ============================================================
// 购物 —— 一整个网购 App（她 2026-08-29 给了参考稿）
// 原来的「购物」是一串商品清单、「订单」是外卖打车流水，两个喂同一份上下文必然复读。
// 合成一个：账户 / 在途 / 购物车 / 想买 / 订单 / 习惯 / 店铺 / 券 / 浏览 / 地址 / 往来 / 月结。
// 真正值钱的是三栏：想买清单的「为什么想买」、订单的「下单理由」、往来的「一句备注」，
// 以及那条不是自己家的收货地址。
// ============================================================
// ── 配色（v59.38，她 2026-09-01：「购物那套也是和别人的参考太像了」）──────────
// 撞的正是那个组合本身：**橙 + 冷灰白 = 电商**，谁看都认得出是哪一家。
// 外卖那一路走的是「被火烤过的颜色」；购物这一路不能也走暖的，两个 app 会糊成一个。
// 它该长成另一件东西：**帖子和册页**——买东西这件事在这儿不是下单，是「想要、
// 舍不得、买给谁」，那是写在纸上的账，不是货架。
// 所以：冷青纸做底、靛蓝当墨与强调、朱砂只留给钱和「舍不得」那几笔。
// 靛蓝不是任何一家电商的品牌色，而朱砂一出现就是印章，不是促销价签。
//
// ⚠️结构色一律走常量（跟外卖那次同一个理由）：散着字面值，换一次色必有找漏的。
const SHOP_ACCENT = "#3f5f8a";   // 靛蓝：小标题、状态、店名旁的强调
const SHOP_MARK = "#b1493c";     // 朱砂：钱、还没舍得付的那几件
// v62.58 审美审计点名：这一页「把电商骨架拆干净了，但说好的『册页』一个元素都没长出来」。
// 底原来是一层冷青渐变——渐变是任何 app 都能铺的一层，纸不是。
// 改成毛边纸：本色偏冷但确实是纸，加一层【帘纹】（手工纸对着光看见的那种竖纹）。
const SHOP_BG = "#e6e9ec";       // 毛边纸（本色偏冷：这一册跟外卖那套暖色要分得开）
const SHOP_LAID = "repeating-linear-gradient(90deg, rgba(31,39,51,.045) 0 1px, transparent 1px 6px)";
const SHOP_FRAME = "rgba(31,39,51,.34)";  // 版框那两道边栏线
const SHOP_INK = "#1f2733";      // 靛墨
const SHOP_DIM = "#8b95a3";      // 冷灰
const SHOP_BODY = "#414d5e";     // 正文
const SHOP_LINE = "#e3e8ee";     // 分隔线
// ⚠️跟 fmtMoney 同一条路：规则在 js/money.js 一处，这儿只是转交口。
// 第二个参数是【这是谁的钱】——这一屏是 ShoppingView({ d, char })，永远传 char.id。
const shopMoney = (n, charId) => (typeof Money !== "undefined" && Money)
  ? Money.fmt(n, charId)
  : "¥" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shopInt = n => Number(n || 0).toLocaleString("en-US");
function CartPayBtn({ char, it, pay, kind }) {
  const [st, setSt] = React.useState("");   // "" → "ask" → "paid"
  if (st === "paid") return h("div", { style: { marginTop: 10, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: SHOP_DIM } }, "已替TA付了，在路上");
  return h("button", { onClick: () => { if (st !== "ask") { setSt("ask"); return; } setSt(pay(char, it, kind || "cart") ? "paid" : ""); },
    className: "active:opacity-75", style: { marginTop: 10, minHeight: 34, padding: "0 14px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))",
      background: st === "ask" ? SHOP_MARK : "transparent", color: st === "ask" ? "#fff" : SHOP_MARK, border: "1px solid " + SHOP_MARK } },
    st === "ask" ? "确认付 " + shopMoney((Number(it.price) || 0) * (Number(it.qty) || 1), char.id) : "替TA付了，送给TA");
}
function ShoppingView({ d, char, t, onBack, onRefresh, refreshing, onPeek, monthStats, drive }) {
  // 替TA付购物车里那件（群友 2026-10-02：「查手机看到 TA 加入购物车还没买的东西，能直接帮他付款送给他」）：
  //   点一下变「确认付 ¥X」，再点才付；付了的那件从车里消失、变成一份礼物在路上（app.js 的 window.__phoneCart）
  //   按钮自己是个小组件（CartPayBtn）：这一屏本身不用 hook，渲染冒烟测试是直接当函数调它的
  const PC = (typeof window !== "undefined" && window.__phoneCart) || null;
  const [tab, setTab] = useState("home");
  const [sheet, setSheet] = useState(null);
  // ── 「看TA玩」驱动（第四批）──────────────────────────────────────
  // ⚠️只加一条同步：drive 不在的时候这一屏一个像素都没变（跟微信那几屏同一个做法）。
  const driveTab = drive && drive.tab, driveItem = drive && drive.item;
  useEffect(() => { if (drive && driveTab) { setTab(driveTab); setSheet(null); } }, [driveTab]);
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setSheet(null); return; }
    const pool = [].concat(Array.isArray(d && d.wish) ? d.wish : [], Array.isArray(d && d.cart) ? d.cart : []);
    const hit = watchOpenPick(pool, driveItem, x => x && x.title);
    if (hit) setSheet({ kind: "wish", it: hit });
  }, [driveItem]);
  const scrollRef = useRef(null);
  // 换页回到顶部；同一页内来回开详情不动位置
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab]);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const acc = (data.account && typeof data.account === "object") ? data.account : {};
  // 钱包算出来的本月数（没建钱包档就是 null，那时退回模型给的数）
  const ms = (monthStats && typeof monthStats === "object" && isFinite(Number(monthStats.spend))) ? monthStats : null;
  const habit = (data.habit && typeof data.habit === "object") ? data.habit : {};
  const initial = String(char.name || "?").trim().slice(0, 1);
  // 要跳出来的那一段，用【墨围】——册子里把一段话框起来的那道细线框，
  // 不是一张白色圆角卡（白卡叠在纸上就是把这一页拉回通用列表）。
  const card = (kids, extra) => h("div", { style: Object.assign({ border: "1px solid " + SHOP_FRAME, borderRadius: 0, padding: "15px 14px", marginBottom: 14, background: "rgba(255,255,255,.34)" }, extra || {}) }, kids);
  // ⚠️白卡叠白卡是电商的排版（她 2026-09-01：「结构还是太像了」）。
  // 这几节的行本来就自带细线分隔，外面再套一层白卡纯属多余——而正是那层白卡
  // 让整页读起来像货架。改成一份清单：细线分节、留白分段，白卡只留给真要跳出来的地方。
  // （外卖那边保留白卡是因为它像盘子；购物这边没有这个理由。）
  // 一小行标签 + 一段正文。标签压得很轻（10.5px、淡色、带一点字距），
  // 只负责把几段话分开；重的仍然是内容本身。
  const labeled = (k, v, quiet) => h("div", { key: k, style: { marginTop: 12 } },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".06em", color: SHOP_DIM, marginBottom: 4 } }, k),
    h("div", { style: { fontFamily: F_BODY, fontSize: quiet ? 12 : 13.5, lineHeight: 1.75, color: quiet ? SHOP_DIM : SHOP_BODY, wordBreak: "break-word" } }, v));
  const plain = (kids, extra) => h("div", { style: Object.assign({ marginBottom: 16 }, extra || {}) }, kids);
  // 版心标题：字号收一档，底下压一道【界行】——册页里每一栏都靠界行分开，
  // 21px 大标题 + 右侧一句灰字是通用的 section header，换个 app 照样成立。
  const secTitle = (title, right) => h("div", { className: "flex items-baseline justify-between", style: { padding: "2px 0 7px", marginBottom: 10, borderBottom: "1px solid " + SHOP_FRAME, gap: 10 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", letterSpacing: ".06em", color: SHOP_INK } }, title),
    right ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: SHOP_DIM, flexShrink: 0 } }, right) : null);
  // 小签：方角、只有一道细边。圆角 7 的填色药丸是标签组件，册页上没有这种东西。
  const tag = (txt, i) => h("span", { key: i, style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: SHOP_DIM, border: "1px solid " + SHOP_LINE, borderRadius: 0, padding: "2px 8px" } }, txt);
  const peekBtn = (tier, label, title, text) => onPeek ? h("button", { "data-wk": "pbtn", "data-part": "peek",
    onClick: e => { e.stopPropagation(); onPeek({ tier, label, title, text }); },
    className: "active:opacity-60",
    style: {
      // 册页上不摆圆角药丸：这一枚是框在框里的一行字，跟墨围同一种边
      marginTop: 14, width: "100%", padding: "10px 0", borderRadius: 0, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))",
      border: "1px solid " + (tier === "hidden" ? "rgba(177,73,60,.5)" : SHOP_FRAME), color: tier === "hidden" ? SHOP_MARK : SHOP_BODY
    }
  }, tier === "hidden" ? T("摆到 TA 面前 · 这是他藏起来的") : T("转发给 TA · 他会知道你翻了手机")) : null;
  // ⚠️账户卡整个撤了（v59.48，她 2026-09-01：「购物这块结构还是太像了」）。
  // 上一版砍的是零件（会员等级、积分、那排统计），骨架没动——而**骨架才是撞的那样东西**：
  // 一张头像方块 + 名字 + 一句话打头，那是所有 app 的「我的」页。
  // 何况这是**TA自己的手机**：在自己手机上摆一张卡告诉你TA是谁，纯粹是家具。
  // 里面唯一有内容的是 persona 那句（TA买东西的毛病），挪进「合起来看」。
  // ── 还在路上（v59.48 改成一行一样）───────────────────────────────────
  // 原来是【竖线 + 圆点 + 一张张白卡】：那是快递追踪页的形状，跟参考那份一模一样。
  // TA等的不是包裹，是**一样东西和一段等待**。所以一行一样：东西、还要等多久、
  // TA为什么在等。不要卡、不要圆点、不要状态徽章。
  const shipping = A(data.shipping);
  const shipSec = shipping.length ? h("section", { key: "ship" }, secTitle("还在路上", shipping.length + " 件没到"),
    h("div", { style: { marginBottom: 16 } }, shipping.map((it, i2) => h("div", {
      key: i2, style: { padding: "14px 2px", borderTop: i2 ? "1px solid " + SHOP_LINE : "none" }
    },
      h("div", { className: "flex items-baseline", style: { gap: 10 } },
        h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.5, color: SHOP_INK, wordBreak: "break-word" } }, PTX(it.title)),
        it.amount != null ? h("div", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: SHOP_MARK } }, shopMoney(it.amount, char.id)) : null),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: SHOP_DIM, marginTop: 5 } },
        [it.eta, it.shop].filter(Boolean).join(" · ")),
      it.why ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.75, color: SHOP_BODY, marginTop: 7 } }, PTX(it.why)) : null)))) : null;
  // ── 购物车 ──
  const paidT = PC ? PC.paid(char.id) : [];
  const cart = A(data.cart).filter(it => !paidT.includes(String(it.title || "")));
  const cartSec = cart.length ? h("section", { key: "cart" }, secTitle("还没舍得付", cart.length + " 件停在这儿"),
    plain(cart.map((it, i) => h("div", { key: i, className: "flex gap-3", "data-wk": "pitem", "data-watch": "item:" + (it.title || ""), style: { padding: "14px 0", borderTop: i ? "1px solid " + SHOP_LINE : "none" } },
      h("div", { className: "flex-1 min-w-0" },
        it.shop ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: SHOP_DIM } }, PTX(it.shop)) : null,
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.45, color: SHOP_INK, marginTop: 3 } }, PTX(it.title)),
        it.spec ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: SHOP_DIM, marginTop: 4 } }, PTX(it.spec)) : null,
        h("div", { className: "flex items-center gap-2 flex-wrap", style: { marginTop: 8 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: SHOP_MARK } }, shopMoney(it.price, char.id)),
          Number(it.was) > Number(it.price) ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#b9b9c2", textDecoration: "line-through" } }, shopMoney(it.was, char.id)) : null,
          // ⚠️「满减／限时」那枚促销标不画：那是货架上的标签，不是TA的事。
          // TA为什么把这件东西一直停在车里，写在下面 why 那一行。
          null,
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: SHOP_DIM, marginLeft: "auto" } }, "×" + (it.qty || 1))),
        PC ? h(CartPayBtn, { char, it, pay: PC.pay, kind: "cart" }) : null))))) : null;
  // ── 一直没下手的 ─────────────────────────────────────────────
  // 原来是【两列渐变卡 + 卡里一个首字方块】：那是货架缩略图，是这一页上最后一件
  // 电商家具（审美审计 2026-09-04）。何况那个渐变色块跟东西本身毫无关系——
  // 它只是在替一张不存在的商品图占位。
  // 册子里「看了很久没买」的东西不长成货架，长成【圈起来的那几条】：
  // 一条一样，界行分开，条目左边一枚朱砂圈——圈点是册子上真会有的记号。
  const wish = A(data.wish).filter(it => !paidT.includes(String(it.title || "")));
  const wishSec = wish.length ? h("section", { key: "wish" }, secTitle("一直没下手的", wish.length + " 样"),
    h("div", { style: { marginBottom: 16 } }, wish.map((it, i) => h("button", {
      key: i, className: "w-full text-left active:opacity-70", "data-wk": "pitem", "data-watch": "item:" + (it.title || ""),
      // ⚠️点开是看，不是发。转发一律要走详情里那颗单独的按钮——
      // 列表项直接触发转发是不可逆动作，手一滑就发出去了（她 2026-08-29 中招）。
      onClick: () => setSheet({ kind: "wish", it: it }),
      style: { display: "block", padding: "13px 0", borderTop: i ? "1px solid " + SHOP_LINE : "none" }
    },
      h("div", { className: "flex items-baseline", style: { gap: 9 } },
        // 朱砂圈：程序画的空心圈，不是图标字体也不是 emoji
        h("span", { "aria-hidden": "true", style: { flexShrink: 0, width: 9, height: 9, borderRadius: 99, border: "1.4px solid " + SHOP_MARK, transform: "translateY(-1px)" } }),
        h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.5, color: SHOP_INK, wordBreak: "break-word" } }, PTX(it.title)),
        h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: SHOP_MARK, whiteSpace: "nowrap" } }, shopMoney(it.price, char.id))),
      it.shop ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: SHOP_DIM, marginTop: 4, paddingLeft: 18 } }, PTX(it.shop)) : null,
      it.why ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.8, color: SHOP_BODY, marginTop: 6, paddingLeft: 18, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, PTX(it.why)) : null)))) : null;
  // ── 我的订单 ──
  const orders = A(data.orders);
  const orderSec = orders.length ? h("section", { key: "ord" }, secTitle("买过的", orders.length + " 次"),
    // 一单一张白卡＝一张张收据，还是电商那个排版。改成细线分隔的条目。
    plain(orders.map((o, i) => h("div", { key: i, style: { padding: "16px 2px", borderTop: i ? "1px solid " + SHOP_LINE : "none" } }, [
      // ⚠️店名和商品名原来都是 16px 的深色，一样重——读的人分不出哪个是主角。
      // 店和时间是【这一单的出处】，压成一行小字；**买的那样东西才是主角**。
      h("div", { key: "h", className: "flex items-baseline justify-between gap-3" },
        h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: SHOP_DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          [o.shop, o.time].filter(Boolean).join(" · ")),
        // 状态不画成一枚绿标（那是平台的订单状态徽章）；取消掉的那一单才值得说一句
        o.status === "已取消" ? h("div", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: SHOP_MARK } }, "后来退了") : null),
      o.title ? h("div", { key: "n", style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", lineHeight: 1.45, color: SHOP_INK, marginTop: 6, wordBreak: "break-word" } }, PTX(o.title)) : null,
      // 一单里买了哪几样：靠上下两道界行圈出来，不再嵌一块白底圆角。
      // 纸上再叠一块浅色圆角＝把这一页拉回通用列表（审美审计点名的正是这一类）。
      A(o.items).length ? h("div", { key: "it", style: { borderTop: "1px solid " + SHOP_LINE, borderBottom: "1px solid " + SHOP_LINE, padding: "10px 2px", marginTop: 12 } },
        A(o.items).map((x, j) => h("div", { key: j, className: "flex items-start gap-3", style: { padding: j ? "10px 0 0" : "0", borderTop: j ? "1px solid " + SHOP_LINE : "none", marginTop: j ? 10 : 0 } },
          h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.6, color: SHOP_BODY } }, (x.name || "") + (x.spec ? " · " + x.spec : "")),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: SHOP_DIM, flexShrink: 0 } }, "×" + (x.qty || 1)),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: SHOP_BODY, flexShrink: 0, minWidth: 54, textAlign: "right" } }, shopMoney(x.price, char.id))))) : null,
      h("div", { key: "p", className: "flex items-baseline justify-between", style: { marginTop: 13 } },
        // 运费单列是收据的排版，不是这个人的事；只留TA真花掉的那个数
        h("span", null),
        Number(o.paid) > 0 ? h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: SHOP_MARK } }, shopMoney(o.paid, char.id)) : null),
      A(o.tags).length ? h("div", { key: "g", className: "flex gap-2 flex-wrap", style: { marginTop: 12 } }, A(o.tags).map(tag)) : null,
      // ⚠️她 2026-09-01：「现在啥格式都去掉太平了，看不出来哪些是啥」。
      // 撤掉白卡是对的（那是电商的排版），但**层次不能跟着一起撤**——
      // 评价、为什么买、送到哪儿三段字号颜色都差不多，读起来就是一坨。
      // 层次改用【小标签】重建：标签是我们自己的说法，不是平台部件，
      // 而且它顺带答了「这句话是谁说的」——评价是TA写的，理由是TA自己的心思。
      o.review ? labeled(characterText(char, "他写的"), o.review) : null,
      o.reason ? labeled("为什么买这个", o.reason) : null,
      o.addr ? labeled("送到", o.addr, true) : null,
      h("div", { key: "pk" }, peekBtn("quiet", T("他的订单"), o.title || o.shop, [o.reason, o.review, o.addr].filter(Boolean).join("｜")))
    ])))) : null;
  // ── 买东西这件事上（v59.38）──────────────────────────────────────────
  // 原来是【预算／常买／不买／习惯】四行标签表——那是电商的「消费画像」，
  // 换个角色照样成立（跟外卖那张口味画像表同一个病）。改成问句：
  // 每一问都得答出这个人才成立，而且答案是成句的话，不是一个词。
  // 字段沿用旧的那几个，老存档照样读得出来。
  const askRow = (q, node) => h("div", { style: { padding: "16px 0", borderTop: "1px solid " + SHOP_LINE } },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: SHOP_DIM, marginBottom: 9 } }, q),
    node);
  const askLine = txt => h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.8, color: SHOP_INK, wordBreak: "break-word" } }, txt);
  const habitAsks = [
    [T("他什么都舍得，除了这个"), habit.avoids],
    [T("哪一样他会重复买，买到自己都不好意思"), habit.buys],
    [T("多少钱以上他要犹豫一晚上"), habit.budget],
    [T("他是什么时候点下那个付款的"), habit.how]
  ].filter(x => x[1]);
  const habitSec = habitAsks.length ? h("section", { key: "hb" }, secTitle("买东西这件事上", characterText(char, "他的取舍")),
    card(habitAsks.map(([q, v], i) => h("div", { key: i }, askRow(q, askLine(v))))),
    peekBtn("quiet", T("他买东西的样子"), T("他的取舍"), habitAsks.map(([q, v]) => q + "：" + v).join("｜"))) : null;
  // ── 常逛店铺 ──
  const shops = A(data.shops);
  const shopSec = shops.length ? h("section", { key: "sh" }, secTitle("总回的那几家"),
    plain(shops.map((sp, i) => h("div", { key: i, className: "flex gap-3", style: { padding: "13px 0", borderTop: i ? "1px solid " + SHOP_LINE : "none" } },
      h("div", { className: "flex-1 min-w-0" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: SHOP_INK } }, PTX(sp.name || "")),
        sp.cat ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: SHOP_DIM, marginTop: 3 } }, PTX(sp.cat)) : null,
        sp.why ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.65, color: SHOP_DIM, marginTop: 6 } }, PTX(sp.why)) : null))))) : null;
  // ⚠️优惠券整栏【不画】（跟外卖那次同一条：她 2026-08-31「和另一个太像了」）。
  // 那是一张营销位：折扣规则、适用范围、有效期——纯平台部件，换个角色照样成立，
  // 一条关于这个人的东西都读不出来。生成层照旧留着（她定的「只砍显示」）。
  // ── 最近浏览 ──
  const viewed = A(data.viewed).filter(it => !paidT.includes(String(it.title || "")));
  const viewSec = viewed.length ? h("section", { key: "vw" }, secTitle("反复看过的", "看了没买"),
    plain(viewed.map((v, i) => h("div", { key: i, className: "flex items-start gap-3", style: { padding: "13px 0", borderTop: i ? "1px solid " + SHOP_LINE : "none" } },
      h("div", { className: "flex-1 min-w-0" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.45, color: SHOP_INK } }, PTX(v.title || "")),
        v.shop ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: SHOP_DIM, marginTop: 5 } }, PTX(v.shop)) : null,
        PC && Number(v.price) > 0 ? h(CartPayBtn, { char, it: v, pay: PC.pay, kind: "viewed" }) : null),
      h("div", { style: { flexShrink: 0, textAlign: "right" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: SHOP_MARK } }, shopMoney(v.price, char.id)),
        v.time ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: SHOP_DIM, marginTop: 4 } }, v.time) : null)))))  : null;
  // ── 收货地址（不是自己家的那条走 hidden） ──
  const addrs = A(data.addrs);
  const addrSec = addrs.length ? h("section", { key: "ad" }, secTitle("送到哪儿"),
    plain(addrs.map((a, i) => h("div", { key: i, style: { padding: "14px 0", borderTop: i ? "1px solid " + SHOP_LINE : "none" } },
      h("div", { className: "flex items-center gap-2" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: SHOP_INK } }, a.label || ""),
        a.isDefault ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#3d7dd8", background: "rgba(61,125,216,.10)", borderRadius: 6, padding: "3px 8px" } }, "默认") : null,
        a.tail ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: SHOP_DIM, marginLeft: "auto" } }, PTX(a.tail)) : null),
      a.detail ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.7, color: SHOP_DIM, marginTop: 7 } }, PTX(a.detail)) : null,
      !a.isDefault ? h("div", null, peekBtn("hidden", "收货地址", a.label, a.detail)) : null)))) : null;
  // ── 相关往来 ──
  const gifts = A(data.gifts);
  const giftSec = gifts.length ? h("section", { key: "gf" }, secTitle("买给别人的"),
    plain(gifts.map((g, i) => h("div", { key: i, style: { padding: "15px 0", borderTop: i ? "1px solid " + SHOP_LINE : "none" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: SHOP_DIM } }, PTX(g.who || "")),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.45, color: SHOP_INK, marginTop: 6 } }, PTX(g.title || "")),
      g.note ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.7, color: SHOP_DIM, marginTop: 7 } }, PTX(g.note)) : null,
      h("div", null, peekBtn("quiet", T("他给谁买的东西"), (g.who || "") + " · " + (g.title || ""), g.note))))))  : null;
  // ── 本月概况 ──
  // ⚠️钱包算出来的那两个数【必须还看得见】。上面那一排统计块删掉了（那是平台部件），
  // 但「以钱包流水为准、不用模型编的数」这条不能跟着一起没——它防的是
  // 同一屏两处说着不同的钱。所以改成一句话摆在这一段的开头。
  // ⚠️钱包只有【记着东西】的时候才算数（她 2026-09-01：「这里 bug 了怎么是 0」）。
  // ms.spend 是 0 也是 isFinite，于是空钱包被当成权威，屏幕上写出「花掉 ¥0.00，0 单」
  // ——那不是「TA这阵子没花钱」，是**我们还不知道TA花了多少**。
  // 空钱包等同于没建档：退回模型那份；两份都没有就整句不出现，不硬报一个数。
  const msReal = ms && (Number(ms.spend) > 0 || Number(ms.orders) > 0) ? ms : null;
  const spendLine = msReal
    ? "这一阵花掉 " + shopMoney(msReal.spend, char.id) + "，" + shopInt(msReal.orders) + " 单"
    : (Number(acc.monthSpend) > 0 ? "这一阵花掉 " + shopMoney(acc.monthSpend, char.id) + (Number(acc.monthOrders) > 0 ? "，" + shopInt(acc.monthOrders) + " 单" : "") : "");
  // acc.persona（TA买东西的毛病）原来挂在账户卡上。账户卡撤了，这句得有地方去——
  // 它本来就属于「合起来看」：那一段说的正是TA这个人怎么花钱。
  const monthSec = (data.monthNote || data.tail || spendLine || acc.persona) ? h("section", { key: "mn" }, secTitle("合起来看", characterText(char, "这一阵他是这么花钱的")),
    acc.persona ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.75, color: SHOP_INK, padding: "0 2px 14px" } }, PTX(acc.persona)) : null,
    // TA在这个平台上的号：账户卡撤了，但这一条不能跟着一起没
    //（她 2026-08-29 专门要过「每个 app 都给TA一个自己的 id」）。
    // 只是它不配再占一整张卡——落成一行小字。
    (acc.name || acc.uid) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: SHOP_DIM, padding: "0 2px 14px" } },
      [acc.name, acc.uid ? "账号 " + acc.uid : ""].filter(Boolean).join(" · ")) : null,
    (spendLine || data.monthNote) ? card(h("div", null,
      spendLine ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: SHOP_INK, marginBottom: data.monthNote ? 12 : 0 } }, spendLine) : null,
      data.monthNote ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.95, color: SHOP_BODY } }, PTX(data.monthNote)) : null)) : null,
    data.tail ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.8, color: SHOP_DIM, textAlign: "center", padding: "6px 14px 4px" } }, PTX(data.tail)) : null) : null;
  // 不再照标准电商的「首页 / 购物车 / 订单 / 我的」复刻产品栏目。
  // 查手机真正要看的不是按钮在哪，而是这个人眼下在等什么、买过后留下什么、为什么取舍。
  // 旧数据结构全部兼容，只在阅读层重组为三条角色生活线。
  const PAGES = [
    { key: "home", zh: "眼下", glyph: "cart", lead: "还悬在半路上的东西，比购买记录更接近此刻。", secs: [shipSec, cartSec], badge: shipping.length + cart.length },
    { key: "kept", zh: "留下", glyph: "orders", lead: "买过、送过、付过的钱，最后留下的是理由和人。", secs: [orderSec, giftSec, monthSec], badge: orders.length },
    { key: "choice", zh: "取舍", glyph: "me", lead: "反复看却没买、总去的店和明确不买的东西，拼成 TA 的选择。", secs: [wishSec, viewSec, habitSec, shopSec, addrSec] }
  ];
  const page = PAGES.find(x => x.key === tab) || PAGES[0];
  const body = page.secs.filter(Boolean);
  const emptyWord = { home: "眼下没有在途或犹豫中的东西", kept: "还没有留下购买与往来的痕迹", choice: "还看不出 TA 买东西时怎么取舍" }[page.key];
  const nav = h("div", {
    // ⚠️列数跟着 PAGES 走：写死 grid-cols-4 的话，加一档就挤成两行
    className: "shrink-0 grid",
    style: { gridTemplateColumns: "repeat(" + PAGES.length + ",minmax(0,1fr))", padding: "5px 12px", paddingBottom: COMPOSER_PAD_BOTTOM, background: "rgba(255,255,255,.96)", borderTop: "1px solid #e8e8ee" }
  }, PAGES.map(pg => h("button", {
    key: pg.key, onClick: () => { setTab(pg.key); setSheet(null); }, "data-wk": "ptab", "data-on": tab === pg.key ? "1" : "0", "data-watch": "tab:" + pg.key,
    className: "flex flex-col items-center justify-center active:opacity-60",
    style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: tab === pg.key ? SHOP_ACCENT : SHOP_DIM, paddingTop: 2, paddingBottom: 2 }
  }, h("div", { style: { position: "relative", width: 30, height: 20, display: "flex", alignItems: "center", justifyContent: "center" } },
    h(PGlyph, { k: pg.glyph, size: 16, color: tab === pg.key ? SHOP_ACCENT : SHOP_DIM }),
    pg.badge ? h("span", {
      style: { position: "absolute", top: -3, right: -1, minWidth: 15, height: 15, borderRadius: 99, background: SHOP_ACCENT, color: "#fff", fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }
    }, pg.badge > 99 ? "99+" : pg.badge) : null),
  h("span", { style: { marginTop: 2 } }, pg.zh))));
  const chrome = h(Head, { zh: page.zh,
    bg: "transparent",
    noLine: true,
    ink: SHOP_INK,
    onBack: onBack,
    right: h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-60 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40, marginRight: -8 } }, h(IRefresh, { size: 18, color: SHOP_INK })) });
  // ── 详情：整页，不是半窗（no-half-sheet）───────────────────────────
  // 原来是从底下掀起来的半窗。这一层的正文是TA为什么想买这样东西——
  // 那是这一格的命，从来不是三行能说完的，也不需要同时看见底下那一列。
  // 整页之后它就是册子里【单独一叶】：一样东西占一叶，理由抄在下面。
  const sheetNode = sheet && sheet.kind === "wish" ? (function () {
    const it = sheet.it || {};
    return h("div", { "data-wk": "phoneapppage", "data-part": "shoppingview",
      className: "absolute inset-0 h-full min-h-0 flex flex-col",
      style: { background: SHOP_BG, backgroundImage: SHOP_LAID, zIndex: 30 }
    },
      h(Head, { zh: "一直没下手的",
        bg: "transparent",
        noLine: true,
        ink: SHOP_INK,
        onBack: () => setSheet(null) }),
      h("div", {
        className: "flex-1 min-h-0 flex flex-col",
        style: { margin: "2px 13px 10px", border: "0.8px solid " + SHOP_FRAME, boxShadow: "0 0 0 2.5px " + SHOP_BG + ", 0 0 0 4px " + SHOP_FRAME }
      },
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "18px 16px 22px" } },
          h("div", { className: "flex items-baseline", style: { gap: 10 } },
            h("span", { "aria-hidden": "true", style: { flexShrink: 0, width: 10, height: 10, borderRadius: 99, border: "1.5px solid " + SHOP_MARK, transform: "translateY(-2px)" } }),
            h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", lineHeight: 1.45, color: SHOP_INK, wordBreak: "break-word" } }, PTX(it.title))),
          h("div", { className: "flex items-baseline", style: { gap: 10, marginTop: 9, paddingLeft: 20, paddingBottom: 12, borderBottom: "1px solid " + SHOP_FRAME } },
            it.shop ? h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: SHOP_DIM } }, PTX(it.shop)) : h("div", { style: { flex: 1 } }),
            h("div", { style: { flexShrink: 0, fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: SHOP_MARK } }, shopMoney(it.price, char.id))),
          it.why ? h("div", { style: { marginTop: 16 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", letterSpacing: ".06em", color: SHOP_DIM, marginBottom: 8 } }, T("他为什么想买")),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 2.05, color: SHOP_BODY, whiteSpace: "pre-wrap", textIndent: "2em" } }, PTX(it.why))) : null,
          PC && Number(it.price) > 0 ? h("div", { style: { marginTop: 14 } }, h(CartPayBtn, { char, it, pay: PC.pay, kind: "wish" })) : null,
          peekBtn("quiet", "想买清单", it.title, [it.shop, it.price != null ? shopMoney(it.price, char.id) : "", it.why].filter(Boolean).join("｜")))));
  })() : null;
  // 叶码：册页每一叶底下都有一个。中文数字，不是「1 / 3」——那是分页控件。
  const YE = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  const folio = h("div", { key: "folio", style: { textAlign: "center", padding: "22px 0 4px", fontFamily: F_DISPLAY, fontSize: "calc(11.5px * var(--app-fs, 1))", letterSpacing: ".3em", color: SHOP_DIM } },
    "第 " + (YE[Math.max(0, PAGES.findIndex(x => x.key === page.key))] || "一") + " 叶");
  return h("div", { "data-wk": "papp", "data-app": "shopping",
    className: "h-full min-h-0 flex flex-col relative",
    // 底纹铺在【最外那层外壳】上，顶栏透上来（mobile-ui-layout §3.5）；
    // 不挂 backgroundAttachment:"local"——内容在动，纸不该跟着动。
    style: { background: SHOP_BG, backgroundImage: SHOP_LAID }
  }, chrome,
  // TA在搜东西那一下才出现的搜索条：册页上不摆药丸，走【墨围】——方角、一道细线。
  // （她自己翻的时候一个像素都不画。）
  (drive && (drive.typing != null || drive.searchQ) && typeof window !== "undefined" && window.PhoneWatch)
    ? h("div", { className: "shrink-0 flex items-center", style: { margin: "0 13px 8px" } },
        h(window.PhoneWatch.WatchSearchPill, { typing: drive.typing, q: drive.searchQ,
          skin: { ink: SHOP_INK, dim: SHOP_DIM, soft: "rgba(255,255,255,.5)", accent: SHOP_MARK, radius: 0, border: "1px solid " + SHOP_FRAME } }))
    : null,
  // 版框：外粗内细的双边栏，册页最认得出的那个记号。它属于【这一叶】，
  // 所以钉在外面不跟着滚；正文在框里滚。
  h("div", {
    className: "flex-1 min-h-0 flex flex-col",
    style: { margin: "2px 13px 10px", border: "0.8px solid " + SHOP_FRAME, boxShadow: "0 0 0 2.5px " + SHOP_BG + ", 0 0 0 4px " + SHOP_FRAME }
  },
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "14px 14px 18px" } },
      // 小序：册子正文前那一小段，缩两格、比正文小一号、底下压一道界行。
      // 原来是「左边一道 3px 色条 + 右侧圆角」——那是引用块，任何 app 都有。
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.9, color: SHOP_DIM, textIndent: "2em", paddingBottom: 12, marginBottom: 14, borderBottom: "1px solid " + SHOP_LINE } }, PTX(page.lead)),
      body.length ? body : h("div", { style: { padding: "46px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: SHOP_DIM } }, emptyWord),
      body.length ? folio : null)),
  nav, sheetNode,
  // TA刚点进去的那一件商品页：手机里本来没有这一页，是这一段里现编的
  watchPageNode(drive, { bg: SHOP_BG, ink: SHOP_INK, dim: SHOP_DIM, line: SHOP_FRAME, body: SHOP_BODY, mark: SHOP_MARK }));
}
// ============================================================
// 外卖 —— TA怎么把自己喂饱（她 2026-08-29 点名先搭个框）
// 备注那一栏比吃什么更暴露人：「不要香菜」「放门口就行」
// 「麻烦轻一点敲门，家里有人在睡」——这三条是三个不同的人。
// 三页：点餐（在送 + 常点的店）· 订单 · 我的（口味 / 地址 / 月结）
// ============================================================
// ── 配色（v59.36，她 2026-09-01：「换一个好看有食欲的色」）─────────────────
// 原来是美团黄，跟参考那份撞了；上一版换成鼠尾草绿＋雾蓝灰，撞是不撞了，
// 可她说「不知道什么颜色」——那套读起来是诊所和体检报告，一点不像吃东西。
// 「有食欲」不是随便找个暖色：**食物的颜色是被火烤过的颜色**——
// 烤面包的燕麦底、陶土、焦糖、柿子。所以：暖燕麦纸做底、白卡当盘子、
// 酱色当墨、赤陶当标签、柿子橙留给价钱和深夜那几笔。
// 黄留给美团，红留给可乐，这一套走的是烤过的那一路，谁的品牌色都不是。
//
// ⚠️结构色一律走常量：上一版满模块散着二十几个绿灰色的字面值，
// 换一次色得挨个找，找漏一个就半绿半棕。以后改色只动这一处。
const TAKE_ACCENT = "#a8532c";   // 赤陶：小标签、星期、店名旁的强调
const TAKE_CORAL = "#d9622d";    // 柿子橙：价钱、深夜那一笔、要跳出来的那一下
const TAKE_BG = "#f5ece0";       // 暖燕麦纸：整页的底
const TAKE_INK = "#32211a";      // 酱色：正题
const TAKE_DIM = "#9a8574";      // 暖灰褐：次要说明
const TAKE_BODY = "#5b4436";     // 正文褐：成段的话
const TAKE_LINE = "#ece1d2";     // 分隔线
const TAKE_SOFT = "#f7f0e6";     // 卡里再嵌一块的底
const TAKE_MUTE = "#bcaa98";     // 最淡的那一档：没吃上的那天、虚线圈
function TakeoutView({ d, char, t, onBack, onRefresh, refreshing, onPeek, monthStats, drive }) {
  const [tab, setTab] = useState("home");
  const [open, setOpen] = useState(null);
  // ── 「看TA玩」驱动（第四批）。drive 不在时这一屏一个像素都没变 ──
  const driveTab = drive && drive.tab, driveItem = drive && drive.item;
  useEffect(() => { if (drive && driveTab) { setTab(driveTab); setOpen(null); } }, [driveTab]);
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setOpen(null); return; }
    // 这一屏的 open 存的是【第几单】，不是那一单本身——照它自己的写法来
    const list = Array.isArray(d && d.orders) ? d.orders : [];
    const row0 = watchOpenPick(list, driveItem, x => x && x.shop) || watchOpenPick(list, driveItem, x => x && x.main);
    const i = row0 ? list.indexOf(row0) : -1;
    if (i >= 0) setOpen(i);
  }, [driveItem]);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab]);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const acc = (data.account && typeof data.account === "object") ? data.account : {};
  // 钱包算出来的本月数（没建钱包档就是 null，那时退回模型给的数）
  const ms = (monthStats && typeof monthStats === "object" && isFinite(Number(monthStats.spend))) ? monthStats : null;
  const taste = (data.taste && typeof data.taste === "object") ? data.taste : {};
  const today = (data.today && typeof data.today === "object") ? data.today : {};
  const live = A(data.live), orders = A(data.orders), shops = A(data.shops), addrs = A(data.addrs);
  const wish = A(data.wish);
  // ── 一份 orders，三个看法（v59.36）────────────────────────────────────────
  // 她 2026-09-01：「吃过的记录和这七天对不上……要不改成这七天是上个星期的七天，
  // 然后点开可以看到吃过的记录那一大串，下一周刷新后之前的七天记录就顺延到吃过的
  // 记录里面，这样这两边能 reconcile 上」。
  // 对不上是必然的：week 和 orders 是【两次分别编出来的】同一个星期。
  // 两份独立生成的数据没有任何机制能让它们一致——这跟「一层写在两处」是同一个病。
  // 所以 week 这一层整个撤掉，这七天改成【从 orders 上开一扇七天的窗】：
  // 同一份数据换个看法，天生对得上；过了七天的自己滑出窗口，留在吃过的记录里，
  // 这就是她说的「顺延」——不需要任何搬运代码。
  const dayStart = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const DAY = 86400000, todayStart = dayStart(Date.now());
  const orderTs = o => (o && o._ts != null) ? o._ts : phoneWhenTs(o && (o.time || o.date), Date.now());
  const WK_ZH = ["日", "一", "二", "三", "四", "五", "六"];
  // 最近七天，今天在最下面（跟「吃过的记录」一样是新的在上？不——这一段读的是
  // 一周走下来的样子，顺着时间读才成立，所以从七天前开始往下走）
  const wkDays = [];
  for (let i = 6; i >= 0; i--) {
    const start = todayStart - i * DAY;
    const rows = orders
      .map((o, idx) => ({ o, idx, ts: orderTs(o) }))
      .filter(x => x.ts != null && x.ts >= start && x.ts < start + DAY)
      .sort((a, b) => a.ts - b.ts);
    wkDays.push({ start, zh: WK_ZH[new Date(start).getDay()], today: i === 0, rows });
  }
  const wkHas = wkDays.some(d => d.rows.length);
  // 封面这一排也跟着走烤过的那一路：陶土、焦糖、南瓜、橄榄、李子、可可
  const TAKE_COVERS = [["#c2703f", "#eccfb2"], ["#b5834a", "#efdcbe"], ["#c9803a", "#f0d7b4"], ["#8d9160", "#dfdfc2"], ["#a46070", "#e9ccd2"], ["#8a6a55", "#ded0c2"]];
  const cov = n => TAKE_COVERS[(Number(n) || 0) % TAKE_COVERS.length];
  const card = (kids, extra) => h("div", { style: Object.assign({ background: "#fff", borderRadius: 18, padding: "17px 17px", marginBottom: 13 }, extra || {}) }, kids);
  // 小节标题使用圆点与横线，和平台式黄竖条拉开视觉语言。
  const secTitle = (title, right) => h("div", { className: "flex items-center justify-between", style: { padding: "8px 2px 12px" } },
    h("div", { className: "flex items-center", style: { gap: 9, flex: 1, minWidth: 0 } },
      h("span", { "aria-hidden": "true", style: { width: 8, height: 8, borderRadius: 99, background: TAKE_CORAL, boxShadow: "0 0 0 5px rgba(216,111,98,.10)" } }),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: TAKE_INK } }, title)),
    right ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: TAKE_DIM } }, right) : null);
  const peekBtn = (tier, label, title, text) => onPeek ? h("button", { "data-wk": "pbtn", "data-part": "peek",
    onClick: e => { e.stopPropagation(); onPeek({ tier, label, title, text }); },
    className: "w-full active:opacity-60",
    style: { marginTop: 12, padding: "10px 0", borderRadius: 11, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))",
      border: "1px solid " + (tier === "hidden" ? "rgba(200,80,70,.4)" : "#e9e4da"), color: tier === "hidden" ? "#b6473c" : "#5b564e" }
  }, tier === "hidden" ? T("摆到 TA 面前 · 这是他藏起来的") : T("转发给 TA · 他会知道你翻了手机")) : null;
  const noteLine = txt => h("div", { className: "flex", style: { gap: 7, marginTop: 11 } },
    h("span", { style: { flexShrink: 0, fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: TAKE_CORAL } }, "备注 ·"),
    h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.7, color: "#8a7a5e" } }, txt));
  const initial = x => String(x || "?").trim().slice(0, 1);
  // ── 账户条 ──
  const accCard = card([
    h("div", { key: "a", className: "flex items-center", style: { gap: 13 } },
      h("div", { style: { width: 48, height: 48, borderRadius: 15, flexShrink: 0, background: "linear-gradient(150deg,#d08a4e," + TAKE_ACCENT + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" } }, h(PGlyph, { k: "takeout", size: 23, color: "#fff" })),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { className: "flex items-center flex-wrap", style: { gap: 7 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: TAKE_INK } }, acc.name || char.remark || char.name),
          // 会员等级不画：那是平台发的头衔，换个角色照样成立
          null),
        acc.uid ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: TAKE_DIM, marginTop: 5 } }, "账号 " + acc.uid) : null)),
    (ms || acc.monthOrders != null || acc.monthSpend != null) ? h("div", { key: "n", className: "flex", style: { marginTop: 15, paddingTop: 13, borderTop: "1px solid #f3f1ec" } },
      // 同上：以钱包流水为准，没建档才用模型那份
      [[ms ? ms.orders : (acc.monthOrders != null ? acc.monthOrders : "--"), "本月单数"],
       [ms ? fmtMoney(ms.spend, char.id) : (acc.monthSpend != null ? fmtMoney(acc.monthSpend, char.id) : "--"), "本月吃掉"]].map(([n, l], i) =>
        h("div", { key: i, className: "flex-1" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: TAKE_INK } }, n),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: TAKE_DIM, marginTop: 3 } }, l)))) : null,
    acc.persona ? h("div", { key: "p", style: { marginTop: 14, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.7, color: "#5b564e" } }, PTX(acc.persona)) : null
  ]);
  // ── 今日落点 ──
  const todayCard = (today.shop || today.main) ? h("div", { "data-wk": "block", key: "td", style: { background: "rgba(255,255,255,.92)", borderRadius: 18, overflow: "hidden", marginBottom: 15, boxShadow: "0 8px 24px rgba(53,78,73,.08)" } },
    h("div", { className: "flex items-start", style: { gap: 11, padding: "16px 17px 14px", borderBottom: "1px solid #f4efe2" } },
      h("div", { style: { width: 30, height: 30, borderRadius: 99, flexShrink: 0, background: TAKE_ACCENT, display: "flex", alignItems: "center", justifyContent: "center" } },
        h("span", { style: { width: 9, height: 9, borderRadius: 99, background: "#fff" } })),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { className: "flex items-center flex-wrap", style: { gap: 8 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: TAKE_INK } }, PTX(today.addrLabel || "家")),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: TAKE_ACCENT, background: "rgba(95,127,121,.11)", borderRadius: 6, padding: "3px 8px" } }, "送这里")),
        today.addrDetail ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: TAKE_DIM, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, PTX(today.addrDetail)) : null),
      today.date ? h("div", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: TAKE_DIM } }, today.date) : null),
    h("div", { style: { padding: "16px 17px 17px" } },
      h("div", { className: "flex items-start", style: { gap: 13 } },
        h("div", { style: { width: 66, height: 66, borderRadius: 14, flexShrink: 0, position: "relative", background: "linear-gradient(150deg,#dda86e,#b06a35)", display: "flex", alignItems: "center", justifyContent: "center" } },
          today.meal ? h("span", { style: { position: "absolute", left: -3, top: -8, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#fff", background: TAKE_CORAL, borderRadius: 6, padding: "2px 7px" } }, PTX(today.meal)) : null,
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(27px * var(--app-fs, 1))", color: "#fff" } }, initial(today.shop))),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16.5px * var(--app-fs, 1))", lineHeight: 1.4, color: TAKE_INK } }, PTX(today.shop || "")),
          // 评分和配送方式不画：那是平台给陌生人看的信用背书，跟这个人无关。
          // 只留「几点送到」——那是TA这一天的时间。
          today.eta ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: TAKE_DIM, marginTop: 6 } }, today.eta) : null)),

      today.main ? h("div", { className: "flex", style: { gap: 7, marginTop: 13 } },
        h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: TAKE_DIM } }, "主推 ·"),
        h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.55, color: TAKE_INK } }, PTX(today.main))) : null,
      // 大号红价格 + 绿色状态胶囊是收银台的语言。这一顿真正的内容是那句备注，
      // 所以钱和状态降成一行小字，备注留在下面当落点。
      (today.amount != null || today.status) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: TAKE_DIM, marginTop: 13 } },
        [today.amount != null ? fmtMoney(today.amount, char.id) : "", today.status || ""].filter(Boolean).join(" · ")) : null,
      today.note ? noteLine(today.note) : null,
      h("div", null, peekBtn("quiet", T("他今天点的"), today.shop, [today.main, today.note].filter(Boolean).join("｜"))))) : null;
  // ── 常点商家（横滑）──
  const shopSec = shops.length ? h("section", { key: "sp" }, secTitle("常点商家", "共 " + shops.length + " 家"),
    h("div", { className: "flex overflow-x-auto", style: { gap: 11, paddingBottom: 4, scrollbarWidth: "none", marginBottom: 13 } },
      shops.map((sp, i) => h("div", { "data-wk": "block", key: i, style: { width: 196, flexShrink: 0, background: "#fff", borderRadius: 15, overflow: "hidden" } },
        h("div", { style: { height: 76, position: "relative", background: "linear-gradient(150deg," + cov(sp.cover != null ? sp.cover : i)[0] + "," + cov(sp.cover != null ? sp.cover : i)[1] + ")", display: "flex", alignItems: "center", justifyContent: "center" } },
          h("div", { style: { width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,.82)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: "#5a5148" } }, initial(sp.name)),
          sp.times ? h("span", { style: { position: "absolute", right: 7, top: 7, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#fff", background: "rgba(0,0,0,.35)", borderRadius: 7, padding: "3px 8px" } }, sp.times) : null),
        h("div", { style: { padding: "11px 12px 13px" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: TAKE_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, PTX(sp.name || "")),
          sp.usual ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: TAKE_DIM, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "常点 · " + sp.usual) : null,
          sp.why ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#e8863a", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, PTX(sp.why)) : null,
          sp.last ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#b8b2a8", marginTop: 6 } }, PTX(sp.last)) : null))))) : null;
  // ── 进行中（四段进度）──
  const liveSec = live.length ? h("section", { key: "lv" }, secTitle("还在路上", characterText(char, "他这会儿等着的")),
    live.map((it, i) => {
      const st = Math.max(0, Math.min(3, Number(it.step) || 0));
      return h("div", { "data-wk": "block", key: i, style: { background: "#fff", borderRadius: 18, overflow: "hidden", marginBottom: 13 } },
        h("div", { className: "flex items-center justify-between", style: { padding: "13px 16px", background: "#fff8e6" } },
          h("div", { className: "flex items-center", style: { gap: 8 } },
            h("span", { style: { width: 9, height: 9, borderRadius: 99, background: "#f0523a" } }),
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: "#f0523a" } }, PTX(it.status || "配送中"))),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: TAKE_DIM } }, it.eta || "")),
        h("div", { style: { padding: "15px 16px 17px" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: TAKE_INK } }, PTX(it.shop || "")),
          it.items ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.7, color: "#6b665e", marginTop: 7 } }, it.items) : null,
          // 四段进度条和骑手名是平台的部件——TA等的是一顿饭，不是等一个进度条走完。
          // 只留一行「等到几点」。
          h("div", { className: "flex items-baseline justify-between", style: { marginTop: 13 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: TAKE_DIM } }, it.eta ? "等到 " + it.eta : ""),
            it.amount != null ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: TAKE_DIM } }, fmtMoney(it.amount, char.id)) : null),
          it.note ? noteLine(it.note) : null));
    })) : null;
  // ── 吃过的记录：默认是紧凑时间档案，点开才看收据细节 ──
  const orderSec = orders.length ? h("section", { key: "od" }, secTitle("吃过的记录", orders.length + " 次落点"),
    h("div", { "data-wk": "block", style: { background: "rgba(255,255,255,.9)", borderRadius: 18, padding: "4px 15px", marginBottom: 13 } }, orders.map((o, i) => {
      const expanded = open === i;
      // id 是给「这七天」跳过来用的：点上面那一顿，落到下面这一条并展开
      return h("div", { key: i, id: "tk-od-" + i, "data-wk": "pitem", "data-watch": "item:" + (o.shop || o.main || ""), style: { padding: "14px 0", borderTop: i ? "1px solid " + TAKE_LINE : "none", scrollMarginTop: 90 } },
        h("button", { onClick: () => setOpen(expanded ? null : i), className: "w-full text-left active:opacity-60", "aria-expanded": expanded },
          h("div", { className: "flex items-start", style: { gap: 12 } },
            h("div", { style: { width: 44, flexShrink: 0, textAlign: "center" } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: TAKE_ACCENT } }, (o.meal || "一顿").slice(0, 2)),
              h("div", { style: { width: 1, height: 18, background: TAKE_LINE, margin: "6px auto 0" } })),
            h("div", { className: "flex-1 min-w-0" },
              h("div", { className: "flex items-start justify-between", style: { gap: 10 } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.4, color: TAKE_INK } }, PTX(o.shop || "")),
                h("span", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: TAKE_CORAL, flexShrink: 0 } }, o.amount != null ? fmtMoney(o.amount, char.id) : "")),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: TAKE_DIM, marginTop: 4 } }, [o.time, o.status].filter(Boolean).join(" · ")),
              o.main ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.55, color: TAKE_BODY, marginTop: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" } }, PTX(o.main)) : null)),
          h("div", { style: { marginLeft: 56, marginTop: 7, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: TAKE_DIM } }, expanded ? "收起这一顿 ↑" : "展开这一顿 ↓")),
        expanded ? h("div", { style: { margin: "12px 0 0 56px", padding: "13px", borderRadius: 13, background: TAKE_SOFT } },
          A(o.items).map((x, j) => h("div", { key: j, className: "flex", style: { gap: 9, marginTop: j ? 9 : 0, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: TAKE_BODY } },
            h("span", { className: "flex-1 min-w-0" }, PTX(x.name || "")), h("span", { style: { color: TAKE_DIM } }, "×" + (x.qty || 1)), h("span", null, fmtMoney(x.price, char.id)))),
          // 星星不画：那是给平台看的刻度。TA亲口写的那句评价才是TA说的话。
          o.rating ? h("div", { style: { marginTop: 11, paddingTop: 10, borderTop: "1px solid " + TAKE_LINE, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.7, color: TAKE_BODY } }, o.rating) : null,
          o.addr ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: TAKE_DIM, marginTop: 9 } }, "到 · " + o.addr) : null,
          o.note ? noteLine(o.note) : null,
          o.reason ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.7, color: TAKE_BODY, marginTop: 9 } }, PTX(o.reason)) : null,
          peekBtn("quiet", T("他点的外卖"), (o.shop || "") + (o.main ? " · " + o.main : ""), [o.note ? "备注：" + o.note : "", o.reason, o.rating, o.addr].filter(Boolean).join("｜"))) : null);
    }))) : null;
  // ── 吃这件事上的三问（v59.18）──
  // 原来这儿是【辣度 / 忌口 / 偏好 / 预算 / 习惯】五行彩色药丸——那是外卖平台的
  // 「口味画像」表单，换个角色照样成立（她 2026-08-31：「这些 category 还是跟
  // 另外一个小手机的一模一样」）。改成三问，每一问都得答出这个人才成立：
  //   嫌什么 → TA嫌它哪一点（不是食材名，是TA的挑剔）
  //   备注写什么 → 每次都要的那句话，是TA对陌生人唯一开的口
  //   什么时候吃 → 几点、饿到什么程度才想起来，连着预算一起说
  // 字段沿用旧的那几个，老存档照样读得出来。
  const askRow = (q, node) => h("div", { style: { padding: "16px 0", borderTop: "1px solid " + TAKE_LINE } },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: TAKE_DIM, marginBottom: 9 } }, q),
    node);
  const lines = (list, tone) => h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
    A(list).map((x, i) => h("div", { key: i, className: "flex", style: { gap: 9 } },
      h("span", { style: { width: 5, height: 5, borderRadius: 99, marginTop: 9, flexShrink: 0, background: tone === "warn" ? TAKE_CORAL : TAKE_ACCENT } }),
      h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.7, color: TAKE_INK, wordBreak: "break-word" } }, x))));
  // 每次下单都写的那句：从订单/今天的备注里找出现得最多的那一条
  const stockNote = (function () {
    const tally = {};
    const add = t => { const k = String(t || "").trim(); if (k) tally[k] = (tally[k] || 0) + 1; };
    add(today.note); orders.forEach(o => add(o.note)); live.forEach(x => add(x.note));
    const keys = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);
    return keys.length ? { text: keys[0], n: tally[keys[0]] } : null;
  })();
  // ⚠️辣度（spicyTags）不显示：它本来就是平台那根「微辣/中辣/特辣」滑杆，
  // 而且那一栏里既有「偏好微辣」也有「忌死辣」，混进「怎么都不腻的那几样」是错的。
  const likeAll = A(taste.likeTags);
  const hasTaste = A(taste.avoidTags).length || likeAll.length || taste.budget || taste.habit || stockNote;
  const tasteSec = hasTaste ? h("section", { key: "ts" }, secTitle("吃这件事上", characterText(char, "他的挑剔")),
    h("div", { "data-wk": "block", style: { background: "rgba(255,255,255,.9)", borderRadius: 18, padding: "2px 16px 8px", marginBottom: 13 } },
      A(taste.avoidTags).length ? askRow(T("他嫌什么——不是嫌这样东西，是嫌它哪一点"), lines(taste.avoidTags, "warn")) : null,
      stockNote ? askRow(T("他每次都写的那句"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.75, color: TAKE_INK } },
        stockNote.text, stockNote.n > 1 ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: TAKE_DIM, marginLeft: 8 } }, "写过 " + stockNote.n + " 次") : null)) : null,
      likeAll.length ? askRow("怎么都不腻的那几样", lines(likeAll)) : null,
      (taste.habit || taste.budget) ? askRow("什么时候才想起吃", h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.8, color: TAKE_INK } },
        [taste.habit, taste.budget].filter(Boolean).join("　"))) : null),
    peekBtn("quiet", T("他的挑剔"), T("他吃东西的样子"), [A(taste.avoidTags).length ? "嫌：" + A(taste.avoidTags).join("、") : "", stockNote ? "每次都写：" + stockNote.text : "", taste.habit].filter(Boolean).join("｜"))) : null;
  // ── 这七天（v59.36 改成 orders 上的一扇窗）────────────────────────────────
  // 原来叫「一周进食轨迹」，形状是参考那份的七张横滑日卡【转了个方向】竖过来。
  // 转向不是改设计——真正的病在【一天一格】：一格一天，读出来永远是考勤表。
  // 现在是一串连着流下来的饭，日子只在换天时出现一次，**空掉的那天自己占一行说话**。
  // 点任何一顿都跳到「吃过的记录」里那一条并展开：同一顿饭，上面是它在一周里的位置，
  // 下面是它的收据。
  const weekSec = wkHas ? h("section", { key: "wk" },
    secTitle("这七天", (function () {
      const late = wkDays.reduce((n, d) => n + d.rows.filter(x => /夜|宵|凌晨/.test((x.o.meal || "") + " " + (x.o.time || ""))).length, 0);
      const miss = wkDays.filter(d => !d.rows.length).length;
      return [late ? late + " 顿在深夜" : "", miss ? miss + " 天没着落" : ""].filter(Boolean).join(" · ") || "一顿接一顿";
    })()),
    h("div", { "data-wk": "block", style: { background: "rgba(255,255,255,.9)", borderRadius: 18, padding: "14px 15px 15px", marginBottom: 13 } },
      wkDays.map((d, di) => {
        const empty = !d.rows.length;
        const rows = empty ? [null] : d.rows;
        return rows.map((x, ri) => {
          const late = x && /夜|宵|凌晨/.test((x.o.meal || "") + " " + (x.o.time || ""));
          const body = x ? [x.o.shop, x.o.main].filter(Boolean).join(" · ") : "这一天没吃上什么";
          return h(x ? "button" : "div", {
            key: di + "_" + ri,
            className: "flex w-full text-left" + (x ? " active:opacity-60" : ""),
            onClick: x ? () => { setTab("rhythm"); setOpen(x.idx); requestAnimationFrame(() => { const el = document.getElementById("tk-od-" + x.idx); if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "auto" }); }); } : undefined,
            style: { gap: 11, marginTop: (di || ri) ? 11 : 0 }
          },
            // 左边这一列是那根线：换天时露出日子，同一天里就只剩一节线接着往下
            h("div", { style: { width: 20, flexShrink: 0, textAlign: "center" } },
              ri === 0
                ? h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: d.today ? TAKE_CORAL : TAKE_ACCENT } }, d.zh)
                : h("span", { "aria-hidden": "true", style: { display: "block", width: 1, height: 18, margin: "2px auto 0", background: TAKE_LINE } })),
            h("span", { "aria-hidden": "true", style: { width: 6, height: 6, borderRadius: 99, marginTop: 7, flexShrink: 0, background: empty ? "transparent" : late ? TAKE_CORAL : TAKE_LINE, border: empty ? "1px dashed " + TAKE_MUTE : "none" } }),
            h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, color: empty ? TAKE_MUTE : TAKE_BODY, fontStyle: empty ? "italic" : "normal", wordBreak: "break-word" } },
              x && x.o.meal ? h("span", { style: { color: late ? TAKE_CORAL : TAKE_DIM, marginRight: 7 } }, x.o.meal) : null,
              body));
        });
      }))) : null;
  // ⚠️红包卡券【不画】（她 2026-08-31：「和另一个太像了」）。
  // 那是一张营销位：红底大金额、适用范围、有效期——纯平台部件，换个角色照样成立，
  // 一条关于这个人的东西都读不出来。生成层照旧留着（她定的），只是界面不再摆它。
  // ── 收货地址 ──
  const addrSec = addrs.length ? h("section", { key: "ad" }, secTitle("收货地址"),
    card(addrs.map((a, i) => h("div", { "data-wk": "block", key: i, style: { borderRadius: 12, padding: "13px 14px", marginTop: i ? 10 : 0, background: a.isDefault ? "#fffbef" : "#f7f6f3", border: "1px solid " + (a.isDefault ? "#f4e6bb" : "transparent") } },
      h("div", { className: "flex items-center", style: { gap: 8 } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: TAKE_INK } }, a.label || ""),
        a.isDefault ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#fff", background: TAKE_ACCENT, borderRadius: 5, padding: "3px 8px" } }, "默认") : null,
        a.tail ? h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: TAKE_DIM } }, PTX(a.tail)) : null),
      a.detail ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.75, color: "#8a847b", marginTop: 7 } }, PTX(a.detail)) : null,
      !a.isDefault ? h("div", null, peekBtn("hidden", "外卖常用地址", a.label, a.detail)) : null)))) : null;
  // ── 想吃清单 ──
  // ⚠️标题独占一行：跟指标名那次一样，中文在窄 flex 里会被压成一条竖字
  // 「想吃清单」是购物车的说法（清单＝待办）。TA不是在列清单，是在惦记。
  const wishSec = wish.length ? h("section", { key: "ws" }, secTitle("惦记着的", wish.length + " 样还没吃上"),
    card(wish.map((w, i) => h("div", { key: i, style: { padding: "14px 0", borderTop: i ? "1px solid #f3f1ec" : "none" } },
      h("div", { className: "flex items-start", style: { gap: 9 } },
        h("span", { style: { width: 7, height: 7, borderRadius: 99, marginTop: 8, flexShrink: 0, background: TAKE_CORAL } }),
        h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.6, color: TAKE_INK, wordBreak: "break-word" } }, PTX(w.title || ""))),
      w.when ? h("div", { "data-wk": "block", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.75, color: "#8a847b", background: "#f6f5f2", borderRadius: 9, padding: "9px 12px", marginTop: 9 } }, w.when) : null)),
    ), peekBtn("quiet", T("他想吃的"), wish.map(w => w.title).filter(Boolean).slice(0, 3).join("、"), wish.map(w => (w.title || "") + "（" + (w.when || "") + "）").join("｜"))) : null;
  // ── 送到别人那儿（v59.36，顶掉了「饭桌上的人」）──────────────────────────
  // 她 2026-09-01：「和谁吃还是不行去重不了，不然我们想想直接换一个板块吧」。
  // 认输认得对：together 那一栏的身份是【模型现编的一个称呼】，
  // 「老周」和「周叔」在代码里没有任何办法认成一个人，提示词也只能降概率。
  // **身份不稳的东西就不该拿来当一栏的主键。**
  // 换成从 orders 里长出来的这一格：TA给【哪个地方】点过饭。
  // 地址是复用的、会重复出现的，天生就是稳的主键；而且这一格跟这七天、吃过的记录
  // 读的是同一份 orders，三处永远对得上。
  // 内容也没变弱：一个人给谁点饭，比TA跟谁吃饭更说明问题。
  const homeAddr = (addrs.find(a => a.isDefault) || addrs[0] || {});
  const addrNorm = v => String(v == null ? "" : v).replace(/[\s。，、,.!！?？:：;；"'「」『』（）()\[\]【】~～·-]/g, "");
  const homeKeys = [homeAddr.label, homeAddr.detail].map(addrNorm).filter(Boolean);
  const isHome = a => { const k = addrNorm(a); return !k || homeKeys.some(hk => k === hk || k.indexOf(hk) >= 0 || hk.indexOf(k) >= 0); };
  const feedMap = {};
  orders.forEach((o, idx) => {
    if (!o || !o.addr || isHome(o.addr)) return;
    const k = addrNorm(o.addr);
    (feedMap[k] = feedMap[k] || { where: o.addr, rows: [] }).rows.push({ o, idx });
  });
  const feeds = Object.keys(feedMap).map(k => feedMap[k]).sort((a, b) => b.rows.length - a.rows.length).slice(0, 8);
  const feedSec = feeds.length ? h("section", { key: "fd" },
    secTitle("送到别人那儿", feeds.length + characterText(char, " 个不是他自己家的地方")),
    h("div", { "data-wk": "block", style: { background: "rgba(255,255,255,.9)", borderRadius: 18, padding: "3px 15px", marginBottom: 13 } },
      feeds.map((g, i) => h("div", { key: i, style: { padding: "15px 0", borderTop: i ? "1px solid " + TAKE_LINE : "none" } },
        h("div", { className: "flex items-start", style: { gap: 12 } },
          h("div", { style: { width: 42, height: 42, borderRadius: 99, flexShrink: 0, background: "linear-gradient(150deg," + cov(i)[0] + "," + cov(i)[1] + ")", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: TAKE_INK } }, initial(g.where)),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.45, color: TAKE_INK, wordBreak: "break-word" } }, PTX(g.where)),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: TAKE_DIM, marginTop: 4 } }, "送过 " + g.rows.length + " 次"),
            g.rows.slice(0, 3).map((x, j) => h("button", {
              key: j, className: "w-full text-left active:opacity-60",
              onClick: () => { setTab("rhythm"); setOpen(x.idx); requestAnimationFrame(() => { const el = document.getElementById("tk-od-" + x.idx); if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "auto" }); }); },
              style: { display: "block", marginTop: 9, padding: "10px 12px", borderRadius: "4px 12px 12px 12px", background: TAKE_SOFT }
            },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.55, color: TAKE_ACCENT } }, [x.o.time, x.o.shop, x.o.main].filter(Boolean).join(" · ")),
              x.o.reason ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.75, color: TAKE_BODY, marginTop: 5 } }, x.o.reason) : null)))),
        h("div", { style: { marginLeft: 54 } }, peekBtn("quiet", T("他送到别人那儿的那几单"), g.where, g.rows.slice(0, 3).map(x => [x.o.shop, x.o.main, x.o.reason].filter(Boolean).join("·")).join("｜"))))))) : null;
  // ── 合起来看（v59.35）──
  // 原来叫「吃饭侧写」，顶上摆三块彩色数字（记下的餐 / 深夜落点 / 同桌的人）。
  // 那三块正是外卖平台的月度账单部件，换个角色照样成立——她 2026-09-01：
  //「吃饭侧写也和那个太像了」。而且它跟情侣空间那次是同一条判据：
  // **把「几件」换成「哪一件」**，数量只留给数量本身就是内容的地方
  //（「几顿在深夜」有意思，所以那一个挪去了「这七天」的副标；
  //  「记下的餐 12」什么也没说，删掉）。
  // 剩下的两样本来就是全部内容：一段关于TA这一周怎么吃的话，和TA自己最后那句念叨。
  // 所以这一格干脆做成一页纸：正文一段，TA的话另起一行、用TA自己的口气收尾。
  const monthSec = (data.monthNote || data.tail) ? h("section", { key: "mn" }, secTitle("合起来看", characterText(char, "这一周他是这么吃的")),
    h("div", { "data-wk": "block", style: { background: "rgba(255,255,255,.9)", borderRadius: 18, padding: "17px 17px 18px", marginBottom: 13 } },
      data.monthNote ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.95, color: TAKE_BODY } }, PTX(data.monthNote)) : null,
      data.tail ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.8, color: TAKE_INK, marginTop: data.monthNote ? 15 : 0, paddingLeft: 12, borderLeft: "2px solid " + TAKE_CORAL } }, PTX(data.tail)) : null)) : null;
  // 外卖不再按平台后台的「点餐 / 订单 / 口味 / 我的」分仓，而按角色生活阅读：
  // 这一顿发生了什么、长期怎么喂饱自己、饭和哪些人发生过关系。
  // 字段仍兼容旧存档，改变的是组合与叙事顺序，不拿改名冒充原创。
  const PAGES = [
    { key: "home", zh: "这一顿", glyph: "takeout", lead: "先看 TA 今天把饭送到哪里、正在等哪一单。", secs: [accCard, todayCard, liveSec], badge: live.length },
    // ⚠️v59.16 曾经在这儿开过一档「写给陌生人」，把订单里的备注挖出来单独摆一面。
    // 她当天就报「本质上不就是把怎么吃里面的备注挖出来嘛，有点鸡肋」——对的：
    // 那不是一栏新东西，是同一份数据换个地方摆第二遍。撤掉，不留着。
    // 备注该待的地方是它本来那一顿旁边；「TA每次都写的那句」抽进了下面那一问。
    { key: "rhythm", zh: "怎么吃", glyph: "health", lead: characterText(char, "七天的节奏、一次次落点、还有他吃这件事上的挑剔。"), secs: [tasteSec, weekSec, orderSec, monthSec], badge: orders.length },
    { key: "people", zh: "和谁吃", glyph: "me", lead: characterText(char, "他把饭送到谁那儿、为什么总回某家店、还惦记着什么没吃上。"), secs: [feedSec, shopSec, wishSec, addrSec] }
  ];
  const page = PAGES.find(x => x.key === tab) || PAGES[0];
  const body = page.secs.filter(Boolean);
  const chrome = h(Head, { zh: page.zh,
    bg: "transparent",
    noLine: true,
    ink: TAKE_INK,
    onBack: onBack,
    right: h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-60 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40, marginRight: -8 } }, h(IRefresh, { size: 18, color: TAKE_INK })) });
  const nav = h("div", {
    className: "shrink-0 grid",
    style: { gridTemplateColumns: "repeat(" + PAGES.length + ",minmax(0,1fr))", padding: "5px 12px", paddingBottom: COMPOSER_PAD_BOTTOM, background: "rgba(255,255,255,.97)", borderTop: "1px solid #eae6df" }
  }, PAGES.map(pg => h("button", {
    key: pg.key, onClick: () => { setTab(pg.key); setOpen(null); }, "data-wk": "ptab", "data-on": tab === pg.key ? "1" : "0", "data-watch": "tab:" + pg.key,
    className: "flex flex-col items-center justify-center active:opacity-60",
    style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: tab === pg.key ? TAKE_ACCENT : TAKE_DIM, paddingTop: 2, paddingBottom: 2 }
  }, h("div", { style: { position: "relative", width: 30, height: 20, display: "flex", alignItems: "center", justifyContent: "center" } },
    h(PGlyph, { k: pg.glyph, size: 16, color: tab === pg.key ? TAKE_ACCENT : TAKE_DIM }),
    pg.badge ? h("span", { style: { position: "absolute", top: -3, right: -1, minWidth: 15, height: 15, borderRadius: 99, background: TAKE_CORAL, color: "#fff", fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" } }, pg.badge > 99 ? "99+" : pg.badge) : null),
  h("span", { style: { marginTop: 2 } }, pg.zh))));
  return h("div", { className: "h-full min-h-0 flex flex-col relative", "data-wk": "papp", "data-app": "takeout", style: { background: "radial-gradient(circle at 88% 4%,rgba(216,166,116,.38),transparent 31%),linear-gradient(180deg,#efe0cc 0%," + TAKE_BG + " 34%," + TAKE_BG + " 100%)" } },
    chrome,
    (drive && (drive.typing != null || drive.searchQ) && typeof window !== "undefined" && window.PhoneWatch)
      ? h("div", { className: "shrink-0 flex items-center", style: { margin: "0 16px 8px" } },
          h(window.PhoneWatch.WatchSearchPill, { typing: drive.typing, q: drive.searchQ,
            skin: { ink: TAKE_INK, dim: TAKE_DIM, soft: "#fff", accent: TAKE_CORAL, radius: 15 } }))
      : null,
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 16px 24px" } },
      h("div", { "data-wk": "block", style: { margin: "2px 2px 15px", padding: "12px 14px", border: "1px solid rgba(95,127,121,.15)", background: "rgba(255,255,255,.58)", borderRadius: 13, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.7, color: TAKE_DIM } }, PTX(page.lead)),
      body.length ? body : h("div", { style: { padding: "46px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: TAKE_DIM } }, "这条生活线还没有留下东西，点右上角刷一次")),
    nav,
    // TA刚点进去的那一家店／那一道菜
    watchPageNode(drive, { bg: TAKE_BG, ink: TAKE_INK, dim: TAKE_DIM, line: TAKE_LINE, body: TAKE_BODY, mark: TAKE_CORAL }));
}
// ============================================================
// 健康 —— 十几张指标卡 + 今日轨迹 + 健康洞察（她 2026-08-29 给了参考稿）
// 这个 app 的灵魂是两条她亲口点出来的：
//   ① 指标名会按角色的世界改名——「玉简传信」其实就是微信/屏幕时间，
//      模型自己觉得「王爷不用微信」就换了个词。这不是 bug，是最好的部分。
//   ② 同一张卡下面那三个细分项，每个角色都不一样：同样是步数，
//      王爷是「搜查厢房 / 官署穿行 / 日常散步」，学生是「实验室往返 / 通勤 / 散步」。
// 所以这里的模板是死的（分数 / 大数 / 标签 / 叙述 / 三项 / 周条 / 一句话），
// 里面每一个字都是生成的，代码不预设任何指标名。
// ============================================================
// ── 配色（v59.44，她 2026-09-01 选了「病历夹」那个变体）───────────────────
// 原来是六色彩虹条——那是 Apple Health / 运动健康那一族的样子，一屏六种颜色
// 各管一项，读出来就是仪表盘。**病历不是仪表盘：一份病历只有一种墨。**
// 外卖占了烤过的暖色、购物占了靛蓝与朱砂，这一路走第三家：**草药**。
// 淡草纸做底、墨绿当墨、苔绿做标签，赭石只留给【要紧的那一条】——
// 异常读数和医嘱。一份文书上只有一处是红的，那一处才有分量。
const HEALTH_ACCENT = "#5c7355";   // 苔绿：小标签、栏目名
const HEALTH_ALERT = "#a5623a";    // 赭石：异常读数、医嘱——一屏只该有一两处
const HEALTH_BG = "#eef1e9";       // 淡草纸
const HEALTH_INK = "#25302a";      // 墨绿黑
const HEALTH_DIM = "#8d9689";      // 灰绿
const HEALTH_BODY = "#4a5548";     // 正文
const HEALTH_LINE = "#e2e7dd";     // 分隔线
const HEALTH_GROUPS = [
  { key: "body", zh: "体征", glyph: "health" },
  { key: "mind", zh: "心神", glyph: "liked" },
  // 私密单开一档（她 2026-08-30 拍板）。以前它是【心神】那一档里的一句从句，
  // 于是十有八九根本写不出来——一句从句抢不过情绪、静心、社交那三样。
  { key: "private", zh: "私密", glyph: "latenight" },
  { key: "intake", zh: "摄入", glyph: "takeout" }
];
const HEALTH_SLOT_MAP = HEALTH_SLOTS.reduce((o, x, i) => (o[x.slot] = { ...x, order: i }, o), {});
const healthSlotOf = c => {
  const k = String((c && c.slot) || "").trim().toLowerCase();
  return HEALTH_SLOT_MAP[k] || null;
};
// 模型不一定按 key 回：会写中文（「心神」「摄入」）、写英文近义词（mood/private/diet），
// 也会照着提示词里那句「私密的身体反应」直接回 group:"私密"。
// 旧写法是拿 group 直接跟这三个 key 比 —— 别的一律【一张都不显示】：
// 卡还在数据里、也实实在在花了一次调用，就是每个 tab 都翻不到
//（她 2026-08-30：「我怎么记得我们有一个私密生理状态没了，明明之前刷新还看到了的」）。
const HEALTH_GROUP_ALIAS = (() => {
  const m = {};
  const put = (key, words) => words.forEach(w => { m[w] = key; });
  put("body", ["body", "physical", "vitals", "vital", "fitness", "sleep", "体征", "身体", "生理", "体能", "睡眠"]);
  put("mind", ["mind", "mental", "mood", "emotion", "emotional", "psych", "social",
    "心神", "心理", "情绪", "精神", "社交"]);
  put("private", ["private", "privacy", "intimate", "intimacy", "sexual", "sex", "desire", "libido", "arousal", "bodyprivate",
    "私密", "亲密", "隐私", "欲望", "性", "情欲", "身体私密"]);
  put("intake", ["intake", "diet", "food", "nutrition", "drink", "consumption", "output",
    "摄入", "饮食", "进食", "营养", "消耗", "补给"]);
  return m;
})();
// 认得出来就归位；认不出来的一律回落到第一个 tab——宁可摆错一档，也不许整张卡消失
const healthGroupOf = c => {
  // 格位是定死的：认得出 slot 就按格位归档，模型的 group 字段说什么都不算
  const sl = healthSlotOf(c);
  if (sl) return sl.group;
  const raw = String((c && c.group) || "").trim().toLowerCase();
  if (!raw) return "body";
  if (HEALTH_GROUPS.some(g => g.key === raw)) return raw;
  if (HEALTH_GROUP_ALIAS[raw]) return HEALTH_GROUP_ALIAS[raw];
  const hit = Object.keys(HEALTH_GROUP_ALIAS).find(w => raw.indexOf(w) >= 0);
  return hit ? HEALTH_GROUP_ALIAS[hit] : "body";
};
function HealthView({ d, char, t, onBack, onRefresh, refreshing, onPeek, vitals, drive }) {
  const [tab, setTab] = useState("body");
  // ── 「看TA玩」驱动（第五批）：健康只能看，TA盯着某一项读数而已 ──
  const driveTab = drive && drive.tab;
  useEffect(() => { if (drive && driveTab) setTab(driveTab); }, [driveTab]);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab]);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const cards = A(data.cards).filter(x => x && typeof x === "object");
  const peekBtn = (label, title, text) => onPeek ? h("button", { "data-wk": "pbtn", "data-part": "peek",
    onClick: e => { e.stopPropagation(); onPeek({ tier: "quiet", label, title, text }); },
    className: "w-full active:opacity-60",
    style: { marginTop: 12, padding: "10px 0", borderRadius: 11, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", border: "1px solid " + HEALTH_LINE, color: HEALTH_BODY }
  }, T("转发给 TA · 他会知道你翻了手机")) : null;
  // 附注小表：一项读数底下那几个分解数。原来是「小标签 + 17px 大数」两栏——
  // 那还是仪表盘那一套（大数是仪表盘的主角）。化验单里这种东西是【附注】，
  // 一行一条、名字和数值靠一条细线分开，字号一律小于正文。
  const statGrid = stats => {
    const rows = A(stats).filter(x => x && (x.k || x.v)).slice(0, 3);
    if (!rows.length) return null;
    return h("div", { style: { marginTop: 9, marginLeft: 9, paddingLeft: 11, borderLeft: "1px solid " + HEALTH_LINE } },
      rows.map((x, i) => h("div", { key: i, className: "flex items-baseline", style: { paddingTop: i ? 4 : 0 } },
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.5, color: HEALTH_DIM } }, x.k || ""),
        h("span", { "aria-hidden": "true", style: { flex: 1, minWidth: 10, margin: "0 6px", borderBottom: "1px dotted " + HEALTH_LINE, transform: "translateY(-3px)" } }),
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.5, color: HEALTH_BODY, flexShrink: 0, whiteSpace: "nowrap" } }, x.v || ""))));
  };
  // 角色给这一项改了名之后，底下用小字标一句它到底是哪一项——
  // 不然「今日行脚」是步数还是活动消耗，只有模型自己知道（她要的「统一」就是为了这个）
  const stdSub = c => (c._zh && String(c.name || "").trim() !== c._zh)
    ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: HEALTH_DIM, marginTop: 3 } }, c._zh) : null;
  // ── 读数：化验单的一行，不是仪表盘的一张卡（v62.53）────────────────
  // 注释里从 v59.44 起就写着「病历不是仪表盘：一份病历只有一种墨」，
  // 纸上却一直是白圆角卡 + 顶上一条 4px 彩带 + 33px 大数字 + 圆角 chip ——
  // 那正是仪表盘卡本人，换成任何一个健康 app 都成立（审美审计 2026-09-04 点名）。
  //
  // 真的病历里，读数长在【化验单】上：左边项目名，右边数值，中间一串引导点把两头连起来；
  // 异常的那几行在左边那道栏外画一笔，不是整张卡换个颜色。
  // 所以这里不再一项一张卡，而是【一档一张化验单】：一张纸，纸上一行一项。
  // 一种墨＝HEALTH_INK；只有异常那一档才许动用赭石，一屏顶多一两处。
  //
  // HEALTH_HUES 那三档色相整个删掉了——它当初存在的理由就是「让卡片不至于
  // 完全一样」，而一份文书本来就该处处一样。留着它等于把病改回去的路口开着。
  const DOTS = { flex: 1, minWidth: 14, margin: "0 7px", borderBottom: "1px dotted " + HEALTH_LINE, transform: "translateY(-4px)" };
  // 一行读数：项目名 · 引导点 · 数值。tag 挂在名字下面当小字，不做成药丸。
  const labRow = (c, i, last) => {
    const alert = /异常|偏[高低]|不足|过[高低多少]|警|差|超/.test(String(c.tag || ""));
    const ink = alert ? HEALTH_ALERT : HEALTH_INK;
    return h("div", { key: i, "data-wk": "pitem", "data-watch": "item:" + (c.name || ""), style: { padding: "12px 0 13px", borderBottom: last ? "none" : "1px solid " + HEALTH_LINE } },
      h("div", { className: "flex items-baseline" },
        // 左边那道栏外的记号：异常才有，一笔就够
        h("span", { "aria-hidden": "true", style: { width: 9, flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: HEALTH_ALERT, lineHeight: 1 } }, alert ? "·" : ""),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.4, color: HEALTH_INK, wordBreak: "break-word" } }, PTX(c.name || "")),
        h("span", { "aria-hidden": "true", style: DOTS }),
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16.5px * var(--app-fs, 1))", lineHeight: 1.3, color: ink, flexShrink: 0, whiteSpace: "nowrap" } },
          c.value != null ? String(c.value) : "—",
          c.unit ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: HEALTH_DIM, marginLeft: 2 } }, c.unit) : null)),
      // 改了名的那一项：标准名跟着走小字，跟数值那一列对不齐也没关系，它是注解
      (stdSub(c) || c.tag) ? h("div", { className: "flex items-baseline", style: { gap: 8, marginTop: 4, paddingLeft: 9 } },
        c._zh && String(c.name || "").trim() !== c._zh
          ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: HEALTH_DIM } }, c._zh) : null,
        c.tag ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: alert ? HEALTH_ALERT : HEALTH_DIM } }, PTX(c.tag)) : null) : null,
      c.note ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.8, color: HEALTH_BODY, marginTop: 7, paddingLeft: 9 } }, PTX(c.note)) : null,
      statGrid(c.stats),
      c.quote ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.8, color: HEALTH_DIM, marginTop: 9, paddingLeft: 9, fontStyle: "italic" } }, "「" + c.quote + "」") : null);
  };
  // 一整档＝一张化验单：白纸、上下两道横杠夹着一行表头、里面一行一项。
  // 表头那两道杠是化验单最认得出来的那个记号（上粗下细），比什么图标都管用。
  const labSheet = (title, list) => {
    if (!list.length) return null;
    return h("div", { "data-wk": "block", key: "lab", style: { background: "#fdfdfa", borderRadius: 3, padding: "0 16px 6px", marginBottom: 16, boxShadow: "0 1px 0 rgba(37,48,42,.05), 0 6px 14px -12px rgba(37,48,42,.5)" } },
      // 抬头照检验单的样子：姓名一头、日期一头，底下压一道粗线；
      // 粗线下面再来一行【项目 / 结果】的列名，然后才是正文。
      // ⚠️不要在这儿把 tab 名再写一遍——顶栏已经写着「体征」了，写两遍是通用卡片的习惯。
      h("div", { style: { borderBottom: "2px solid " + HEALTH_INK, paddingTop: 15 } },
        h("div", { className: "flex items-baseline justify-between", style: { paddingBottom: 7, gap: 10 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: HEALTH_INK, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (char && char.name) || "本人"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: HEALTH_DIM, flexShrink: 0 } }, "今天 · " + list.length + " 项"))),
      h("div", { className: "flex items-baseline justify-between", style: { borderTop: "1px solid " + HEALTH_INK, borderBottom: "1px solid " + HEALTH_LINE, marginTop: 2, padding: "6px 0 5px" } },
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".1em", color: HEALTH_DIM, paddingLeft: 9 } }, "项目"),
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".1em", color: HEALTH_DIM } }, "结果")),
      h("div", null, list.map((c, i) => labRow(c, i, i === list.length - 1))),
      onPeek ? peekBtn("健康 · " + title, title, list.map(c => (c.name || "") + " " + (c.value != null ? c.value : "") + (c.unit || "")).join("｜")) : null);
  };

  // ── 病历夹（v59.44）──────────────────────────────────────────────────
  // 她 2026-09-01：「把 perspective 改成医生对病人的诊断」，并选了这个变体：
  // **大夫的话是低频、有日期、会累积的一叠；每天变的只是几条读数。**
  // 原来这儿是一个 74/100 的综合分环——那是全场最像健康 App 的一样东西，
  // 而且是个凭空捏出来的加权数。换成最近那一次的诊断。
  //
  // ⚠️这一格真正值钱的是 chief 和 exam 之间那道缝：TA嘴里说的（「没事，就是没睡好」）
  // 和身上显示的（连着五天不到四小时）多半不是一回事。所以两栏【并排摆、不合并】，
  // 跟情侣空间「TA记得的那一版」是同一个形状——落差就是内容。
  const visits = A(data.visits).filter(x => x && typeof x === "object")
    .slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const [visitOpen, setVisitOpen] = useState(false);
  const dateZh = v => { const m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(v || "")); return m ? (+m[2]) + "月" + (+m[3]) + "日" : String(v || ""); };
  const chartRow = (label, txt, alert) => txt ? h("div", { style: { marginTop: 13 } },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: ".04em", color: alert ? HEALTH_ALERT : HEALTH_DIM, marginBottom: 5 } }, label),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.85, color: alert ? HEALTH_INK : HEALTH_BODY, wordBreak: "break-word" } }, txt)) : null;
  // 一次就诊＝一张处方笺：方角、纸色、抬头下面压一道实线。圆角 16 的白卡是通用卡片，
  // 不是病历里的任何一样东西（审美审计 2026-09-04）。
  const visitCard = (v, i2, folded) => h("div", { "data-wk": "block", key: i2, style: { background: "#fdfdfa", borderRadius: 3, padding: folded ? "13px 16px" : "16px 18px 20px", marginBottom: 10, boxShadow: "0 1px 0 rgba(37,48,42,.05), 0 6px 14px -12px rgba(37,48,42,.5)" } },
    h("div", { className: "flex items-baseline justify-between", style: { gap: 10, paddingBottom: 7, borderBottom: folded ? "none" : "1px solid " + HEALTH_INK } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: folded ? 15 : 18, color: HEALTH_INK, minWidth: 0 } }, PTX(v.who || "大夫")),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: HEALTH_DIM, flexShrink: 0 } }, dateZh(v.date))),
    folded
      ? (v.impression ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.7, color: HEALTH_DIM, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, PTX(v.impression)) : null)
      : h("div", null,
          // TA说的 ↔ 身上显示的：并排两栏，中间一条竖线，落差自己跳出来
          h("div", { className: "flex", style: { gap: 12, marginTop: 14 } },
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: HEALTH_DIM, marginBottom: 5 } }, characterText(char, "他说的")),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.75, color: HEALTH_BODY, wordBreak: "break-word" } }, PTX(v.chief || "—"))),
            h("div", { "aria-hidden": "true", style: { width: 1, background: HEALTH_LINE, flexShrink: 0 } }),
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: HEALTH_ACCENT, marginBottom: 5 } }, "身上显示的"),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.75, color: HEALTH_INK, wordBreak: "break-word" } }, PTX(v.exam || "—")))),
          chartRow("印象", v.impression),
          chartRow("医嘱", v.orders, true),
          v.followup ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.75, color: HEALTH_ALERT, marginTop: 13, paddingTop: 12, borderTop: "1px dashed " + HEALTH_LINE } }, PTX(v.followup)) : null,
          onPeek ? peekBtn(characterText(char, "他的病历"), v.who || "大夫", [v.chief, v.exam, v.impression, v.orders, v.followup].filter(Boolean).join("｜")) : null));
  const headCard = h("div", { key: "hd", style: { marginBottom: 20 } },
    h("div", { className: "flex items-baseline justify-between", style: { padding: "2px 4px 12px", gap: 10 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(26px * var(--app-fs, 1))", color: HEALTH_INK } }, "病历"),
      visits.length > 1 ? h("button", { onClick: () => setVisitOpen(o => !o), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: HEALTH_ACCENT, flexShrink: 0 } }, visitOpen ? "只看最近一次" : "看过 " + visits.length + " 次") : null),
    visits.length
      ? h("div", null, (visitOpen ? visits : visits.slice(0, 1)).map((v, i2) => visitCard(v, i2, visitOpen && i2 > 0)))
      : h("div", { "data-wk": "block", style: { background: "#fdfdfa", borderRadius: 3, padding: "18px", border: "1px dashed " + HEALTH_LINE, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.8, color: HEALTH_DIM } }, characterText(char, "他还没看过大夫。下面这些是身上的读数。")),
    data.since ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.8, color: HEALTH_DIM, padding: "4px 6px 0" } }, "自那之后 · " + data.since) : null);
  // ── 这一段时间的综合分（每日轻量快照，不是把整份报告天天累计）──
  // 报告本身代表【今天】，每次照实重写；趋势另存一条一天一个数的线。
  const vt = A(vitals).filter(x => x && x.score != null && isFinite(Number(x.score))).slice(0, 30).reverse();
  // ⚠️这条线的存量还是按老的「综合分」存的（x_phoneVitals）。v59.44 起报告里不再有
  // 综合分，新的天数就不会再进这条线了——所以它会自己停在最后一个有分的那天。
  // 不删它：过去那三个月是真实记录过的，删掉等于抹掉病史。它会随 90 天窗口自然走完。
  // 体温单：病历里那张画着格子、上面一条折线的纸。原来这儿是一排灰色柱子——
  // 柱状图是仪表盘的部件，而这个 app 里现成就有一样【病历自己的图】可以长成。
  // 格子是画上去的（横线四道、竖线按天），线和点是 SVG，不用任何库。
  const trendSec = vt.length >= 2 ? (() => {
    // ⚠️等比缩放，别用 preserveAspectRatio:"none"：拉伸会把点画成横躺的椭圆，
    // 最后那个「今天」还会被右边缘切掉一半（第一版就是这样）。所以留出 PAD 的边距，
    // 让 viewBox 自己按比例铺满宽度。
    const W = 300, H = 84, PAD = 5, n = vt.length;
    const xs = k => n === 1 ? W / 2 : PAD + (k / (n - 1)) * (W - PAD * 2);
    const ys = v => (H - PAD) - (Math.max(0, Math.min(100, v)) / 100) * (H - PAD * 2);
    const pts = vt.map((x, k) => [xs(k), ys(Number(x.score))]);
    return h("section", { key: "vt", style: { marginTop: 16 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(24px * var(--app-fs, 1))", color: HEALTH_INK, padding: "6px 4px 4px" } }, "体温单"),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: HEALTH_DIM, padding: "0 4px 12px" } }, "过去 " + n + " 天这条线的样子"),
      h("div", { "data-wk": "block", style: { background: "#fdfdfa", borderRadius: 3, padding: "14px 16px 10px", boxShadow: "0 1px 0 rgba(37,48,42,.05), 0 6px 14px -12px rgba(37,48,42,.5)" } },
        h("svg", { viewBox: "0 0 " + W + " " + H, style: { display: "block", width: "100%", height: "auto" }, "aria-hidden": "true" },
          // 横四道：体温单的格纸
          [0, 1, 2, 3, 4].map(k => h("line", { key: "h" + k, x1: 0, x2: W, y1: PAD + ((H - PAD * 2) / 4) * k, y2: PAD + ((H - PAD * 2) / 4) * k, stroke: HEALTH_LINE, strokeWidth: 0.4, vectorEffect: "non-scaling-stroke" })),
          // 竖线按天，天数多时隔几天画一道，免得糊成一片
          vt.map((x, k) => (n <= 14 || k % Math.ceil(n / 14) === 0)
            ? h("line", { key: "v" + k, x1: xs(k), x2: xs(k), y1: PAD, y2: H - PAD, stroke: HEALTH_LINE, strokeWidth: 0.4, vectorEffect: "non-scaling-stroke" }) : null),
          h("polyline", { points: pts.map(p => p.join(",")).join(" "), fill: "none", stroke: HEALTH_INK, strokeWidth: 1.2, strokeLinejoin: "round", strokeLinecap: "round" }),
          pts.map((p, k) => h("circle", { key: "c" + k, cx: p[0], cy: p[1], r: k === n - 1 ? 3 : 1.8, fill: k === n - 1 ? HEALTH_ALERT : HEALTH_INK }))),
        h("div", { className: "flex items-center justify-between", style: { marginTop: 7 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: HEALTH_DIM } }, String(vt[0].day || "").slice(5)),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: HEALTH_DIM } }, "今天"))));
  })() : null;
  // ── 今日轨迹 ──
  const timeline = A(data.timeline);
  // 病程记录：左边一列时刻、右边一段话，中间一条竖线把它们串成一天。
  // 原来是「白圆角卡 + 左边 4px 彩条」，那是通知列表的形状，而且三档色相
  // 又把「一份病历只有一种墨」这句话违了一遍。
  const timelineSec = timeline.length ? h("section", { key: "tl" },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(24px * var(--app-fs, 1))", color: HEALTH_INK, padding: "6px 4px 4px" } }, "病程记录"),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: HEALTH_DIM, padding: "0 4px 14px" } }, "今天这一天是怎么过的"),
    h("div", { "data-wk": "block", style: { background: "#fdfdfa", borderRadius: 3, padding: "4px 16px 14px", boxShadow: "0 1px 0 rgba(37,48,42,.05), 0 6px 14px -12px rgba(37,48,42,.5)" } },
      timeline.map((it, i) => h("div", { key: i, className: "flex", style: { gap: 13, paddingTop: 14 } },
        h("div", { style: { width: 44, flexShrink: 0, textAlign: "right" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, color: HEALTH_INK } }, it.time || "")),
        // 那条竖线就是病程记录纸上那道分栏线：贯穿整段，不是每条各画一截
        h("div", { "aria-hidden": "true", style: { width: 1, flexShrink: 0, background: HEALTH_LINE, alignSelf: "stretch" } }),
        h("div", { style: { flex: 1, minWidth: 0, paddingBottom: 2 } },
          it.tag ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: HEALTH_ACCENT, marginBottom: 3 } }, PTX(it.tag)) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.8, color: HEALTH_BODY } }, PTX(it.text || ""))))))) : null;
  // ⚠️「健康洞察」整段撤了（v59.44）：那是健康 App 的固定小组件——三条短判断加解释，
  // 换个人照样成立。大夫要说的话已经在病历的【印象】和【医嘱】里，说两遍就是两处
  // 各说各的。TA自己那句念叨留着，接在今日轨迹后面。
  const tailSec = data.tail ? h("section", { key: "tl2" },
    h("div", { "aria-hidden": "true", style: { width: 26, height: 2, borderRadius: 2, background: HEALTH_LINE, margin: "20px auto 14px" } }),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.85, color: HEALTH_DIM, textAlign: "center", padding: "0 10px" } }, PTX(data.tail))) : null;
  // 同一档里按格位顺序排：这样谁的手机翻开都是同一个阅读顺序（她要的「统一」）。
  // 认不出格位的（老存档、模型自己多写的）排在后面，不打乱定死的那几项。
  const byGroup = g => cards.filter(c => healthGroupOf(c) === g)
    .map((c, i) => { const sl = healthSlotOf(c); return { c: c, o: sl ? sl.order : 900 + i, sl: sl }; })
    .sort((a, b) => a.o - b.o)
    // 整宽也由格位定死，不然每个角色的排版还是各长各的
    .map(x => x.sl ? { ...x.c, wide: !!x.sl.wide, _zh: x.sl.zh } : x.c);
  const PAGES = HEALTH_GROUPS.map(g => ({
    key: g.key, zh: g.zh, glyph: g.glyph,
    secs: (g.key === "body" ? [headCard] : []).concat([labSheet(g.zh, byGroup(g.key))])
  })).concat([{ key: "track", zh: "轨迹", glyph: "calendar", secs: [trendSec, timelineSec, tailSec].filter(Boolean) }]);
  const page = PAGES.find(x => x.key === tab) || PAGES[0];
  const body = page.secs.filter(Boolean);
  const chrome = h(Head, { zh: page.zh, bg: "transparent", noLine: true, ink: HEALTH_INK, onBack,
    right:
    h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-60 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: HEALTH_BODY })) });
  const nav = h("div", {
    className: "shrink-0 grid",
    style: { gridTemplateColumns: "repeat(" + PAGES.length + ",minmax(0,1fr))", padding: "5px 8px", paddingBottom: COMPOSER_PAD_BOTTOM, background: "rgba(255,255,255,.96)", borderTop: "1px solid #e5e8ec" }
  }, PAGES.map(pg => h("button", {
    key: pg.key, onClick: () => setTab(pg.key), "data-wk": "ptab", "data-on": tab === pg.key ? "1" : "0", "data-watch": "tab:" + pg.key,
    className: "flex flex-col items-center justify-center active:opacity-60",
    style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: tab === pg.key ? HEALTH_ACCENT : HEALTH_DIM, paddingTop: 2, paddingBottom: 2 }
  }, h("div", { style: { width: 30, height: 20, display: "flex", alignItems: "center", justifyContent: "center" } },
    h(PGlyph, { k: pg.glyph, size: 16, color: tab === pg.key ? HEALTH_ACCENT : HEALTH_DIM })),
  h("span", { style: { marginTop: 2 } }, pg.zh))));
  return h("div", { className: "h-full min-h-0 flex flex-col", "data-wk": "papp", "data-app": "health", style: { background: "linear-gradient(180deg,#f6f7f9 0%," + HEALTH_BG + " 40%," + HEALTH_BG + " 100%)" } },
    chrome,
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 16px 24px" } },
      body.length ? body : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: HEALTH_DIM } }, "这一页还是空的，点右上角刷一次")),
    nav);
}
// ============================================================
// 视频（仿 bilibili）—— 白天刷的那些（她 2026-08-29 拆成独立 app）
// 这个 app 最好的东西不是TA看了什么，是【TA发过的弹幕】：
// 短、脱口而出、没措辞，跟TA在别处说话的样子可以完全不同。
// ============================================================
const BILI_PINK = "#fb7299";
const BILI_BLUE = "#23ade5";
const BILI_BG = "#f6f7f8";
const BILI_INK = "#18191c";
const BILI_DIM = "#9499a0";
const BILI_COVERS = [
  ["#8ec5e8", "#c9e4f4"], ["#f6a9be", "#fbd3de"], ["#a8d5b5", "#d3ead9"],
  ["#e8c98e", "#f4e3c4"], ["#b3aede", "#d9d6ef"], ["#8fd0c8", "#c7e7e2"]
];
function BiliView({ d, char, t, onBack, onRefresh, refreshing, onPeek, drive }) {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(null);
  // ── 「看TA玩」驱动（第五批）：这一路什么都改不了，就是刷 ──
  const driveItem = drive && drive.item;
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setOpen(null); return; }
    const list = (Array.isArray(d && d.items) ? d.items : []).filter(x => x && typeof x === "object");
    const row0 = watchOpenPick(list, driveItem, x => x && x.title);
    const i = row0 ? list.indexOf(row0) : -1;
    // ⚠️open 存的是 { v, i } 这一对，不是那条本身——照这一屏自己的写法来
    if (i >= 0) setOpen({ v: list[i], i: i });
  }, [driveItem]);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const me = (data.me && typeof data.me === "object") ? data.me : {};
  const items = A(data.items).filter(x => x && typeof x === "object");
  const tabs = ["全部"].concat(A(data.tabs).filter(x => typeof x === "string").slice(0, 6));
  const cur = tabs[Math.min(tab, tabs.length - 1)] || "全部";
  const shown = cur === "全部" ? items : items.filter(x => x.tab === cur);
  const cover = i => BILI_COVERS[i % BILI_COVERS.length];
  const card = (v, i) => h("button", {
    key: i, onClick: () => setOpen({ v: v, i: i }), "data-wk": "pitem", "data-watch": "item:" + (v.title || ""), className: "text-left active:opacity-75",
    style: { background: "#fff", borderRadius: 10, overflow: "hidden", minWidth: 0 }
  }, h("div", { style: { position: "relative", aspectRatio: "16 / 10", background: "linear-gradient(140deg," + cover(i)[0] + "," + cover(i)[1] + ")" } },
    h("div", { style: { position: "absolute", left: 6, bottom: 6, right: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-end" } },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.5)" } }, (v.views != null ? v.views + " 播放" : "")),
      v.duration ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: "#fff", background: "rgba(0,0,0,.55)", borderRadius: 3, padding: "1px 5px" } }, v.duration) : null),
    A(v.myDanmaku).length ? h("span", { style: { position: "absolute", top: 6, left: 6, fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: "#fff", background: "rgba(251,114,153,.92)", borderRadius: 4, padding: "2px 6px" } }, "发过弹幕") : null),
  h("div", { style: { padding: "8px 9px 11px" } },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.45, color: BILI_INK, display: "-webkit-box", WebkitLineClamp: phoneTextClamp(v.title, 2), WebkitBoxOrient: "vertical", overflow: "hidden" } }, PTX(v.title)),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: BILI_DIM, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
      (v.up || "") + (v.danmaku != null ? " · " + v.danmaku + " 弹幕" : ""))));
  const detail = open ? (function () {
    const v = open.v || {};
    return h("div", { className: "absolute inset-0 flex flex-col", style: { background: "#fff", zIndex: 30 } },
      h("div", { style: { position: "relative", aspectRatio: "16 / 9", background: "linear-gradient(140deg," + cover(open.i)[0] + "," + cover(open.i)[1] + ")", flexShrink: 0, paddingTop: safeTop(0) } },
        // 压在封面上：不套圆框，改成顶部一条从暗到透明的渐变把图标托住
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, right: 0, top: 0, height: safeTop(56), background: "linear-gradient(180deg,rgba(0,0,0,.34),transparent)", pointerEvents: "none" } }),
        h("button", { onClick: () => setOpen(null), "aria-label": "返回", className: "active:opacity-60 flex items-center justify-center", style: { position: "absolute", zIndex: 2, left: 6, top: safeTop(6), width: 40, height: 40 } }, h(IArrow, { size: 20, color: "#fff" })),
        // ⚠️这层播放按钮是 inset:0 铺满的装饰，必须 pointerEvents:none，
        // 否则它盖在返回键上面、把点击整个吃掉（她 2026-08-29 报「退出键是死的」）
        h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" } },
          h("div", { style: { width: 56, height: 56, borderRadius: 99, background: "rgba(255,255,255,.82)", display: "flex", alignItems: "center", justifyContent: "center" } },
            h("span", { style: { marginLeft: 4, borderLeft: "16px solid " + BILI_PINK, borderTop: "10px solid transparent", borderBottom: "10px solid transparent" } }))),
        v.duration ? h("span", { style: { position: "absolute", right: 8, bottom: 8, fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#fff", background: "rgba(0,0,0,.55)", borderRadius: 3, padding: "2px 6px" } }, v.duration) : null),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "14px 15px 24px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", lineHeight: 1.45, color: BILI_INK } }, PTX(v.title || "")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: BILI_DIM, marginTop: 8 } },
          [v.views != null ? v.views + " 播放" : "", v.danmaku != null ? v.danmaku + " 弹幕" : "", v.tab].filter(Boolean).join(" · ")),
        h("div", { className: "flex items-center gap-2.5", style: { marginTop: 14, paddingTop: 13, paddingBottom: 13, borderTop: "1px solid #f0f1f2", borderBottom: "1px solid #f0f1f2" } },
          h("div", { style: { width: 34, height: 34, borderRadius: 99, flexShrink: 0, background: "linear-gradient(140deg," + BILI_PINK + "," + BILI_BLUE + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } }, String(v.up || "?").trim().slice(0, 1)),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: BILI_INK } }, PTX(v.up || ""))),
        v.desc ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.8, color: "#61666d", marginTop: 13 } }, PTX(v.desc)) : null,
        A(v.myDanmaku).length ? h("div", { style: { marginTop: 18 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: BILI_PINK } }, T("他发过的弹幕")),
          A(v.myDanmaku).map((dm, j) => h("div", {
            key: j, style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: BILI_INK, background: "rgba(251,114,153,.08)", border: "1px solid rgba(251,114,153,.24)", borderRadius: 999, padding: "7px 14px", marginTop: 9, display: "inline-block" }
          }, dm))) : null,
        v.thought ? h("div", { "data-wk": "block", style: { marginTop: 18, background: "#f6f7f8", borderRadius: 12, padding: "13px 14px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: BILI_DIM } }, T("看完他想的")),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.85, color: "#3f4348", marginTop: 6 } }, PTX(v.thought))) : null,
        onPeek ? h("button", {
          onClick: () => onPeek({ tier: "quiet", label: T("他看的视频"), title: v.title, text: [v.up, A(v.myDanmaku).length ? T("他发的弹幕：") + A(v.myDanmaku).join(" / ") : "", v.thought].filter(Boolean).join("｜") }),
          className: "w-full active:opacity-60",
          style: { marginTop: 20, padding: "12px 0", borderRadius: 12, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid #e3e5e7", color: "#61666d" }
        }, T("转发给 TA · 他会知道你翻了手机")) : null));
  })() : null;
  const head = h("div", { "data-wk": "head", className: "shrink-0", style: { background: "#fff", paddingTop: safeTop(8) } },
    h("div", { className: "flex items-center gap-2.5 px-3 pb-2.5" },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 34, height: 34 } }, h(IArrow, { size: 18, color: BILI_INK })),
      // 「看TA玩」演到TA搜东西那一下，这颗药丸就是真的搜索条（她自己翻的时候一个像素没变）
      (drive && (drive.typing != null || drive.searchQ) && typeof window !== "undefined" && window.PhoneWatch)
        ? h(window.PhoneWatch.WatchSearchPill, { typing: drive.typing, q: drive.searchQ,
            skin: { ink: BILI_INK, dim: BILI_DIM, soft: "#f1f2f3", accent: BILI_PINK } })
        : h("div", { className: "flex-1 min-w-0 flex items-center", style: { height: 32, borderRadius: 99, background: "#f1f2f3", padding: "0 13px" } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: BILI_DIM } }, "搜索")),
      h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 34, height: 34 } }, h(IRefresh, { size: 17, color: BILI_INK }))),
    // TA自己的账号条：昵称 + 等级 + UID（她 2026-08-29 说找不到，原来只藏在搜索框占位里）
    (me.name || me.uid) ? h("div", { className: "flex items-center px-3 pb-2.5", style: { gap: 10 } },
      h("div", { style: { width: 34, height: 34, borderRadius: 99, flexShrink: 0, background: "linear-gradient(140deg," + BILI_PINK + "," + BILI_BLUE + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } }, String(me.name || char.name || "?").trim().slice(0, 1)),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { className: "flex items-center", style: { gap: 6 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: BILI_INK } }, me.name || char.name),
          me.level ? h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(10px * var(--app-fs, 1))", color: "#fff", background: BILI_PINK, borderRadius: 5, padding: "2px 6px" } }, "LV" + me.level) : null),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: BILI_DIM, marginTop: 3 } },
          [me.uid ? "UID " + me.uid : "", me.fans != null ? me.fans + " 粉丝" : "", me.coins != null ? me.coins + " 硬币" : ""].filter(Boolean).join(" · ")))) : null,
    h("div", { className: "flex gap-1 px-3 pb-2 overflow-x-auto", style: { scrollbarWidth: "none" } }, tabs.map((tb, i) => h("button", {
      key: i, onClick: () => setTab(i), className: "shrink-0 active:opacity-60",
      // ── 分区不是一排药丸（tabs-not-plain-pills）──────────────────────
      //   填个浅粉底的药丸搬到任何 app 里都成立。这一页是【视频站的分区行】：
      //   选中那个是加粗的粉字 + 底下一道短粗的圆头横杠，没选的只是灰字。
      //   字重、颜色、底下那道杠三样一起变，不是只换个填色。
      style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", padding: "6px 10px 4px", minHeight: 40,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        color: i === tab ? BILI_PINK : "#61666d", fontWeight: i === tab ? 700 : 400 }
    }, h("span", { key: "t" }, tb),
       h("span", { key: "u", "aria-hidden": "true", style: { width: 16, height: 3, borderRadius: 999,
         background: i === tab ? BILI_PINK : "transparent" } })))));
  return h("div", { className: "h-full min-h-0 flex flex-col relative", "data-wk": "papp", "data-app": "bili", style: { background: BILI_BG } }, head,
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "10px 9px 20px" } },
      shown.length ? h("div", { className: "grid grid-cols-2", style: { gap: 9 } }, shown.map(card))
        : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: BILI_DIM } }, "这个分区还没有内容")),
    detail);
}
// ============================================================
// 深夜台 —— 暗色、极简、不解释（她 2026-08-29 起的名，尺度照旧不动）
// ============================================================
function LateNightView({ d, char, t, onBack, onRefresh, refreshing, onPeek, drive }) {
  const [open, setOpen] = useState(null);
  // ── 「看TA玩」驱动（第五批）：只能看 ──
  const driveItem = drive && drive.item;
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setOpen(null); return; }
    const hit = watchOpenPick(Array.isArray(d && d.items) ? d.items : [], driveItem, x => x && x.title);
    if (hit) setOpen(hit);
  }, [driveItem]);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const me = (data.me && typeof data.me === "object") ? data.me : {};
  const items = A(data.items).filter(x => x && typeof x === "object");
  const BG = "#0d0c0e", CARD = "#17151a", INK = "#e8e3e6", DIM = "rgba(232,227,230,.44)", HOT = "#c0566d";
  const row = (v, i) => h("button", {
    key: i, onClick: () => setOpen(v), "data-wk": "pitem", "data-watch": "item:" + (v.title || ""), className: "w-full text-left active:opacity-70",
    style: { display: "flex", gap: 12, padding: "13px 0", borderTop: i ? "1px solid rgba(232,227,230,.08)" : "none" }
  }, h("div", { style: { width: 112, height: 66, borderRadius: 8, flexShrink: 0, position: "relative", overflow: "hidden", background: "linear-gradient(140deg,#2a2129," + ["#3a2630", "#2b2733", "#33272a", "#262b33", "#332a26"][i % 5] + ")" } },
    h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" } },
      h("span", { style: { marginLeft: 3, borderLeft: "13px solid rgba(232,227,230,.5)", borderTop: "8px solid transparent", borderBottom: "8px solid transparent" } })),
    v.duration ? h("span", { style: { position: "absolute", right: 5, bottom: 5, fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: "#fff", background: "rgba(0,0,0,.6)", borderRadius: 3, padding: "1px 5px" } }, v.duration) : null),
  h("div", { style: { flex: 1, minWidth: 0 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.45, color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, PTX(v.title || "")),
    h("div", { className: "flex flex-wrap gap-1.5", style: { marginTop: 8 } }, A(v.tags).slice(0, 4).map((tg, j) => h("span", {
      key: j, style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: DIM, border: "1px solid rgba(232,227,230,.16)", borderRadius: 999, padding: "2px 8px" }
    }, tg))),
    v.views ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: DIM, marginTop: 7 } }, v.views) : null));
  const detail = open ? h(PhoneSubPage, {
    bg: { background: BG }, ink: INK, title: "深夜台", onClose: () => setOpen(null)
  },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: DIM } }, open.duration || ""),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", lineHeight: 1.45, color: INK, marginTop: 8 } }, PTX(open.title)),
    h("div", { className: "flex flex-wrap gap-1.5", style: { marginTop: 12 } }, A(open.tags).map((tg, j) => h("span", {
      key: j, style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: HOT, border: "1px solid rgba(192,86,109,.4)", borderRadius: 999, padding: "3px 10px" }
    }, tg))),
    open.thought ? h("div", { style: { marginTop: 18, borderLeft: "2px solid " + HOT, paddingLeft: 13, fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.95, color: "rgba(232,227,230,.86)" } }, PTX(open.thought)) : null,
    onPeek ? h("button", {
      onClick: () => onPeek({ tier: "hidden", label: "深夜台", hiddenWhat: "深夜一个人偷偷看的成人视频（「深夜台」是那个视频站，不是备忘录也不是自己写的东西）", lead: "[我翻了你的手机]在你深夜偷偷看片的那个站（深夜台）的观看记录里看到了：", title: open.title, text: [A(open.tags).join(" / "), open.thought].filter(Boolean).join("｜") }),
      className: "w-full active:opacity-60",
      style: { marginTop: 22, padding: "13px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid rgba(192,86,109,.5)", color: HOT }
    }, T("摆到 TA 面前 · 这是他藏起来的")) : null) : null;
  return h("div", { className: "h-full min-h-0 flex flex-col relative", "data-wk": "papp", "data-app": "latenight", style: { background: BG } },
    h(Head, { zh: "深夜台",
      bg: "transparent",
      noLine: true,
      ink: INK,
      onBack: onBack,
      right: h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: INK })) }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 18px 24px" } },
      (me.lastAt || me.note) ? h("div", { style: { padding: "10px 0 16px", borderBottom: "1px solid rgba(232,227,230,.08)", marginBottom: 4 } },
        (me.uid || me.lastAt) ? h("div", { className: "flex items-center justify-between" },
          h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: ".14em", color: "rgba(232,227,230,.66)", border: "1px solid rgba(232,227,230,.18)", borderRadius: 6, padding: "3px 9px" } }, me.uid ? me.uid : "未登记"),
          me.lastAt ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: DIM } }, "上次 " + me.lastAt) : null) : null,
        me.note ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.8, color: "rgba(232,227,230,.62)", marginTop: 8 } }, PTX(me.note)) : null) : null,
      items.length ? items.map(row) : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: DIM } }, "深夜台还是空的")),
    detail);
}
// ============================================================
// 广场（原「赞过」）—— 双列瀑布流图文社区
// 她 2026-08-29 说想做成某种社媒但没定；我选了图文社区而不是短视频，
// 理由：视频已经占了两个 app（视频 / 深夜台），再来一个短视频是重复；
// 而「点赞收藏」这个动作本来就最贴图文——TA不会写下来，但TA会点。
// 三页：广场（TA赞过收藏过的）· 关注 · 我的（TA自己发的）
// ============================================================
const PLAZA_RED = "#ff2e4d";
const PLAZA_BG = "#f7f7f8";
const PLAZA_INK = "#1f1f22";
const PLAZA_DIM = "#9b9ba3";
const PLAZA_COVERS = [
  ["#f4b8bf", "#fadde0"], ["#b9d4ef", "#dbe9f7"], ["#cfe0bd", "#e6efdc"],
  ["#eed9b0", "#f7ecd6"], ["#cfc4e6", "#e5dff2"], ["#b6dfd7", "#d9efeb"]
];
function PlazaView({ d, char, t, onBack, onRefresh, refreshing, onPeek, drive }) {
  const [tab, setTab] = useState("feed");
  const [open, setOpen] = useState(null);
  const [chan, setChan] = useState(0);
  // ── 「看TA玩」驱动（第四批）。drive 不在时这一屏一个像素都没变 ──
  const driveTab = drive && drive.tab, driveItem = drive && drive.item;
  useEffect(() => { if (drive && driveTab) { setTab(driveTab); setOpen(null); } }, [driveTab]);
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setOpen(null); return; }
    const pool = [].concat(Array.isArray(d && d.items) ? d.items : [], Array.isArray(d && d.drafts) ? d.drafts : []);
    const hit = watchOpenPick(pool, driveItem, x => x && x.title);
    if (hit) setOpen(hit);
  }, [driveItem]);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab]);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const me = (data.me && typeof data.me === "object") ? data.me : {};
  const items = A(data.items).filter(x => x && typeof x === "object");
  const mine = A(data.mine).filter(x => x && typeof x === "object");
  const follows = A(data.follows).filter(x => x && typeof x === "object");
  const cover = n => PLAZA_COVERS[(Number(n) || 0) % PLAZA_COVERS.length];
  // 瀑布流：两列，按顺序塞进当前较短的那一列（高度用封面比例估）
  const masonry = list => {
    const cols = [[], []], hgt = [0, 0];
    list.forEach((it, i) => {
      const c = hgt[0] <= hgt[1] ? 0 : 1;
      const ratio = [1.32, 1, 0.78, 1.15][i % 4];
      cols[c].push({ it: it, i: i, ratio: ratio });
      hgt[c] += ratio * 100 + 90;
    });
    return h("div", { className: "grid grid-cols-2", style: { gap: 9, alignItems: "start" } },
      cols.map((col, ci) => h("div", { key: ci, style: { display: "flex", flexDirection: "column", gap: 9 } }, col.map(x => postCard(x.it, x.i, x.ratio)))));
  };
  const postCard = (it, i, ratio) => h("button", {
    key: i, onClick: () => setOpen(it), className: "text-left active:opacity-75", "data-wk": "pitem", "data-watch": "item:" + (it.title || ""),
    style: { background: "#fff", borderRadius: 12, overflow: "hidden", minWidth: 0 }
  }, h("div", { style: { aspectRatio: "1 / " + (ratio || 1), background: "linear-gradient(150deg," + cover(it.cover)[0] + "," + cover(it.cover)[1] + ")" } }),
  h("div", { style: { padding: "9px 10px 11px" } },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.5, color: PLAZA_INK, display: "-webkit-box", WebkitLineClamp: phoneTextClamp(it.title, 2), WebkitBoxOrient: "vertical", overflow: "hidden" } }, PTX(it.title)),
    h("div", { className: "flex items-center", style: { marginTop: 9, gap: 5 } },
      h("div", { style: { width: 17, height: 17, borderRadius: 99, flexShrink: 0, background: "linear-gradient(140deg," + cover(it.cover)[0] + "," + cover(it.cover)[1] + ")", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(9px * var(--app-fs, 1))", color: "#6a6a72" } }, String(it.author || "?").trim().slice(0, 1)),
      h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: PLAZA_DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, PTX(it.author || "")),
      h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: it.act === "收藏" ? "#e8a33d" : PLAZA_RED } }, (it.act === "收藏" ? "★ " : "♥ ") + (it.likes != null ? it.likes : "")))));
  // ── 一条笔记：整页（v59.58）───────────────────────────────────────────
  // 她 2026-09-01：「小红书现在是半屏，帮我弄成点开是全屏样式吧」。
  // 原来是从底下掀起来的半窗（justify-end + maxHeight 84%）——
  // 见 施工规则/no-half-sheet.md：**默认不要半窗**。
  // 判据是「这一层的内容，需要同时看见它下面那一层吗？」——一条笔记不需要，
  // 它有正文、标签、点赞、还有一颗转发按钮，半窗先扣掉一半屏幕纯属白扣。
  // 整页照【去处】那两页的做法：顶栏 shrink-0、正文 flex-1 min-h-0 overflow-y-auto，
  // 上一层那张封面糊开压暗当底衬——接得住上一层，又不抢正文。
  const detailPage = open ? h("div", { className: "h-full min-h-0 flex flex-col", "data-wk": "pdetail", style: { background: PLAZA_BG } },
    h(Head, { zh: open._draft ? T("他没发出去的") : (open.act === "收藏" ? T("他收藏的") : T("他赞过的")),
      bg: "#fff", ink: PLAZA_INK, lineInk: "#eeeef1", onBack: () => setOpen(null) }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto" },
      h("div", { style: { height: 188, background: "linear-gradient(150deg," + cover(open.cover)[0] + "," + cover(open.cover)[1] + ")" } }),
      h("div", { style: { padding: "16px 20px calc(env(safe-area-inset-bottom) * 0.4 + 24px)" } },
        h("div", { className: "flex items-center gap-2.5" },
          h("div", { style: { width: 30, height: 30, borderRadius: 99, flexShrink: 0, background: "linear-gradient(140deg,#ffd0d6," + PLAZA_RED + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))" } }, String(open.author || "?").trim().slice(0, 1)),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#55555c" } }, PTX(open.author || "")),
          h("div", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: PLAZA_DIM } }, open.time || open.savedAt || "")),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", lineHeight: 1.5, color: PLAZA_INK, marginTop: 14, wordBreak: "break-word" } }, PTX(open.title || "")),
        open.excerpt ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.95, color: "#4b4b53", marginTop: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, PTX(open.excerpt)) : null,
        A(open.tags).length ? h("div", { className: "flex flex-wrap gap-1.5", style: { marginTop: 16 } }, A(open.tags).map((tg, j) => h("span", {
          key: j, style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#5f7fb8", background: "#eef2f8", borderRadius: 999, padding: "4px 11px" }
        }, "#" + tg))) : null,
        h("div", { className: "flex items-center", style: { gap: 18, marginTop: 20, paddingTop: 14, borderTop: "1px solid #f1f1f4" } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: open.act !== "收藏" ? PLAZA_RED : "#b0b0b8" } }, "♥ " + (open.likes != null ? open.likes : "")),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: open.act === "收藏" ? "#e8a33d" : "#b0b0b8" } }, "★ 收藏"),
          h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: PLAZA_DIM } }, open._draft ? T("他一直没发出去") : (open.act === "收藏" ? T("他收藏了这条") : T("他点了赞")))),
        onPeek ? h("button", {
          onClick: () => onPeek(open._draft
            ? { tier: "hidden", label: "小红书草稿箱", title: open.title, text: [open.excerpt, open.savedAt].filter(Boolean).join("｜") }
            : { tier: "quiet", label: T("他") + (open.act === "收藏" ? "收藏" : "赞") + "过的", title: open.title, text: [open.author, open.excerpt].filter(Boolean).join("｜") }),
          className: "w-full active:opacity-60",
          style: { marginTop: 20, padding: "13px 0", borderRadius: 12, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid " + (open._draft ? "rgba(200,80,70,.45)" : "#e6e6ea"), color: open._draft ? "#b6473c" : "#55555c" }
        }, open._draft ? T("摆到 TA 面前 · 这是他没发出去的") : T("转发给 TA · 他会知道你翻了手机")) : null))) : null;
  // ── 关注（v62.60 重做）─────────────────────────────────────────────
  // 审美审计 2026-09-04 判成【基础款】：一排白色圆角 14 的卡，卡里头像 + 名字 + 一句简介。
  // 那是通用的联系人列表，搬到哪儿都成立。本尊的关注页不长这样：
  // 一整块白纸上一行一个人，行与行只隔一道发丝线，右边永远挂着一枚【已关注】的描边胶囊
  // ——那枚胶囊就是「这是关注列表」而不是「这是通讯录」的全部区别。
  const followPage = follows.length
    ? h("div", { "data-wk": "block", style: { background: "#fff", borderRadius: 12, overflow: "hidden", margin: "4px 0" } },
        follows.map((f, i) => h("div", { key: i, className: "flex items-center", style: { gap: 12, padding: "13px 14px", borderTop: i ? "1px solid #f0f0f2" : "none" } },
          h("div", { style: { width: 42, height: 42, borderRadius: 99, flexShrink: 0, background: "linear-gradient(140deg," + cover(i)[0] + "," + cover(i)[1] + ")", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: "#5c5c64" } }, String(f.name || "?").trim().slice(0, 1)),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: PLAZA_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, PTX(f.name || "")),
            f.desc ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.55, color: PLAZA_DIM, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, PTX(f.desc)) : null),
          h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: PLAZA_DIM, border: "1px solid #dcdce0", borderRadius: 999, padding: "5px 13px" } }, "已关注"))))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: PLAZA_DIM } }, T("他谁也没关注"));
  // ── 「我的」：照小红书个人页（她 2026-08-29 给了参考稿）──
  // 大背景 + 头像 + 小红书号 + 三个数字 + 简介 + 药丸标签，
  // 底下 笔记 / 收藏 / 草稿 三个 tab；草稿带锁——那是TA写了却没发的。
  const drafts = A(data.drafts).filter(x => x && typeof x === "object");
  const saved = items.filter(x => x.act === "收藏");
  const [mtab, setMtab] = useState("note");
  const gridOf = (list, kind) => list.length
    ? h("div", { className: "grid grid-cols-2", style: { gap: 9, alignItems: "start" } },
        list.map((x, i) => h("button", {
          key: i, onClick: () => kind === "draft" ? setOpen({ ...x, _draft: true }) : setOpen(x),
          className: "text-left active:opacity-75",
          style: { background: "#fff", borderRadius: 12, overflow: "hidden", minWidth: 0, border: kind === "draft" ? "1px dashed #d8d8de" : "none" }
        }, h("div", { style: { aspectRatio: kind === "draft" ? "1 / 0.6" : "1 / " + [1.2, 0.85, 1.05, 0.95][i % 4], background: kind === "draft" ? "#f4f4f6" : "linear-gradient(150deg," + cover(x.cover != null ? x.cover : i)[0] + "," + cover(x.cover != null ? x.cover : i)[1] + ")", display: "flex", alignItems: "center", justifyContent: "center" } },
          kind === "draft" ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#a8a8b0" } }, "未发布") : null),
        h("div", { style: { padding: "9px 10px 11px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.5, color: PLAZA_INK, display: "-webkit-box", WebkitLineClamp: phoneTextClamp(x.title, 2), WebkitBoxOrient: "vertical", overflow: "hidden" } }, PTX(x.title)),
          A(x.tags).length ? h("div", { className: "flex flex-wrap", style: { gap: 5, marginTop: 7 } }, A(x.tags).slice(0, 3).map((tg, j) => h("span", {
            key: j, style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#5f7fb8", background: "#eef2f8", borderRadius: 999, padding: "2px 7px" }
          }, "#" + tg))) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: kind === "draft" ? "#c0554f" : PLAZA_DIM, marginTop: 7 } },
            kind === "draft" ? (x.savedAt || "没发出去") : [x.time, x.likes != null ? "♥ " + x.likes : ""].filter(Boolean).join(" · "))))))
    : h("div", { style: { padding: "44px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: PLAZA_DIM } },
        kind === "draft" ? "草稿箱是空的" : kind === "save" ? T("他没收藏过什么") : T("他一条也没发过"));
  const mineTab = (k, label, n, lock) => h("button", {
    key: k, onClick: () => setMtab(k), className: "flex items-center active:opacity-60",
    style: { gap: 4, paddingBottom: 7, borderBottom: "2px solid " + (mtab === k ? PLAZA_RED : "transparent") }
  }, lock ? h("span", { style: { fontSize: "calc(10px * var(--app-fs, 1))", color: mtab === k ? PLAZA_INK : "#b0b0b8" } }, "🔒") : null,
  h("span", { style: { fontFamily: F_DISPLAY, fontSize: mtab === k ? 16 : 15, color: mtab === k ? PLAZA_INK : "#b0b0b8" } }, label),
  n ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "#b0b0b8" } }, n) : null);
  const minePage = h("div", { style: { margin: "-10px -12px 0" } },
    // 顶部大背景卡
    h("div", { style: { position: "relative", background: "linear-gradient(150deg,#8f97a8,#c8ccd4 55%,#e7e3dd)", padding: "26px 20px 22px" } },
      h("div", { className: "flex items-center", style: { gap: 15 } },
        h("div", { "data-wk": "block", style: { width: 74, height: 74, borderRadius: 99, flexShrink: 0, background: "linear-gradient(140deg,#ffd0d6," + PLAZA_RED + ")", border: "3px solid rgba(255,255,255,.85)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(30px * var(--app-fs, 1))" } }, String(me.name || char.name || "?").trim().slice(0, 1)),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(25px * var(--app-fs, 1))", color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,.28)" } }, me.name || char.name),
          me.xhsId ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "rgba(255,255,255,.86)", marginTop: 5 } }, "小红书号：" + me.xhsId) : null)),
      h("div", { className: "flex", style: { gap: 26, marginTop: 18 } },
        [[me.following, "关注"], [me.followers, "粉丝"], [me.likes, "获赞与收藏"]].map(([n, l], i) => h("div", { key: i },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", color: "#fff" } }, n != null ? n : "--"),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "rgba(255,255,255,.82)", marginLeft: 5 } }, l)))),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.6, color: "#fff", marginTop: 16 } }, PTX(me.bio || "这人没写简介")),
      me.tag ? h("span", { style: { display: "inline-block", marginTop: 12, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#fff", background: "rgba(255,255,255,.22)", borderRadius: 999, padding: "4px 12px" } }, PTX(me.tag)) : null),
    // tab 条
    h("div", { "data-wk": "block", style: { background: "#fff", borderRadius: "16px 16px 0 0", marginTop: -14, position: "relative", padding: "16px 18px 0" } },
      h("div", { className: "flex", style: { gap: 22, borderBottom: "1px solid #f1f1f4" } },
        mineTab("note", "笔记", mine.length, false),
        mineTab("save", "收藏", saved.length, false),
        mineTab("draft", "草稿", drafts.length, true)),
      h("div", { style: { padding: "14px 0 20px" } },
        mtab === "note" ? gridOf(mine, "note") : mtab === "save" ? gridOf(saved, "save") : gridOf(drafts, "draft"))));
  const PAGES = [
    { key: "feed", zh: "首页", glyph: "liked", body: (function () {
      const chans2 = ["发现"].concat(A(data.tabs).filter(x => typeof x === "string").slice(0, 5));
      const c = chans2[Math.min(chan, chans2.length - 1)] || "发现";
      const list = c === "发现" ? items : items.filter(x => x.tab === c);
      return list.length ? masonry(list) : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: PLAZA_DIM } }, c === "发现" ? T("他还没赞过什么") : "这个频道底下没有");
    })() },
    { key: "follow", zh: "关注", glyph: "me", body: followPage },
    { key: "mine", zh: "我的", glyph: "notes", body: minePage }
  ];
  const page = PAGES.find(x => x.key === tab) || PAGES[0];
  // 顶栏照小红书：返回 · 居中的频道 tab（首页那页才有）· 刷新
  const chans = ["发现"].concat(A(data.tabs).filter(x => typeof x === "string").slice(0, 5));
  const searchPill = (drive && (drive.typing != null || drive.searchQ) && typeof window !== "undefined" && window.PhoneWatch)
    ? h(window.PhoneWatch.WatchSearchPill, { typing: drive.typing, q: drive.searchQ,
        skin: { ink: PLAZA_INK, dim: PLAZA_DIM, soft: "#f3f3f6", accent: PLAZA_RED } })
    : null;
  const topBar = h("div", { "data-wk": "head", className: "shrink-0 flex items-center px-2 pb-1.5", style: { paddingTop: safeTop(10), background: "#fff" } },
    h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center shrink-0", style: { width: 36, height: 36 } }, h(IArrow, { size: 18, color: PLAZA_INK })),
    // 演到TA搜东西那一下，频道那一排让位给搜索条（平时一个像素都不变）
    searchPill,
    searchPill ? null : tab === "feed"
      ? h("div", { className: "flex-1 min-w-0 flex gap-3 overflow-x-auto justify-center", style: { scrollbarWidth: "none" } }, chans.map((c, i) => h("button", {
          key: i, onClick: () => setChan(i), className: "shrink-0 active:opacity-60",
          style: { fontFamily: F_DISPLAY, fontSize: i === chan ? 16 : 14, color: i === chan ? PLAZA_INK : "#b0b0b8", padding: "3px 2px", borderBottom: i === chan ? "2px solid " + PLAZA_RED : "2px solid transparent" }
        }, c)))
      : searchPill ? null : h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: PLAZA_INK } }, page.zh),
    h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center shrink-0", style: { width: 36, height: 36 } }, h(IRefresh, { size: 17, color: PLAZA_INK })));
  // ⚠️整页要【顶掉】列表，不是浮在它上面——所以在这儿 return，
  // 而且必须排在所有 hook 后面（提前 return 的组件里 hook 一律排最前，见 #310 那次教训）。
  if (detailPage) return detailPage;
  return h("div", { className: "h-full min-h-0 flex flex-col relative", "data-wk": "papp", "data-app": "liked", style: { background: PLAZA_BG } }, topBar,
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "10px 12px 20px" } }, PTX(page.body)),
    h("div", { className: "shrink-0 grid grid-cols-3", style: { padding: "5px 16px", paddingBottom: COMPOSER_PAD_BOTTOM, background: "#fff", borderTop: "1px solid #eeeef1" } },
      PAGES.map(pg => h("button", {
        key: pg.key, onClick: () => { setTab(pg.key); setOpen(null); }, "data-wk": "ptab", "data-on": tab === pg.key ? "1" : "0", "data-watch": "tab:" + pg.key,
        className: "flex flex-col items-center justify-center active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: tab === pg.key ? PLAZA_RED : PLAZA_DIM, paddingTop: 2, paddingBottom: 2 }
      }, h("div", { style: { width: 30, height: 20, display: "flex", alignItems: "center", justifyContent: "center" } },
        h(PGlyph, { k: pg.glyph, size: 16, color: tab === pg.key ? PLAZA_RED : PLAZA_DIM })),
      h("span", { style: { marginTop: 2 } }, pg.zh)))),
    // TA刚点进去的那一条笔记（现编的那一页）
    watchPageNode(drive, { bg: "#fff", ink: PLAZA_INK, dim: PLAZA_DIM, line: "#eeeef1", mark: PLAZA_RED }));
}
// ============================================================
// 日历 —— 月历格子 + 事项列表。推迟次数是这个 app 的重点：
// 一件推了四次的小事，比四件按时完成的大事更能说明这个人。
// ============================================================
function CalendarView({ d, char, t, onBack, onRefresh, refreshing, onPeek, drive }) {
  const [open, setOpen] = useState(null);
  const [sel, setSel] = useState(null);
  // ── 「看TA玩」驱动（第五批）：日历只能看 ──
  const driveItem = drive && drive.item;
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setOpen(null); return; }
    const hit = watchOpenPick(Array.isArray(d && d.items) ? d.items : [], driveItem, x => x && x.title);
    if (hit) setOpen(hit);
  }, [driveItem]);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const items = A(data.items).filter(x => x && typeof x === "object");
  const CAL_BG = "#f5f5f7", CAL_INK = "#1c1c1e", CAL_DIM = "#8e8e93", CAL_RED = "#ff3b30";
  const parse = v => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(v || "")); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  const dated = items.map(x => ({ x: x, at: parse(x.date) })).filter(r => r.at);
  // 月份（v64.29 改，她 2026-09-06：「为啥查手机显示 8 月明明已经九月了」）。
  // ⚠️原来是【数据里出现最多的那个月】：她日历上多半是七八月记下的旧事，
  //   于是九月打开还停在八月——而这一页是「TA的日历」，人翻开日历默认看的是【这个月】。
  //   出现最多的那个月是个统计量，不是一个人会想看的东西。
  const now = new Date(char && typeof vclockMap === "function" ? vclockMap(Date.now(), char.id) : Date.now());   // 翻开就是 TA 那只钟的这个月
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const cy = ym.y, cm = ym.m;
  const stepMonth = n => { const d0 = new Date(cy, cm - 1 + n, 1); setYm({ y: d0.getFullYear(), m: d0.getMonth() + 1 }); setSel(null); };
  const thisMonth = cy === now.getFullYear() && cm === now.getMonth() + 1;
  // 哪几个月真有东西：翻到空月时告诉她东西在哪儿，别让她一个月一个月地找
  const monthsWith = [...new Set(dated.map(r => r.at.y + "-" + r.at.m))]
    .sort().map(k => ({ y: +k.split("-")[0], m: +k.split("-")[1] }));
  const first = new Date(cy, cm - 1, 1);
  const lead = (first.getDay() + 6) % 7; // 周一起头
  const days = new Date(cy, cm, 0).getDate();
  const onDay = dd => dated.filter(r => r.at.y === cy && r.at.m === cm && r.at.d === dd).map(r => r.x);
  const isToday = dd => now.getFullYear() === cy && now.getMonth() + 1 === cm && now.getDate() === dd;
  const late = x => Number(x.postponed) >= 2 || !!x.overdue;
  // 日期这一栏原来直接切字符串，"2026-8-31" 和 "2026-08-29" 两种写法会显示成
  // 「8月31日」和「08月29日」两个样子。统一按解析出来的年月日重排。
  const calDay = v => { const a = parse(v); return a ? a.m + "月" + a.d + "日" : ""; };
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(h("div", { key: "p" + i }));
  for (let dd = 1; dd <= days; dd++) {
    const list = onDay(dd);
    const hot = list.some(late);
    const picked = sel === dd;
    cells.push(h("button", {
      key: "d" + dd, onClick: () => setSel(picked ? null : dd), className: "active:opacity-60",
      style: { aspectRatio: "1 / 1", borderRadius: 11, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: picked ? CAL_INK : isToday(dd) ? "rgba(255,59,48,.10)" : "transparent" }
    }, h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(13.5px * var(--app-fs, 1))", color: picked ? "#fff" : isToday(dd) ? CAL_RED : CAL_INK } }, dd),
    h("span", { style: { height: 5, display: "flex", gap: 2 } }, list.slice(0, 3).map((x, j) => h("span", {
      key: j, style: { width: 4, height: 4, borderRadius: 99, background: picked ? "rgba(255,255,255,.9)" : late(x) ? CAL_RED : x.done ? "#c7c7cc" : "#4a90d9" }
    })))));
  }
  // ⚠️没选某一天时列【这个月的】，不是全部：上面那张月历翻到了九月、
  //   底下却还铺着七月的事，两处对不上，人会以为月历坏了。
  const inMonth = dated.filter(r => r.at.y === cy && r.at.m === cm).map(r => r.x);
  const listFor = sel ? onDay(sel) : inMonth;
  const row = (x, i) => h("button", {
    key: i, onClick: () => setOpen(x), "data-wk": "pitem", "data-watch": "item:" + (x.title || ""), className: "w-full text-left active:opacity-60",
    style: { display: "flex", gap: 12, background: "#fff", borderRadius: 14, padding: "14px 15px", marginBottom: 9 }
  }, h("span", { style: { width: 8, height: 8, borderRadius: 99, marginTop: 6, flexShrink: 0, background: x.done ? "#c7c7cc" : late(x) ? CAL_RED : "#4a90d9" } }),
  h("div", { style: { flex: 1, minWidth: 0 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.45, color: x.done ? CAL_DIM : CAL_INK, textDecoration: x.done ? "line-through" : "none" } }, PTX(x.title)),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: late(x) ? CAL_RED : CAL_DIM, marginTop: 5 } },
      [calDay(x.date), x.time, x.kind, x.who, Number(x.postponed) > 0 ? "推迟 " + x.postponed + " 次" : (x.overdue ? "早该做了" : "")].filter(Boolean).join(" · "))));
  const detail = open ? h(PhoneSubPage, {
    bg: { background: CAL_BG }, ink: CAL_INK,
    title: open.kind === "提醒" ? "提醒事项" : "这一天", onClose: () => setOpen(null)
  },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: CAL_DIM } }, [open.kind, open.date, open.time].filter(Boolean).join(" · ")),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", lineHeight: 1.4, color: CAL_INK, marginTop: 8 } }, PTX(open.title || "")),
    open.who ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: CAL_DIM, marginTop: 7 } }, "和 " + open.who) : null,
    Number(open.postponed) > 0 ? h("div", { "data-wk": "block", style: { marginTop: 14, background: "rgba(255,59,48,.08)", borderRadius: 12, padding: "12px 14px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: "#c0392b" } }, "已经往后推了 " + open.postponed + " 次")
      : open.overdue ? h("div", { "data-wk": "block", style: { marginTop: 14, background: "rgba(255,59,48,.08)", borderRadius: 12, padding: "12px 14px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: "#c0392b" } }, T("日子早过了，他还没做。")) : null,
    open.note ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.95, color: "#4b4b53", marginTop: 14 } }, PTX(open.note)) : null,
    onPeek ? h("button", {
      onClick: () => onPeek({ tier: "quiet", label: open.kind === "提醒" ? "提醒事项" : "日历", title: open.title, text: [open.date, open.who ? "和 " + open.who : "", open.note, Number(open.postponed) > 0 ? "推迟过 " + open.postponed + " 次" : (open.overdue ? "日子早过了" : "")].filter(Boolean).join("｜") }),
      className: "w-full active:opacity-60",
      style: { marginTop: 20, padding: "12px 0", borderRadius: 12, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid #e6e6ea", color: "#55555c" }
    }, T("转发给 TA · 他会知道你翻了手机")) : null) : null;
  return h("div", { className: "h-full min-h-0 flex flex-col relative", "data-wk": "papp", "data-app": "calendar", style: { background: CAL_BG } },
    h(Head, { zh: (cy === now.getFullYear() ? "" : cy + "年 ") + cm + "月",
      bg: "transparent",
      noLine: true,
      ink: CAL_INK,
      onBack: onBack,
      right: h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: CAL_INK })) }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 14px 22px" } },
      h("div", { "data-wk": "block", style: { background: "#fff", borderRadius: 18, padding: "14px 12px 10px", marginBottom: 16 } },
        // 翻月那一行（她 2026-09-06 要的「能不能换月份显示之前的和之后的」）
        h("div", { className: "flex items-center justify-between", style: { padding: "0 2px 8px" } },
          h("button", { onClick: () => stepMonth(-1), "aria-label": "上个月", className: "active:opacity-50",
            style: { width: 32, height: 28, fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: CAL_DIM } }, "‹"),
          h("button", { onClick: () => { setYm({ y: now.getFullYear(), m: now.getMonth() + 1 }); setSel(null); }, disabled: thisMonth,
            className: "active:opacity-60 disabled:opacity-100",
            style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: thisMonth ? CAL_INK : "#4a90d9" } },
            (cy === now.getFullYear() ? "" : cy + "年 ") + cm + "月" + (thisMonth ? "" : " · 回今天")),
          h("button", { onClick: () => stepMonth(1), "aria-label": "下个月", className: "active:opacity-50",
            style: { width: 32, height: 28, fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: CAL_DIM } }, "›")),
        h("div", { className: "grid grid-cols-7", style: { marginBottom: 6 } }, ["一", "二", "三", "四", "五", "六", "日"].map((w, i) => h("div", {
          key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: CAL_DIM }
        }, w))),
        h("div", { className: "grid grid-cols-7", style: { gap: 2 } }, cells)),
      h("div", { className: "flex items-baseline justify-between", style: { padding: "0 4px 10px" } },
        // ⚠️底下列的是【这个月】，标题就不能再叫「全部安排」——名字和内容对不上，
        //   人只会以为这个月之外的事被弄丢了
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: CAL_INK } }, sel ? cm + "月" + sel + "日" : cm + "月的安排"),
        sel ? h("button", { onClick: () => setSel(null), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#4a90d9" } }, "看全部") : null),
      listFor.length ? listFor.map(row)
        : h("div", { style: { padding: "40px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: CAL_DIM, lineHeight: 1.8 } },
            sel ? "这天没有安排"
              : h("div", null,
                  h("div", null, characterText(char, "这个月他日历上没有东西")),
                  // ⚠️别只说「没有」：翻空一个月就以为整本是空的。有的话就指出来在哪几个月
                  monthsWith.length ? h("div", { style: { fontSize: "calc(12px * var(--app-fs, 1))", marginTop: 6 } },
                    "有安排的是 " + monthsWith.slice(-4).map(x => (x.y === now.getFullYear() ? "" : x.y + "年") + x.m + "月").join("、")) : null))),
    detail);
}
// ============================================================
// 便签 —— 备忘录和录音合成一个（她 2026-08-29）
// 它们本来就是同一件事的两种载体：没人看的时候TA留给自己的东西。
// 一个是打的，一个是说的；**只有打字打不出来的才会被录下来**，这是分界。
// 界面：一墙彩色便利贴，微微歪着，录音那种带波形条和时长。
// ============================================================
const STICKY_COLORS = [
  { bg: "#fdf0a9", edge: "#f3e07f", ink: "#4a4222" },
  { bg: "#c9e8f7", edge: "#a9d6ec", ink: "#1f3b49" },
  { bg: "#f9cfd8", edge: "#efb7c3", ink: "#4c2831" },
  { bg: "#d3edcb", edge: "#b6dfab", ink: "#28401f" },
  { bg: "#e6dcf5", edge: "#d2c3ec", ink: "#372a4b" },
  { bg: "#ffd8b8", edge: "#f6c199", ink: "#4d3018" }
];
const STICKY_BG = "#efeae0";
function StickyView({ d, char, t, onBack, onRefresh, refreshing, onPeek, drive }) {
  const [open, setOpen] = useState(null);
  // 录音那种能真的放出来（她 2026-10-14）：配了音色就用TA的嗓子把转写念出来，跟游戏台词那颗 ▶ 同一个（TtsDot + useTtsPlayer）
  const tp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null;
  const A = a => Array.isArray(a) ? a : [];
  // 录音的 body 带着语音标记（(sighs)、<#0.5#>）：念的时候用，给人看的时候剥掉
  const noteSay = x => typeof ttsMarkStrip === "function" ? ttsMarkStrip(x) : x;
  // ──「看TA玩」驱动：这是【改】那一类——TA把写好的那条划掉重写（她举的例子之一）
  const driveItem = drive && drive.item;
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setOpen(null); return; }
    const hit = watchOpenPick(A(d && d.items), driveItem, x => x && x.title);
    if (hit) setOpen(hit);
  }, [driveItem]);
  const items = A((d && d.items)).filter(x => x && typeof x === "object");
  const pal = n => STICKY_COLORS[(Number(n) || 0) % STICKY_COLORS.length];
  const tilt = i => [-1.6, 1.2, -0.8, 1.8, -1.2, 0.9][i % 6];
  const wave = (c, n) => h("div", { "aria-hidden": "true", className: "flex items-end", style: { gap: 2, height: 15, marginTop: 9 } },
    Array.from({ length: n || 18 }, (_, j) => h("span", {
      key: j, style: { width: 2, borderRadius: 2, background: c, opacity: .55, height: 4 + ((j * 7) % 11) }
    })));
  const note = (it, i) => {
    const c = pal(it.color != null ? it.color : i);
    const voice = it.kind === "voice";
    return h("button", {
      key: i, "data-wk": "pitem", "data-watch": "item:" + (it.title || ""), onClick: () => setOpen(it), className: "text-left active:opacity-80",
      style: {
        background: c.bg, borderRadius: 3, padding: "13px 13px 15px", minWidth: 0,
        transform: "rotate(" + tilt(i) + "deg)",
        boxShadow: "0 6px 14px rgba(70,60,40,.13), inset 0 -14px 18px -14px " + c.edge
      }
    }, h("div", { className: "flex items-center", style: { gap: 5, marginBottom: 7 } },
      voice ? h(PGlyph, { k: "mic", size: 11, color: c.ink }) : null,
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: c.ink, opacity: .6 } }, (voice && it.duration ? it.duration + " · " : "") + (it.time || ""))),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.45, color: c.ink, display: "-webkit-box", WebkitLineClamp: phoneTextClamp(it.title, 2), WebkitBoxOrient: "vertical", overflow: "hidden" } }, PTX(it.title)),
    it.body ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.65, color: c.ink, opacity: .74, marginTop: 6, display: "-webkit-box", WebkitLineClamp: phoneTextClamp(it.body, voice ? 3 : 5), WebkitBoxOrient: "vertical", overflow: "hidden" } }, PTX(voice ? noteSay(it.body) : it.body)) : null,
    voice ? wave(c.ink, 20) : null);
  };
  const cols = [[], []];
  items.forEach((it, i) => cols[i % 2].push(note(it, i)));
  const detail = open ? (function () {
    const c = pal(open.color);
    const voice = open.kind === "voice";
    return h("div", { className: "absolute inset-0 flex flex-col justify-center px-5", style: { background: "rgba(60,52,38,.36)", zIndex: 30 }, onClick: () => setOpen(null) },
      h("div", { "data-wk": "block", onClick: e => e.stopPropagation(), style: { background: c.bg, borderRadius: 4, padding: "22px 20px 24px", maxHeight: "80%", overflowY: "auto", boxShadow: "0 20px 44px rgba(50,42,28,.32)" } },
        h("div", { className: "flex items-center justify-between", style: { marginBottom: 12 } },
          h("div", { className: "flex items-center", style: { gap: 6 } },
            voice ? h(PGlyph, { k: "mic", size: 13, color: c.ink }) : null,
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: c.ink, opacity: .62 } }, (voice ? "录音 " + (open.duration || "") + " · " : "") + (open.time || ""))),
          h("button", { onClick: () => setOpen(null), "aria-label": "关闭", className: "active:opacity-60", style: { fontSize: "calc(15px * var(--app-fs, 1))", color: c.ink, opacity: .6, padding: "0 4px" } }, "✕")),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", lineHeight: 1.45, color: c.ink } }, PTX(open.title || "")),
        voice ? h("div", { className: "flex items-end", style: { gap: 10 } },
          tp && typeof TtsDot === "function" && open.body ? h("span", { "data-wk": "pnotevoice", style: { color: c.ink, display: "inline-flex" } }, h(TtsDot, { k: "note:" + (open.time || "") + (open.title || ""), text: open.body, spk: char, tp: tp })) : null,
          wave(c.ink, 34)) : null,
        // ⚠️「看TA玩」里TA正在改这条：显示手上那份草稿，不是存档里那份。
        //   驱动时哪怕草稿是空的也要占着位（TA刚把整段划掉，那一下正是要看见的）。
        drive && drive.typing != null
          ? h("div", { "data-wk": "pinput", "data-watch": "input", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.95, color: c.ink, marginTop: 14, whiteSpace: "pre-wrap", minHeight: 30 } },
              drive.typing,
              h("span", { "aria-hidden": "true", style: { display: "inline-block", width: 1.5, height: 16, marginLeft: 1, verticalAlign: "-3px", background: c.ink, animation: "wkcaret 1s steps(2) infinite" } }))
          : open.body ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.95, color: c.ink, marginTop: 14, whiteSpace: "pre-wrap", fontStyle: voice ? "italic" : "normal" } }, voice ? noteSay(open.body) : open.body) : null,
        onPeek ? h("button", {
          onClick: () => onPeek({ tier: "quiet", label: voice ? T("他录的一条") : T("他的便签"), title: open.title, text: voice ? noteSay(open.body) : open.body }),
          className: "w-full active:opacity-60",
          style: { marginTop: 20, padding: "12px 0", borderRadius: 10, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid " + c.edge, color: c.ink }
        }, T("转发给 TA · 他会知道你翻了手机")) : null));
  })() : null;
  return h("div", { className: "h-full min-h-0 flex flex-col relative", "data-wk": "papp", "data-app": "notes", style: { background: STICKY_BG } },
    h(Head, { zh: "便签",
      bg: "transparent",
      noLine: true,
      ink: "#4a4438",
      onBack: onBack,
      right: h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: "#4a4438" })) }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 14px 26px" } },
      items.length
        ? h("div", { className: "grid grid-cols-2", style: { gap: 13, alignItems: "start" } },
            cols.map((col, ci) => h("div", { key: ci, style: { display: "flex", flexDirection: "column", gap: 13 } }, col)))
        : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#a09884" } }, "还没有便签，点右上角刷一次")),
    detail);
}
// ============================================================
// 剪贴板 —— 一叠复制过的纸条。最重要的不是内容，是【发没发出去】。
// 没发出去的那条单独一档：纸条压在最上面、红边、单独标出来。
// ============================================================
// ── 剪贴板：一叠纸条（v62.55 重做）──────────────────────────────────
// 注释里从来就写着「一叠纸条」，纸上却是暗底 + 圆角 12 的卡片 + 左边一道色边——
// 那是通用的深色列表，搬到任何一个 app 都成立（审美审计 2026-09-04 点名）。
//
// 剪贴板里躺的是【从别处撕下来的一片字】：TA复制了，有的发出去了，有的一直捏在手里。
// 所以每一条就长成一张纸条：纸色、方角（纸没有圆角）、微微歪着叠在桌上、
// 底边是撕口。没发出去的那几张多两样东西——别着一枚回形针，和一道折痕（捏皱过）。
//
// 撕口用 clipPath 画在一条独立的窄带上，坐标全是百分比：polygon 里塞 calc()
// 在老一点的 WebKit 上会整块静默失效，纸条就变成齐口的方块。
const CLIP_DESK = "#1c1d21";       // 桌面：夜里的书桌
const CLIP_PAPER = "#f2ece0";      // 纸条
const CLIP_PAPER2 = "#eae3d4";     // 压在下面那几张，暗一档
const CLIP_INK = "#2f2c26";        // 纸上的字
const CLIP_DIM = "#8b8477";        // 纸上的小字
const CLIP_HOT = "#b4483c";        // 回形针 / 没发出去的那一档
const CLIP_DESKINK = "rgba(240,238,232,.5)";
// 确定性的锯齿：同一张纸每次渲染撕口一样，不会刷一次变一个形状
const clipTorn = seed => {
  const N = 26, pts = ["0% 0%", "100% 0%"];
  for (let k = N; k >= 0; k--) {
    const r = Math.abs(Math.sin((k + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
    pts.push(((k / N) * 100).toFixed(2) + "% " + (30 + r * 70).toFixed(1) + "%");
  }
  return "polygon(" + pts.join(",") + ")";
};
// 回形针：程序画的，别用 📎——emoji 在她机器上会渲成豆腐块
function ClipPin({ color, size }) {
  const w = size || 24;
  return h("svg", { width: w, height: w * 1.35, viewBox: "0 0 24 32", "aria-hidden": "true", style: { display: "block", overflow: "visible" } },
    h("path", {
      d: "M17 7.5v13.8a5.8 5.8 0 0 1-11.6 0V6.8a3.7 3.7 0 0 1 7.4 0v14.2a1.8 1.8 0 0 1-3.6 0V8.4",
      fill: "none", stroke: color, strokeWidth: 2.1, strokeLinecap: "round", strokeLinejoin: "round"
    }));
}
function ClipView({ d, char, t, onBack, onRefresh, refreshing, onPeek, drive }) {
  const [open, setOpen] = useState(null);
  // ── 「看TA玩」驱动（第五批）：剪贴板只能看 ──
  const driveItem = drive && drive.item;
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setOpen(null); return; }
    const hit = watchOpenPick(Array.isArray(d && d.items) ? d.items : [], driveItem, x => x && x.text);
    if (hit) setOpen(hit);
  }, [driveItem]);
  const A = a => Array.isArray(a) ? a : [];
  const items = A((d && d.items)).filter(x => x && typeof x === "object");
  const held = items.filter(x => x.sent === false);
  const sent = items.filter(x => x.sent !== false);
  // 一张纸条。isHeld 的那几张：回形针 + 折痕 + 纸色亮一档（它在最上面）。
  const slip = (it, i, isHeld) => {
    const seed = i + (isHeld ? 3 : 11);
    const tilt = ((seed % 5) - 2) * 0.6;   // 叠不齐：-1.2° ~ +1.2°
    return h("div", { key: i, style: { position: "relative", marginBottom: isHeld ? 18 : 13, paddingTop: isHeld ? 8 : 0 } },
      h("button", {
        onClick: () => setOpen(it), "data-wk": "pitem", "data-watch": "item:" + String(it.text || "").slice(0, 24), className: "w-full text-left active:opacity-90",
        style: {
          position: "relative", display: "block", background: isHeld ? CLIP_PAPER : CLIP_PAPER2,
          borderRadius: 2, padding: "15px 16px 20px", transform: "rotate(" + tilt + "deg)",
          boxShadow: "0 1px 0 rgba(0,0,0,.22), 0 10px 18px -14px rgba(0,0,0,.9)"
        }
      },
        // 捏皱过的那一道折痕：只有没发出去的那几张才有
        // 捏皱过的折痕。⚠️横平、通到两边的一道会被读成【分隔线】而不是折痕
        // （第一版正好压在正文和落款之间，看着就是一条 hr）。所以斜着走、两头不到边、更淡。
        isHeld ? h("div", {
          "aria-hidden": "true",
          style: { position: "absolute", left: "7%", right: "11%", top: "46%", height: 1, background: "rgba(47,44,38,.075)", boxShadow: "0 1px 0 rgba(255,255,255,.5)", transform: "rotate(-1.4deg)" }
        }) : null,
        h("div", {
          style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.85, color: CLIP_INK, display: "-webkit-box", WebkitLineClamp: isHeld ? 4 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }
        }, PTX(it.text || "")),
        h("div", { className: "flex items-center", style: { gap: 8, marginTop: 11 } },
          it.from ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: CLIP_DIM } }, "从 " + it.from) : null,
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: CLIP_DIM } }, it.time || ""),
          h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: isHeld ? CLIP_HOT : CLIP_DIM } }, isHeld ? "没发出去" : "已发出")),
        // 撕口：贴在纸条底边的一条窄带，纸色一致，锯齿是 clipPath 切出来的
        h("div", {
          "aria-hidden": "true",
          style: {
            position: "absolute", left: 0, right: 0, bottom: -8, height: 9,
            background: isHeld ? CLIP_PAPER : CLIP_PAPER2, clipPath: clipTorn(seed), WebkitClipPath: clipTorn(seed)
          }
        })),
      // 回形针别在纸条左上角，一半探到纸外
      isHeld ? h("div", { "aria-hidden": "true", style: { position: "absolute", left: 15, top: 0, transform: "rotate(-11deg)", pointerEvents: "none" } },
        h(ClipPin, { color: CLIP_HOT, size: 21 })) : null);
  };
  // ── 详情：整页，不是半窗（no-half-sheet）────────────────────────────
  // 原来是从底下掀起来的半窗。这一层的内容是一整段TA复制下来的话，
  // 三行说不完，而且压根不需要同时看见底下那一列——按规矩就该是整页。
  // 整页之后还多了一件事能做：把这张纸条摊开成一整张纸铺满屏幕。
  const detail = open ? (function () {
    const isHeld = open.sent === false;
    return h("div", { "data-wk": "phoneapppage", "data-part": "clipview", className: "absolute inset-0 h-full min-h-0 flex flex-col", style: { background: CLIP_DESK, zIndex: 30 } },
      h(Head, { zh: isHeld ? "没发出去的那张" : "复制过的那张",
        bg: "transparent",
        noLine: true,
        ink: CLIP_DESKINK,
        onBack: () => setOpen(null) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "10px 18px 28px" } },
        h("div", { style: { position: "relative", paddingTop: 10 } },
          h("div", {
            style: {
              position: "relative", background: CLIP_PAPER, borderRadius: 2, padding: "24px 22px 34px",
              transform: "rotate(-0.35deg)", boxShadow: "0 1px 0 rgba(0,0,0,.22), 0 16px 26px -18px rgba(0,0,0,.9)"
            }
          },
            isHeld ? h("div", { "aria-hidden": "true", style: { position: "absolute", left: "6%", right: "13%", top: "38%", height: 1, background: "rgba(47,44,38,.075)", boxShadow: "0 1px 0 rgba(255,255,255,.5)", transform: "rotate(-1.1deg)" } }) : null,
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: isHeld ? CLIP_HOT : CLIP_DIM, marginBottom: 14 } },
              [open.from ? "从 " + open.from : "", open.time, isHeld ? "复制了，一直没发出去" : "已发出"].filter(Boolean).join(" · ")),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 2.05, color: CLIP_INK, whiteSpace: "pre-wrap" } }, PTX(open.text || "")),
            h("div", {
              "aria-hidden": "true",
              style: { position: "absolute", left: 0, right: 0, bottom: -8, height: 10, background: CLIP_PAPER, clipPath: clipTorn(2), WebkitClipPath: clipTorn(2) }
            })),
          isHeld ? h("div", { "aria-hidden": "true", style: { position: "absolute", left: 20, top: 0, transform: "rotate(-11deg)", pointerEvents: "none" } },
            h(ClipPin, { color: CLIP_HOT, size: 26 })) : null),
        onPeek ? h("button", {
          onClick: () => onPeek({ tier: isHeld ? "hidden" : "quiet", label: isHeld ? "剪贴板里没发出去的一段" : "剪贴板", title: open.from || "", text: open.text }),
          className: "w-full active:opacity-60",
          style: { marginTop: 26, padding: "13px 0", borderRadius: 2, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid " + (isHeld ? "rgba(180,72,60,.55)" : "rgba(240,238,232,.22)"), color: isHeld ? "#e0918a" : CLIP_DESKINK }
        }, isHeld ? T("摆到 TA 面前 · 这是他没发出去的") : T("转发给 TA · 他会知道你翻了手机")) : null));
  })() : null;
  // 分栏名不做成英文眉标：这一叠是什么，用中文说一句就够
  const sec = (title, list, isHeld) => list.length ? h("section", { key: title, style: { marginBottom: 22 } },
    h("div", { className: "flex items-center", style: { gap: 9, padding: "2px 2px 12px" } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: isHeld ? "#e0918a" : CLIP_DESKINK } }, title),
      h("span", { "aria-hidden": "true", style: { flex: 1, height: 1, background: "rgba(240,238,232,.13)" } }),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(240,238,232,.32)" } }, list.length + " 张")),
    list.map((x, i) => slip(x, i, isHeld))) : null;
  return h("div", { className: "h-full min-h-0 flex flex-col relative", "data-wk": "papp", "data-app": "clipboard", style: { background: CLIP_DESK } },
    h(Head, { zh: "剪贴板",
      bg: "transparent",
      noLine: true,
      ink: CLIP_DESKINK,
      onBack: onBack,
      right: h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: CLIP_DESKINK })) }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 18px 28px" } },
      items.length ? [sec("差一点就发出去", held, true), sec("复制过的", sent, false)]
        : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "rgba(240,238,232,.35)" } }, "剪贴板是空的")),
    detail);
}
// ============================================================
// 浏览器 —— 仿真浏览器（她 2026-08-29 点名）
// 四页：标签页 / 搜索 / 书签 / 无痕
// 这个 app 的两个爆点：
//   ① 一堆没关的标签页是这个人脑子的横截面——尤其那个开了很久、TA自己也说不清
//      为什么不关的；
//   ② 搜索词比访问过的网页更暴露人：人在搜索框里是不修饰的。
// 无痕那一页整个走 hidden 档：那是TA专门开了不留记录的。
// ============================================================
const BR_BG = "#f2f2f5";
const BR_INK = "#1c1c1e";
const BR_LINE = "#d9d9de";   // 标签条底下那道分隔线
const BR_DIM = "#8e8e93";
const BR_BLUE = "#2f6fdb";
const BR_COVERS = [["#cfd9e8", "#e6ecf5"], ["#e8d7cf", "#f4e9e3"], ["#d3e4d6", "#e8f1ea"],
  ["#e5dbef", "#f1ebf7"], ["#e9e3cc", "#f4f0e2"], ["#cfe3e8", "#e6f0f3"]];
// 能【搜出新东西】的那几个：进去就有一张空草稿，敲完回车先看见搜的那一句，再点进去。
// ⚠️她 2026-09-10 定的顺序（浏览器那次立的，小红书和视频照办）：
//   凭空冒出一页，看的人不知道TA为什么看见它。
const WATCH_SEARCH_APPS = ["browser", "liked", "bili", "shopping", "takeout"];
// 「看TA玩」里各屏找那一行时，认名字只走 PhoneWatch.sameName 一份规矩
// （挂点那头 watchFuzzy 用的也是它——两处各写一套就会圆点点着、页面却没开）。
const watchSame = (a, b) => (typeof window !== "undefined" && window.PhoneWatch && window.PhoneWatch.sameName)
  ? window.PhoneWatch.sameName(a, b) : (String(a == null ? "" : a) === String(b == null ? "" : b));
// 从一堆里挑出TA点的那一个。⚠️别用 find(watchSame)：两条都「像」的时候，
// 各屏按数据顺序挑、圆点按 DOM 顺序挑，挑出来的会是两条不同的东西
// （她 2026-09-10：「点开一个标题点进去又是另一个标题」）。pickName 先要完全一样的。
const watchPick = (list, name, get) => (typeof window !== "undefined" && window.PhoneWatch && window.PhoneWatch.pickName)
  ? window.PhoneWatch.pickName(list, name, get)
  : (Array.isArray(list) ? list : []).find(x => watchSame(get ? get(x) : x, name)) || null;
// ⚠️她 2026-09-11：「便签、浏览器、视频有时候还是不显示开了的页面」。
//   病根：模型点开的那个名字在这一屏的数据里**一条都对不上**（它自己编了个标题，
//   或者那条被上一次刷新顶掉了），于是各屏的 openItem effect 里 hit 是 null、
//   一个 setOpen 都没跑——屏幕停在列表上，后面「看了两眼又退出去」全落空。
//   点开这一下是【TA真的按下去了】，必须开出一页来：认不出名字就开这一屏的第一条。
//   ⚠️微信／短信／邮件不给这个兜底：开错人比不开更糟（在错的会话里打字）。
// ⚠️⚠️它必须住在【模块级】，跟 watchPick/watchSame 并排：用它的是二十来个各自独立的
//   组件（StickyView / BrowserView / BiliView…）。v67.04 我把它写进了 PhoneCarry 里面，
//   那几屏一渲染就是 ReferenceError —— 她那边整页白屏（「页面直接崩了」）。
const watchOpenPick = (list, name, get) =>
  watchPick(list, name, get) || (Array.isArray(list) && list.length ? list[0] : null);
const watchPageNode = (drive, skin) => (drive && drive.page && typeof window !== "undefined" && window.PhoneWatch)
  ? h(window.PhoneWatch.WatchPage, { page: drive.page, skin: skin }) : null;
function BrowserView({ d, char, t, onBack, onRefresh, refreshing, onPeek, drive }) {
  const [tab, setTab] = useState("tabs");
  const [open, setOpen] = useState(null);
  // ──「看TA玩」驱动：这是第一个【现编新内容】的 app——TA敲进搜索框、回车、点开一页。
  //   搜到的那一页当场就在这一屏上（drive.page），落盘另走 applyWrite。
  const driveTab = drive && drive.tab, driveItem = drive && drive.item, drivePage = drive && drive.page;
  useEffect(() => { if (drive && driveTab) { setTab(driveTab); setOpen(null); } }, [driveTab]);
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setOpen(null); return; }
    const arr2 = x => Array.isArray(x) ? x : [];
    const pool = [].concat(arr2(d && d.tabs), arr2(d && d.private), arr2(d && d.searches));
    const hit = watchOpenPick(pool, driveItem, x => x && x.title) || watchOpenPick(pool, driveItem, x => x && x.q);
    if (hit) setOpen(Object.assign({}, hit));
  }, [driveItem]);
  useEffect(() => { if (drive && drivePage) setOpen({ title: drivePage.title, site: drivePage.site, gist: drivePage.gist, _fresh: true }); }, [drivePage && drivePage.title]);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab]);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const me = (data.me && typeof data.me === "object") ? data.me : {};
  const tabs = A(data.tabs).filter(x => x && typeof x === "object");
  const searches = A(data.searches).filter(x => x && typeof x === "object");
  const marks = A(data.marks).filter(x => x && typeof x === "object");
  const priv = A(data.private).filter(x => x && typeof x === "object");
  const cov = n => BR_COVERS[(Number(n) || 0) % BR_COVERS.length];
  const peekBtn = (tier, label, title, text) => onPeek ? h("button", { "data-wk": "pbtn", "data-part": "peek",
    onClick: e => { e.stopPropagation(); onPeek({ tier, label, title, text }); },
    className: "w-full active:opacity-60",
    style: { marginTop: 18, padding: "12px 0", borderRadius: 12, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))",
      border: "1px solid " + (tier === "hidden" ? "rgba(200,80,70,.42)" : "#e2e2e7"), color: tier === "hidden" ? "#b6473c" : "#55555c" }
  }, tier === "hidden" ? T("摆到 TA 面前 · 这是他没打算留痕的") : T("转发给 TA · 他会知道你翻了手机")) : null;
  // ── 标签页：卡片网格，仿 Safari 那个标签墙 ──
  const tabCard = (x, i, isPriv) => h("button", {
    key: i, "data-wk": "pitem", "data-watch": "item:" + (x.title || ""), onClick: () => setOpen({ ...x, _priv: isPriv }), className: "text-left active:opacity-75",
    style: { background: isPriv ? "#26262b" : "#fff", borderRadius: 13, overflow: "hidden", minWidth: 0,
      border: x.pinned ? "1.5px solid " + BR_BLUE : "1px solid " + (isPriv ? "#33333a" : "#e8e8ed") }
  }, h("div", { style: { height: 84, position: "relative", background: isPriv ? "linear-gradient(150deg,#33333c,#22222a)" : "linear-gradient(150deg," + cov(x.cover != null ? x.cover : i)[0] + "," + cov(x.cover != null ? x.cover : i)[1] + ")" } },
    x.pinned ? h("span", { style: { position: "absolute", left: 7, top: 7, fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: "#fff", background: BR_BLUE, borderRadius: 5, padding: "2px 7px" } }, "钉住") : null,
    x.age ? h("span", { style: { position: "absolute", right: 7, bottom: 7, fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", color: isPriv ? "rgba(255,255,255,.7)" : "rgba(40,40,50,.6)", background: isPriv ? "rgba(0,0,0,.4)" : "rgba(255,255,255,.72)", borderRadius: 5, padding: "2px 7px" } }, x.age) : null),
  h("div", { style: { padding: "9px 10px 11px" } },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.5, color: isPriv ? "#e6e6ea" : BR_INK, display: "-webkit-box", WebkitLineClamp: phoneTextClamp(x.title, 2), WebkitBoxOrient: "vertical", overflow: "hidden" } }, PTX(x.title)),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: isPriv ? "rgba(230,230,234,.5)" : BR_DIM, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, PTX(x.site || ""))));
  const tabsPage = tabs.length
    ? h("div", { className: "grid grid-cols-2", style: { gap: 11, alignItems: "start" } }, tabs.map((x, i) => tabCard(x, i, false)))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: BR_DIM } }, "一个标签页都没开着");
  // ── 搜索记录：按时间列，搜索框的样子 ──
  const searchPage = searches.length ? h("div", { "data-wk": "block", style: { background: "#fff", borderRadius: 14, overflow: "hidden" } },
    searches.map((x, i) => h("button", {
      key: i, onClick: () => setOpen({ title: x.q, site: x.site, gist: "", _search: true, time: x.time, results: x.results, opened: x.opened }),
      // 搜索记录每一行也认名字：TA要是回头点开自己搜过的那一句，圆点落得下去
      "data-wk": "pitem", "data-watch": "item:" + (x.q || ""),
      className: "w-full text-left active:opacity-60 flex items-center",
      style: { gap: 11, padding: "13px 14px", borderTop: i ? "1px solid #f1f1f4" : "none" }
    }, h("span", { "aria-hidden": "true", style: { width: 26, height: 26, borderRadius: 99, flexShrink: 0, background: "#f0f0f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "calc(12px * var(--app-fs, 1))", color: BR_DIM } }, "⌕"),
    h("div", { className: "flex-1 min-w-0" },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.5, color: BR_INK, wordBreak: "break-word" } }, PTX(x.q)),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: BR_DIM, marginTop: 4 } }, [x.time, x.site].filter(Boolean).join(" · "))))))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: BR_DIM } }, "没有搜索记录");
  // ── 书签：文件夹分组 ──
  const markPage = marks.length ? h("div", null, marks.map((f, i) => h("div", { key: i, style: { marginBottom: 14 } },
    h("div", { className: "flex items-center", style: { gap: 7, padding: "2px 4px 9px" } },
      h("span", { "aria-hidden": "true", style: { width: 15, height: 12, borderRadius: "2px 4px 4px 4px", background: "#f0c264", flexShrink: 0 } }),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: BR_INK } }, PTX(f.name || "")),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: BR_DIM } }, A(f.items).length + " 条")),
    h("div", { "data-wk": "block", style: { background: "#fff", borderRadius: 14, overflow: "hidden" } },
      A(f.items).map((x, j) => h("button", {
        key: j, "data-wk": "pitem", "data-watch": "item:" + (x.title || ""), onClick: () => setOpen({ ...x, _mark: f.name }),
        className: "w-full text-left active:opacity-60",
        style: { padding: "12px 14px", borderTop: j ? "1px solid #f1f1f4" : "none" }
      }, h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.5, color: BR_INK } }, PTX(x.title)),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: BR_DIM, marginTop: 4 } }, PTX(x.site || ""))))))))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: BR_DIM } }, "还没有书签");
  const privPage = h("div", null,
    h("div", { "data-wk": "block", style: { background: "#26262b", borderRadius: 14, padding: "15px 16px", marginBottom: 14 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: "#e6e6ea" } }, "无痕浏览"),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.7, color: "rgba(230,230,234,.55)", marginTop: 6 } }, T("他专门开了不留记录的那几页。关掉就没了——只是还没关。"))),
    priv.length ? h("div", { className: "grid grid-cols-2", style: { gap: 11, alignItems: "start" } }, priv.map((x, i) => tabCard(x, i, true)))
      : h("div", { style: { padding: "44px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: BR_DIM } }, "这会儿没有无痕页"));
  // 搜索记录点进去 = 那一次搜索的【结果页】。
  // 「搜了什么」只有一半；另一半是【TA点开了哪一条】——那才是TA真正想知道的东西。
  const searchPage2 = open && open._search ? (function () {
    const rs = A(open.results).filter(x => x && typeof x === "object");
    // 结果数不问模型要：拿搜索词算一个稳定的数，每次进来都一样。
    // 它只是页面上的装饰，不该为它多花一次调用，更不该每次刷新跳一个数。
    const total = 12000 + phoneStableHash(open.title || "") % 880000;
    const shown = total.toLocaleString("en-US");
    return h("div", { className: "absolute inset-0 flex flex-col", style: { background: "#fff", zIndex: 30 } },
      h("div", { "data-wk": "head", className: "shrink-0", style: { paddingTop: safeTop(8), borderBottom: "1px solid #ececf0" } },
        h("div", { className: "flex items-start px-3 pb-3", style: { gap: 6 } },
          h("button", { onClick: () => setOpen(null), "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center shrink-0", style: { width: 40, height: 40, marginTop: -4 } }, h(IArrow, { size: 19, color: BR_INK })),
          h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", lineHeight: 1.45, color: BR_INK, wordBreak: "break-word", paddingTop: 4, paddingRight: 8 } }, PTX(open.title)))),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: COMPOSER_PAD_BOTTOM, background: "#fafafc" } },
        h("div", { className: "flex items-center", style: { gap: 11, padding: "20px 0 10px" } },
          h("span", { "aria-hidden": "true", style: { fontSize: "calc(17px * var(--app-fs, 1))", color: BR_DIM } }, "⌕"),
          h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: BR_INK, wordBreak: "break-word" } }, PTX(open.title))),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#a8a8b0", paddingBottom: 16, borderBottom: "1px solid #ececf0" } },
          "找到约 " + shown + " 条结果" + (open.time ? "　|　搜索于 " + open.time : "")),
        rs.length ? rs.map((r, i) => {
          const src = String(r.source || "").trim();
          const isOpened = !!r.opened || (open.opened && String(open.opened) === src);
          return h("div", { key: i, style: { padding: "18px 0", borderBottom: i === rs.length - 1 ? "none" : "1px solid #ececf0" } },
            h("div", { className: "flex items-center", style: { gap: 9, marginBottom: 8 } },
              h("span", {
                "aria-hidden": "true",
                style: { width: 22, height: 22, borderRadius: 99, flexShrink: 0, background: "#efeff3", color: "#7a7a84", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))" }
              }, src.slice(0, 1) || "?"),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#6b6b74", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, src),
              isOpened ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#c4553f", background: "rgba(196,85,63,.1)", borderRadius: 99, padding: "2px 8px", flexShrink: 0 } }, T("他点开了这条")) : null),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", lineHeight: 1.45, color: "#1a4fbd", wordBreak: "break-word" } }, PTX(r.title)),
            r.excerpt ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.8, color: "#8b8b93", marginTop: 7, wordBreak: "break-word" } }, PTX(r.excerpt)) : null);
        }) : h("div", { style: { padding: "50px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: BR_DIM, lineHeight: 1.9 } },
          "这条搜索记录里没存下结果。\n重新推演一次浏览器就有了。"),
        h("div", { style: { paddingTop: 18 } },
          peekBtn("quiet", T("他搜过的"), open.title,
            [open.time, rs.length ? T("他翻到的：") + rs.map(r => String(r.title || "")).filter(Boolean).slice(0, 3).join(" / ") : ""].filter(Boolean).join("｜")))));
  })() : null;
  const detail = open && !open._search ? (function () {
    const isPriv = !!open._priv;
    const ink = isPriv ? "#e6e6ea" : BR_INK, dim = isPriv ? "rgba(230,230,234,.5)" : BR_DIM;
    return h(PhoneSubPage, {
      bg: { background: isPriv ? "#1c1c20" : BR_BG }, ink: ink,
      title: isPriv ? "无痕" : (open._mark ? "书签" : "标签页"), onClose: () => setOpen(null)
    },
      // 地址栏照旧摆在最上面——那是浏览器最认得出的一件东西
      h("div", { className: "flex items-center", style: { gap: 8, height: 34, borderRadius: 10, background: isPriv ? "#33333a" : "#f0f0f4", padding: "0 12px" } },
        // 🔒 是 emoji，在她机器上会渲成豆腐块；换成程序画的锁
        h("svg", { width: 11, height: 13, viewBox: "0 0 11 13", "aria-hidden": "true", style: { flexShrink: 0 } },
          h("rect", { x: 0.9, y: 5.2, width: 9.2, height: 7.1, rx: 1.4, fill: dim }),
          h("path", { d: "M3.1 5.2V3.6a2.4 2.4 0 0 1 4.8 0v1.6", fill: "none", stroke: dim, strokeWidth: 1.3 })),
        h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: isPriv ? "rgba(230,230,234,.7)" : "#55555c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, PTX(open.site || ""))),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", lineHeight: 1.5, color: ink, marginTop: 18, wordBreak: "break-word" } }, PTX(open.title || "")),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: dim, marginTop: 8 } },
        [open.time, open.age, open._mark ? "书签 · " + open._mark : "", open.pinned ? "钉住的" : ""].filter(Boolean).join(" · ")),
      open.gist ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.95, color: isPriv ? "rgba(230,230,234,.86)" : "#4b4b53", marginTop: 15 } }, PTX(open.gist)) : null,
      peekBtn(isPriv ? "hidden" : "quiet",
        isPriv ? T("他的无痕标签页") : open._mark ? T("他的书签") : T("他没关的标签页"),
        open.title, [open.site, open.gist, open.age].filter(Boolean).join("｜")));
  })() : null;
  const PAGES = [
    { key: "tabs", zh: "标签页", glyph: "browser", body: tabsPage, badge: tabs.length },
    { key: "search", zh: "搜索", glyph: "notes", body: searchPage, badge: searches.length },
    { key: "marks", zh: "书签", glyph: "reading", body: markPage },
    { key: "priv", zh: "无痕", glyph: "latenight", body: privPage, badge: priv.length }
  ];
  const page = PAGES.find(x => x.key === tab) || PAGES[0];
  return h("div", { className: "h-full min-h-0 flex flex-col relative", "data-wk": "papp", "data-app": "browser", style: { background: BR_BG } },
    h("div", { "data-wk": "head", className: "shrink-0", style: { paddingTop: safeTop(10) } },
      h("div", { className: "flex items-center px-3 pb-2", style: { gap: 9 } },
        h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center shrink-0", style: { width: 36, height: 36 } }, h(IArrow, { size: 18, color: BR_INK })),
        // 地址栏：真浏览器的样子
        h("div", { className: "flex-1 min-w-0 flex items-center", style: { gap: 7, height: 34, borderRadius: 11, background: "#e6e6ea", padding: "0 12px" } },
          h("span", { "aria-hidden": "true", style: { fontSize: "calc(10.5px * var(--app-fs, 1))", color: BR_DIM } }, "🔒"),
          // ⚠️TA敲搜索框那一下必须看得见——这一路的戏就在「敲进去、又退回来」上。
          drive && drive.typing != null
            ? h("span", { "data-wk": "pinput", "data-watch": "input", style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: BR_INK, overflow: "hidden", whiteSpace: "nowrap" } },
                drive.typing,
                h("span", { "aria-hidden": "true", style: { display: "inline-block", width: 1.5, height: 13, marginLeft: 1, verticalAlign: "-2px", background: BR_BLUE, animation: "wkcaret 1s steps(2) infinite" } }))
            : h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#55555c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                me.name ? me.name + (me.uid ? " · " + me.uid : "") : (char.remark || char.name) + " 的浏览器")),
        h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center shrink-0", style: { width: 36, height: 36 } }, h(IRefresh, { size: 17, color: BR_INK }))),
      // ── 四页＝浏览器的标签条（tabs-not-plain-pills）──────────────────
      //   原来是四颗白药丸分段：那是 iOS 的通用控件，搬到任何 app 里都成立。
      //   标签条不一样：上圆下方、贴着页边，选中那张【跟底下的页面连成一片】
      //   （压住那条分隔线），没选的缩一截、暗着，压在线后头。
      h("div", { className: "flex px-3", style: { gap: 3, borderBottom: "1px solid " + BR_LINE } }, PAGES.map(pg => {
        const on = tab === pg.key;
        return h("button", {
          key: pg.key, "data-wk": "ptab", "data-on": tab === pg.key ? "1" : "0", "data-watch": "tab:" + pg.key, onClick: () => { setTab(pg.key); setOpen(null); }, className: "flex-1 active:opacity-70",
          style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", padding: on ? "9px 4px 8px" : "11px 4px 6px",
            borderRadius: "10px 10px 0 0", marginBottom: -1,
            background: on ? BR_BG : "transparent",
            border: on ? "1px solid " + BR_LINE : "1px solid transparent",
            borderBottomColor: on ? BR_BG : "transparent",
            color: on ? (pg.key === "priv" ? "#b6473c" : BR_INK) : BR_DIM }
        }, pg.zh + (pg.badge ? " " + pg.badge : ""));
      })) ),
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 13px 22px" } }, PTX(page.body)),
    searchPage2, detail,
    // ── TA刚搜出来点进去的那一页（「看TA玩」专属）──────────────────────
    //   这一页在TA手机里本来不存在——是这一段里现编出来的。落盘另走 applyWrite：
    //   搜的那句进 searches（📚 累积），打开的这一页顶到 tabs 最前面（♻️ 快照）。
    // ⚠️这一页原来是这儿手写的一份。第四批要在购物／外卖／小红书上摆同一张，
    //   于是搬进 PhoneWatch.WatchPage 一处，这儿也跟着改用它（不是只开公共的、
    //   旧的留在原地——那样反而多一处要同步，施工规则/one-public-mechanism.md）。
    watchPageNode(drive, { bg: "#fff", ink: BR_INK, dim: BR_DIM, line: BR_LINE }));
}
// ============================================================
// 电话 —— 通话 / 短信 / 信箱 / 联系人（她 2026-08-29 拍板留下并重做）
// 这个 app 真正有东西的是【没接通的那些】：谁打来TA不接、TA打给谁一直打不通、
// 深夜那通只有几十秒的。每一条都带TA自己的想法。
// 短信单独一页，而且和微信收发的东西**完全不是一回事**——那条分界写在提示词里，
// 界面上也用「通知/人」两种样式把它显出来。
// ============================================================
const CALL_BG = "#f2f2f7";
const CALL_INK = "#1c1c1e";
const CALL_DIM = "#8e8e93";
const CALL_BLUE = "#0a84ff";
const CALL_LINE = "#d9d9de";
// 底下那条栏的四个图标：一页一个，程序画的——不用 Unicode 方块当图标
// （mobile-ui-layout.md §2 最后一条）。
function callGlyph(kind, color) {
  const P = { fill: "none", stroke: color, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  const wrap = kids => h("svg", { width: 21, height: 21, viewBox: "0 0 24 24", "aria-hidden": "true" }, kids);
  if (kind === "calls") return wrap(h("path", Object.assign({ key: "a",
    d: "M6.5 3.5h3l1.3 3.4-2 1.5a12 12 0 0 0 6.8 6.8l1.5-2 3.4 1.3v3a1.8 1.8 0 0 1-2 1.8C11.4 18.7 5.3 12.6 4.7 5.5a1.8 1.8 0 0 1 1.8-2z" }, P)));
  if (kind === "sms") return wrap(h("path", Object.assign({ key: "a",
    d: "M4.5 6.4A2 2 0 0 1 6.5 4.4h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-4 3.2v-3.2h.5a2 2 0 0 1-2-2z" }, P)));
  if (kind === "vm") return wrap([h("circle", Object.assign({ key: "a", cx: 6.6, cy: 14, r: 3.4 }, P)),
    h("circle", Object.assign({ key: "b", cx: 17.4, cy: 14, r: 3.4 }, P)),
    h("path", Object.assign({ key: "c", d: "M6.6 17.4h10.8" }, P))]);
  return wrap([h("circle", Object.assign({ key: "a", cx: 12, cy: 8.4, r: 3.4 }, P)),
    h("path", Object.assign({ key: "b", d: "M5.4 19.2c0-3.4 3-5.6 6.6-5.6s6.6 2.2 6.6 5.6" }, P))]);
}
const CALL_RED = "#ff3b30";
function PhoneCallsView({ d, char, t, onBack, onRefresh, refreshing, onPeek, drive }) {
  const [tab, setTab] = useState("calls");
  const [open, setOpen] = useState(null);
  // ── 「看TA玩」驱动（第五批）。drive 不在时这一屏一个像素都没变 ──
  const driveTab = drive && drive.tab, driveItem = drive && drive.item;
  useEffect(() => { if (drive && driveTab) { setTab(driveTab); setOpen(null); } }, [driveTab]);
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setOpen(null); return; }
    const A0 = a => Array.isArray(a) ? a : [];
    const want = String(driveItem);
    const sm = watchPick(A0(d && d.sms), want, x => x && x.name) || A0(d && d.sms).find(x => x && String(x.number || "") === want);
    if (sm) { setOpen({ kind: "sms", x: sm }); return; }
    const cl = watchPick(A0(d && d.calls), want, x => x && x.name) || A0(d && d.calls).find(x => x && String(x.number || "") === want);
    if (cl) { setOpen({ kind: "call", x: cl }); return; }
    const v = watchPick(A0(d && d.voicemail), want, x => x && x.from);
    if (v) setOpen({ kind: "vm", x: v });
  }, [driveItem]);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab]);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const me = (data.me && typeof data.me === "object") ? data.me : {};
  const calls = A(data.calls).filter(x => x && typeof x === "object");
  const sms = A(data.sms).filter(x => x && typeof x === "object");
  const vm = A(data.voicemail).filter(x => x && typeof x === "object");
  const freq = A(data.frequent).filter(x => x && typeof x === "object");
  const blocked = A(data.blocked).filter(x => x && typeof x === "object");
  const missedN = calls.filter(x => x.answered === false).length;
  const unheardN = vm.filter(x => x.heard === false).length;
  const unreadN = sms.filter(x => x.unread).length;
  const peekBtn = (tier, label, title, text) => onPeek ? h("button", { "data-wk": "pbtn", "data-part": "peek",
    onClick: e => { e.stopPropagation(); onPeek({ tier, label, title, text }); },
    className: "w-full active:opacity-60",
    style: { marginTop: 18, padding: "12px 0", borderRadius: 12, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))",
      border: "1px solid " + (tier === "hidden" ? "rgba(200,80,70,.42)" : "#e2e2e7"), color: tier === "hidden" ? "#b6473c" : "#55555c" }
  }, tier === "hidden" ? T("摆到 TA 面前 · 这是他藏起来的") : T("转发给 TA · 他会知道你翻了手机")) : null;
  const groupCard = kids => h("div", { "data-wk": "block", style: { background: "#fff", borderRadius: 14, overflow: "hidden" } }, kids);
  const secLabel = txt => h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: CALL_DIM, padding: "14px 4px 8px" } }, txt);
  // ── 通话记录：iOS 那种列表，未接标红 ──
  const callRow = (x, i) => {
    const missed = x.answered === false;
    const isIn = x.dir === "in";
    return h("button", {
      key: i, onClick: () => setOpen({ kind: "call", x: x }), "data-wk": "pitem", "data-watch": "item:" + (x.name || x.number || ""),
      className: "w-full text-left active:opacity-60 flex items-center",
      style: { gap: 12, padding: "12px 14px", borderTop: i ? "1px solid #f1f1f4" : "none" }
    }, h("span", { "aria-hidden": "true", style: { width: 26, flexShrink: 0, textAlign: "center", fontSize: "calc(15px * var(--app-fs, 1))", color: missed ? CALL_RED : CALL_DIM } }, isIn ? "↙" : "↗"),
    h("div", { className: "flex-1 min-w-0" },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: missed ? CALL_RED : CALL_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.name || x.number || "陌生号码"),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: CALL_DIM, marginTop: 3 } },
        [isIn ? "来电" : "拨出", missed ? "未接通" : (x.duration || "")].filter(Boolean).join(" · "))),
    h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: CALL_DIM } }, x.time || ""));
  };
  const callsPage = calls.length ? h("div", null,
    missedN ? h("div", { "data-wk": "block", style: { background: "rgba(255,59,48,.08)", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#c0392b" } },
      "这周有 " + missedN + " 通没接通") : null,
    groupCard(calls.map(callRow)))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: CALL_DIM } }, "没有通话记录");
  // ── 短信：通知类和人分开画 ──
  const smsRow = (x, i) => {
    const isNotice = x.kind !== "人";
    return h("button", {
      key: i, onClick: () => setOpen({ kind: "sms", x: x }), "data-wk": "pitem", "data-watch": "item:" + (x.name || x.number || ""),
      className: "w-full text-left active:opacity-60 flex items-start",
      style: { gap: 11, padding: "13px 14px", borderTop: i ? "1px solid #f1f1f4" : "none" }
    }, h("div", { style: { width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      background: isNotice ? "#eef0f4" : "#dcefe4", color: isNotice ? "#7b828c" : "#3f7a58", fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))" } },
      isNotice ? "#" : String(x.name || "?").trim().slice(0, 1)),
    h("div", { className: "flex-1 min-w-0" },
      h("div", { className: "flex items-center", style: { gap: 6 } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: CALL_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.name || x.number || ""),
        x.unread ? h("span", { style: { width: 7, height: 7, borderRadius: 99, background: CALL_BLUE, flexShrink: 0 } }) : null),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, color: CALL_DIM, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } },
        ((A(x.msgs)[A(x.msgs).length - 1] || {}).text) || "")),
    h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: CALL_DIM } }, x.time || ""));
  };
  const smsPage = sms.length ? h("div", null,
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.7, color: CALL_DIM, padding: "2px 4px 11px" } },
      "短信里多半不是人——验证码、账目、催缴、送货、骗子。熟人出现在这儿，总有个理由。"),
    groupCard(sms.map(smsRow)))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: CALL_DIM } }, "没有短信");
  // ── 语音信箱 ──
  const vmPage = vm.length ? h("div", null,
    unheardN ? h("div", { "data-wk": "block", style: { background: "rgba(10,132,255,.08)", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#1a5fb4" } },
      "有 " + unheardN + T(" 条他一直没听")) : null,
    vm.map((x, i) => h("button", {
      key: i, onClick: () => setOpen({ kind: "vm", x: x }),
      className: "w-full text-left active:opacity-60",
      style: { background: "#fff", borderRadius: 14, padding: "15px 16px", marginBottom: 10, borderLeft: x.heard === false ? "3px solid " + CALL_BLUE : "3px solid transparent" }
    }, h("div", { className: "flex items-center justify-between", style: { gap: 10 } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: CALL_INK } }, PTX(x.from || "")),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: CALL_DIM } }, [x.time, x.duration].filter(Boolean).join(" · "))),
    x.transcript ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.8, color: "#5b5b62", marginTop: 8, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } }, PTX(x.transcript)) : null,
    x.heard === false ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: CALL_BLUE, marginTop: 8 } }, "未听") : null)))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: CALL_DIM } }, "信箱是空的");
  // ── 联系人 + 拦截 ──
  const peoplePage = h("div", null,
    me.number ? h("div", { "data-wk": "block", style: { background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 14 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: CALL_DIM } }, T("他的号码")),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: CALL_INK, marginTop: 5 } }, me.number)) : null,
    freq.length ? h("div", null, secLabel("常联系"),
      groupCard(freq.map((x, i) => h("div", { key: i, style: { padding: "13px 14px", borderTop: i ? "1px solid #f1f1f4" : "none" } },
        h("div", { className: "flex items-baseline justify-between", style: { gap: 10 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: CALL_INK } }, PTX(x.name || "")),
          x.count != null ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: CALL_DIM } }, x.count + " 通") : null),
        x.why ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.7, color: CALL_DIM, marginTop: 5 } }, PTX(x.why)) : null)))) : null,
    blocked.length ? h("div", null, secLabel("拦截名单"),
      groupCard(blocked.map((x, i) => h("div", { key: i, style: { padding: "13px 14px", borderTop: i ? "1px solid #f1f1f4" : "none" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", color: CALL_INK } }, PTX(x.name || "")),
        x.why ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.7, color: "#b6473c", marginTop: 5 } }, PTX(x.why)) : null))),
      onPeek ? peekBtn("hidden", T("他的拦截名单"), T("他拉黑了谁"), blocked.map(x => (x.name || "") + "：" + (x.why || "")).join("｜")) : null) : null,
    (!freq.length && !blocked.length && !me.number)
      ? h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: CALL_DIM } }, "还没有联系人") : null);
  // ── 详情 ──
  // ⚠️跟微信那一屏同一件事：open.x 是【点开那一刻的那一行】，一张快照。
  //   TA发出去的那条落进 x_phone 之后这张快照不会跟着长——去重也就无从比起。
  //   所以每一帧按名字把它认回来（认名字走公共那条）。
  const liveSms = (open && open.kind === "sms")
    ? (watchPick(A(d && d.sms), (open.x || {}).name, x => x && x.name) || open.x || {}) : null;
  // 演到一半就该看见：TA刚发出去的那条先挂在气泡串上（落盘另走 applyWrite）
  // 同上：这一行也得走公共那份，不然短信点开了、TA打的字和发出去的气泡却不出现
  const driveOn = !!(drive && open && open.kind === "sms" && drive.item
    && (watchSame((open.x || {}).name, drive.item) || String((open.x || {}).number || "") === String(drive.item)));
  const driveSent0 = driveOn ? A(drive.sent) : [];
  const driveSent = (typeof window !== "undefined" && window.PhoneWatch && window.PhoneWatch.dropEchoBubbles)
    ? window.PhoneWatch.dropEchoBubbles((liveSms || {}).msgs, driveSent0) : driveSent0;
  const driveTyping = (driveOn && drive.typing != null) ? String(drive.typing || "") : null;
  const detail = open ? (function () {
    const x = (open.kind === "sms" ? (liveSms || open.x) : open.x) || {};
    const isCall = open.kind === "call", isSms = open.kind === "sms", isVm = open.kind === "vm";
    const missed = isCall && x.answered === false;
    return h(PhoneSubPage, {
      bg: { background: CALL_BG }, ink: CALL_INK,
      title: isCall ? "通话" : isSms ? "短信" : "留言", onClose: () => setOpen(null)
    },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", lineHeight: 1.35, color: missed ? CALL_RED : CALL_INK } }, x.name || x.from || x.number || "陌生号码"),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: CALL_DIM, marginTop: 5 } },
        [x.number, x.time, isCall ? (missed ? "未接通" : (x.dir === "in" ? "来电 " : "拨出 ") + (x.duration || "")) : "", isVm ? x.duration : "", isSms ? (x.kind === "人" ? "短信 · 人" : "短信 · 通知") : ""].filter(Boolean).join(" · ")),
      // 短信：气泡串。收到的靠左灰、TA发的靠右蓝
      isSms ? h("div", { "data-watch": "thread", style: { marginTop: 16 } }, A(x.msgs).concat(driveSent).map((m2, j) => {
        const mine = m2.from === "me";
        return h("div", { key: j, className: "flex", style: { justifyContent: mine ? "flex-end" : "flex-start", marginTop: j ? 9 : 0 } },
          h("div", { style: { maxWidth: "78%", borderRadius: 15, padding: "10px 13px", background: mine ? CALL_BLUE : "#eeeef2", color: mine ? "#fff" : CALL_INK, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.7, whiteSpace: "pre-wrap" } }, PTX(m2.text || "")));
      })) : null,
      isVm && x.transcript ? h("div", { "data-wk": "block", style: { marginTop: 16, background: "#f5f5f8", borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: CALL_DIM } }, "留言转文字" + (x.heard === false ? T(" · 他一直没听") : "")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.95, color: "#3f3f47", marginTop: 8, fontStyle: "italic", whiteSpace: "pre-wrap" } }, PTX(x.transcript))) : null,
      isCall && x.gist ? h("div", { style: { marginTop: 16, fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.9, color: "#4b4b53" } }, PTX(x.gist)) : null,
      x.thought ? h("div", { style: { marginTop: 14, borderLeft: "3px solid " + (missed ? CALL_RED : "#c9c9d1"), paddingLeft: 12, fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.9, color: CALL_INK } }, PTX(x.thought)) : null,
      // ── 打字条：只有「看TA玩」演到打字那一下才出现（drive 不在时压根不画）──
      driveTyping != null ? h("div", { "data-wk": "pinput", "data-watch": "input", className: "flex items-end", style: { gap: 8, marginTop: 16, padding: "8px 10px", background: "#f5f5f8", borderRadius: 14 } },
        h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.6, color: CALL_INK, minHeight: 20 } },
          driveTyping || h("span", { style: { color: "#bbb" } }, "\u00a0"),
          h("span", { style: { display: "inline-block", width: 1.5, height: 15, background: CALL_BLUE, marginLeft: 1, verticalAlign: "-2px", animation: "wkcaret 1s steps(1) infinite" } })),
        h("div", { "data-wk": "pbtn", "data-part": "send", "data-watch": "send", style: { flexShrink: 0, borderRadius: 999, padding: "7px 14px", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: driveTyping ? "#fff" : "#9a9a9a", background: driveTyping ? CALL_BLUE : "#e6e6ea" } }, "发送")) : null,
      peekBtn("quiet",
        isCall ? (missed ? T("他没接的一通电话") : T("他的通话记录")) : isSms ? T("他收到的短信") : T("有人给他留的言"),
        x.name || x.from || x.number,
        [isCall ? (missed ? "没接通" : x.duration) : "", x.gist, x.transcript, A(x.msgs).map(m2 => m2.text).join(" / "), x.thought].filter(Boolean).join("｜")));
  })() : null;
  const PAGES = [
    { key: "calls", zh: "通话", body: callsPage, badge: missedN },
    { key: "sms", zh: "短信", body: smsPage, badge: unreadN },
    { key: "vm", zh: "信箱", body: vmPage, badge: unheardN },
    { key: "people", zh: "联系人", body: peoplePage }
  ];
  const page = PAGES.find(x => x.key === tab) || PAGES[0];
  return h("div", { className: "h-full min-h-0 flex flex-col relative", "data-wk": "papp", "data-app": "calls", style: { background: CALL_BG } },
    h(Head, { zh: page.zh, bg: "transparent", noLine: true, ink: CALL_INK, onBack,
      right: h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40, marginRight: -8 } }, h(IRefresh, { size: 18, color: CALL_INK })) }),
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 14px 22px" } }, PTX(page.body)),
    // ── 四页＝电话 app 底下那条图标栏（tabs-not-plain-pills）──────────
    //   原来是顶上四颗白药丸：那是 iOS 的通用分段控件，搬到任何 app 里都成立。
    //   真的电话 app 把这四页放在【底下】，一页一个图标，选中那个整个上色。
    //   位置、形状、颜色三样一起变——不是只换个填色（第 2 条：说得清）。
    h("div", { className: "shrink-0 flex", style: { borderTop: "1px solid " + CALL_LINE, background: "rgba(255,255,255,.72)" } },
      PAGES.map(pg => {
        const on = tab === pg.key;
        return h("button", {
          key: pg.key, onClick: () => { setTab(pg.key); setOpen(null); }, "data-wk": "ptab", "data-on": tab === pg.key ? "1" : "0", "data-watch": "tab:" + pg.key,
          className: "flex-1 flex flex-col items-center justify-center active:opacity-60",
          style: { padding: "7px 0 6px", minHeight: 48, position: "relative" }
        },
          callGlyph(pg.key, on ? CALL_BLUE : CALL_DIM),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", marginTop: 3, color: on ? CALL_BLUE : CALL_DIM } }, pg.zh),
          pg.badge ? h("span", { style: { position: "absolute", top: 4, left: "50%", marginLeft: 6, minWidth: 15, height: 15,
            borderRadius: 999, background: "#ff3b30", color: "#fff", fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" } }, pg.badge) : null);
      })),
    detail);
}
// ─────────────────────────────────────────────────────────────
// 歌单：一张碟的曲目单（v59.66）
// ─────────────────────────────────────────────────────────────
// 她 2026-09-01：「歌单 ui 现在也还是普普通通的」。
// 原来是【一排小方图 + 歌名 + 歌手】——任何音乐 app 都长这样，
// 按 施工规则/tabs-not-plain-pills.md 那条判据（换个 app 照样成立就是写坏了）
// 就是没设计。而且那排 34px 的灰方块正是「哪个音乐 app 都有」的那一样东西。
// 这一页真正独有的是 note：**TA为什么循环这一首**。所以照【碟的曲目单】来做：
// 顶上一张真的碟（纹路是程序画的，不烧生图额度），底下曲目一行行，
// note 是写在曲目边上的那一行小字。
// 歌单是查手机里【唯一一个没穿自己皮】的内层 app（审美审计 2026-09-04）：
// 碟画得很好，可它一直躺在【她的】t.bg 上——别的十八个 app 都有自己的底，就它没有。
// 这一版给它一间【夜里的听歌房】：暖近黑的底、一盏灯的余晖、黄铜色的那一笔。
// ⚠️不重写这个组件的结构，只把它取色的那个 t 换掉——碟、曲目单、心境那一行
//   本来就是合格的，动它们纯属把好东西改坏。
const MUSIC_SKIN = {
  bg: "#1d1a17", bg2: "#241f1b", ink: "#efe9dd",
  fog: "rgba(239,233,221,.45)", sub: "rgba(239,233,221,.66)",
  line: "rgba(239,233,221,.13)", tint: "#c8a06a", accent: "#c8a06a"
};
function MusicView({ pl, char, t: appT, onGen, busy, onPlay, onPeek, onBack, drive, nowSongId }) {
  // 这一页从这儿往下都用听歌房那套色，不用她的主题色
  const t = MUSIC_SKIN;
  const [open, setOpen] = useState(null);
  const A = a => Array.isArray(a) ? a : [];
  // ──「看TA玩」驱动：音乐这一路跟别的都不一样——歌单是【真数据】（listen.playlists），
  //   不在 x_phone 里，所以TA点一首歌就是【真的放出来】，不是演一下。
  //   ⚠️也因此这一路不落 x_phone：applyWrite 里压根没有 music 分支，写的是播放器状态。
  // ⚠️「正在放的是哪一首」是播放器说了算，这一屏跟着它走（她 2026-09-10：
  //   「就算播放的是其他歌也不会变」）。她手动点开别的那一行时，以她点的为准——
  //   所以只在【换歌了】那一下跟过去。
  useEffect(() => { if (nowSongId) setOpen(nowSongId); }, [nowSongId]);
  const driveItem = drive && drive.item;
  useEffect(() => {
    if (!drive || !driveItem) return;
    const list = A(pl && pl.songs).filter(x => x && typeof x === "object");
    const row0 = watchOpenPick(list, driveItem, x => x && x.title);
    const i = row0 ? list.indexOf(row0) : -1;
    if (i < 0) return;
    // ⚠️open 存的是【那一行的 key】，不是歌对象——照这一屏自己的写法来（key = id 或 "s"+下标）
    setOpen(list[i].id || ("s" + i));
    if (onPlay) onPlay(list[i]);
  }, [driveItem]);
  // String({}) 会变成 [object Object] 印在曲目单上——模型偶尔把一栏写成对象
  const S = v => (v == null || typeof v === "object") ? "" : String(v).trim();
  // 模型/存档里偶尔混进 null 或字符串；不滤掉的话下一行 x.cover 当场抛
  const songs = A(pl && pl.songs).filter(x => x && typeof x === "object");
  const shell = (kids, pad) => h("div", { className: "h-full min-h-0 flex flex-col", "data-wk": "papp", "data-app": "music", style: {
    // 一盏灯从左上打下来：底纹铺在【最外那层外壳】上，不跟着内容滚
    background: MUSIC_SKIN.bg,
    backgroundImage: "radial-gradient(120% 70% at 18% -6%, rgba(200,160,106,.13), transparent 62%)"
  } },
    h(Head, { zh: "歌单",
      bg: "transparent",
      noLine: true,
      onBack: onBack,
      right: onGen ? h("button", { onClick: () => onGen(), disabled: !!busy, "aria-label": "重出一张", className: "active:opacity-60 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: t.ink })) : h("div", { style: { width: 40, height: 40 } }) }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: pad || "6px 20px 28px" } }, kids));
  if (!songs.length) return shell(h("div", { className: "py-6" }, h(Empty, {
    text: T("他还没有歌单"),
    sub: T("「一起听」里给他生成一张，这里就能看到")
  }), h("button", {
    onClick: () => onGen && onGen(),
    disabled: !!busy,
    className: "w-full mt-4 py-3 active:opacity-60",
    style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", borderRadius: 14, border: "1px solid " + t.line, color: t.ink, opacity: busy ? .5 : 1 }
  }, busy ? T("正在想他会听什么…") : T("给他生成一张"))));
  const name = S(pl.name) || "歌单";
  const seed = phoneStableHash(name);
  const hue = seed % 360;
  const cover = songs.map(x => S(x.cover)).filter(Boolean)[0] || "";
  // 碟：一圈圈纹路用 repeating-radial-gradient 画出来，中间是标签，正中一个孔。
  // 零请求、每张歌单一个颜色、换个名字就是另一张碟。
  const disc = h("div", { "aria-hidden": "true", style: {
    width: 84, height: 84, borderRadius: 999, flexShrink: 0, position: "relative", overflow: "hidden",
    background: "repeating-radial-gradient(circle at 50% 50%,hsl(" + hue + " 16% 15%) 0 2px,hsl(" + hue + " 20% 22%) 2px 4px)",
    boxShadow: "0 7px 18px rgba(28,25,20,.22)"
  } },
    h("span", { style: {
      position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%) rotate(-24deg)",
      width: "150%", height: "36%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent)"
    } }),
    h("span", { style: {
      position: "absolute", inset: "30%", borderRadius: 999, overflow: "hidden",
      background: cover ? "#111" : "hsl(" + ((hue + 38) % 360) + " 52% 48%)"
    } }, cover ? h("img", { src: cover, alt: "", style: { width: "100%", height: "100%", objectFit: "cover" } }) : null),
    h("span", { style: {
      position: "absolute", left: "50%", top: "50%", marginLeft: -3, marginTop: -3,
      width: 6, height: 6, borderRadius: 999, background: t.bg
    } }));
  const eyebrow = s => h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".28em", color: t.fog } }, s);
  const act = (label, on, danger) => h("button", { "data-wk": "pbtn", "data-part": "act",
    onClick: e => { e.stopPropagation(); on(); },
    className: "active:opacity-60",
    style: {
      fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", padding: "6px 12px", borderRadius: 99,
      border: "1px solid " + (danger ? t.accent : t.line), color: danger ? t.accent : t.ink
    }
  }, label);
  return shell(h("div", { style: { animation: "qqIn .3s ease both" } },
    // 碟 + 这张叫什么
    h("div", { className: "flex items-center", style: { gap: 15, padding: "2px 0 18px" } }, disc,
      h("div", { className: "min-w-0", style: { flex: 1 } },
        eyebrow("A 面"),
        // 歌单名顶栏已经写着了，这儿不再抄一遍——碟边上该说的是顶栏说不了的：
        // 这张有多少首、跟哪儿是同一张、以及点一首会发生什么
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(23px * var(--app-fs, 1))", lineHeight: 1.15, color: t.ink, marginTop: 7 } },
          songs.length + " 首"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 7, lineHeight: 1.65 } },
          "和「一起听」是同一张"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.accent, marginTop: 3, lineHeight: 1.65 } },
          T("点一首，摊开他为什么听它")))),
    // 曲目单：号在左边挂着，中间是曲名，TA为什么循环这一首写在下面那一行
    songs.map((s2, i) => {
      const k = s2.id || ("s" + i);
      const on = open === k;
      const note = S(s2.note);
      return h("div", { key: k, "data-wk": "pitem", "data-watch": "item:" + S(s2.title), style: { borderTop: "1px solid " + t.line } },
        h("button", {
          onClick: () => setOpen(on ? null : k),
          "aria-expanded": on ? "true" : "false",
          className: "w-full text-left flex active:opacity-70",
          style: { gap: 13, padding: "13px 0 12px" }
        },
          h("span", { style: {
            flexShrink: 0, width: 26, textAlign: "right", fontFamily: F_DISPLAY,
            fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.25, color: on ? t.ink : t.fog
          } }, String(i + 1).padStart(2, "0")),
          h("div", { className: "min-w-0", style: { flex: 1 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.4, color: t.ink, wordBreak: "break-word" } }, S(s2.title) || "未命名"),
            S(s2.artist) ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, S(s2.artist)) : null,
            // 心境：TA为什么会循环这一首（她 2026-08-29 点名要在查手机这边看得到）。
            // 这一行是这一页的正文，不是附注——所以给它朱色，别再当成灰色小字。
            note ? h("div", { style: {
              fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.7, color: t.accent, marginTop: 7,
              paddingLeft: 9, borderLeft: "2px solid " + t.accent, opacity: .92, wordBreak: "break-word"
            } }, note) : null,
            // 点开就在原地摊开，不掀半窗（施工规则/no-half-sheet.md）。
            // 一首歌要说的就这两个动作，为它另开一层页面反而更重。
            on ? h("div", { className: "flex flex-wrap", style: { gap: 8, marginTop: 11 } },
              onPlay ? act("放这首", () => onPlay(s2)) : null,
              // 歌单走 open 档——TA没瞒着自己在听什么，所以不说「TA会知道你翻了手机」，
              // 那是撞破那一档的话。这儿就是随口提起。
              onPeek ? act(T("跟他提这首"), () => onPeek({
                tier: "open", label: "歌单",
                title: S(s2.title) + (S(s2.artist) ? " · " + S(s2.artist) : ""), text: note
              }), true) : null) : null)));
    })));
}

// ─────────────────────────────────────────────────────────────
// 论坛足迹：三副面具，不是三张普通数据表
// ─────────────────────────────────────────────────────────────
// 主论坛里小号和匿名不会暴露真身；只有翻到这台手机时，三份身份才会并排出现。
// 所以这页的主题不是“帖子列表”，而是“同一个人留下的三种公开痕迹”。
const PHONE_FORUM_SKINS = {
  main: { bg: "linear-gradient(155deg,#e7ede3,#dce6d7)", paper: "rgba(250,252,247,.94)", ink: "#293529", dim: "#6e796a", line: "rgba(52,70,50,.15)", accent: "#62775c", soft: "rgba(98,119,92,.12)", label: "公开身份" },
  alt: { bg: "linear-gradient(155deg,#eee9f2,#e2dbea)", paper: "rgba(251,248,252,.94)", ink: "#3b3044", dim: "#7c7084", line: "rgba(75,57,88,.15)", accent: "#79638a", soft: "rgba(121,99,138,.12)", label: "侧面的声音" },
  anon: { bg: "linear-gradient(155deg,#292c2b,#202322)", paper: "rgba(52,55,54,.96)", ink: "#f0eee7", dim: "#aaa9a2", line: "rgba(240,238,231,.13)", accent: "#b7a181", soft: "rgba(183,161,129,.14)", label: "没有署名" }
};
function PhoneForumView({ accounts, char, onBack, onPeek, tab, onTab, drive }) {
  const A = x => Array.isArray(x) ? x : [];
  const list = A(accounts);
  const acc = list.find(x => x.key === tab) || list[0] || { key: "main", label: "大号", name: "", posts: [], comments: [] };
  const skin = PHONE_FORUM_SKINS[acc.key] || PHONE_FORUM_SKINS.main;
  const [open, setOpen] = useState(null);
  const scrollRef = useRef(null), savedScrollRef = useRef(0);
  const countOf = a => A(a && a.posts).length + A(a && a.comments).length;
  const fmtTs = ts => {
    if (!ts) return "";
    const d2 = new Date(ts);
    return (d2.getMonth() + 1) + "月" + d2.getDate() + "日 " + String(d2.getHours()).padStart(2, "0") + ":" + String(d2.getMinutes()).padStart(2, "0");
  };
  const goTab = key => {
    setOpen(null); if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (onTab) onTab(key);
  };
  const openOne = (kind, item) => {
    savedScrollRef.current = scrollRef.current ? scrollRef.current.scrollTop : 0;
    setOpen({ kind, item });
  };
  // ──「看TA玩」驱动（她 2026-09-10：「论坛和匿名可以点开看但是不改」）──
  // ⚠️这一路【零写入】，而且比相册还硬：论坛接的是真数据，TA在这儿发一帖就是**真发出去**。
  //   所以只认 openItem，一个写入分支都不给（applyWrite 里压根没有 forum 这一支）。
  const driveItem = drive && drive.item;
  useEffect(() => {
    if (!drive) return;
    if (!driveItem) { setOpen(null); return; }
    const ps = watchOpenPick(A(acc && acc.posts), driveItem, x => x && x.title);
    if (ps) { setOpen({ kind: "post", item: ps }); return; }
    const cs = watchPick(A(acc && acc.comments), driveItem, x => x && x.postTitle);
    if (cs) setOpen({ kind: "comment", item: cs });
  }, [driveItem]);
  const closeOne = () => {
    setOpen(null);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = savedScrollRef.current;
    }));
  };
  const peek = item => {
    if (!onPeek || !item) return;
    const isPost = open && open.kind === "post";
    onPeek({
      tier: acc.key === "main" ? "open" : "hidden",
      label: acc.key === "main" ? "论坛（大号）" : acc.key === "alt" ? "论坛小号「" + (acc.name || "") + "」" : "论坛匿名足迹",
      title: isPost ? item.title : "在「" + (item.postTitle || "帖子") + "」下的回复",
      text: isPost ? item.body : item.text
    });
  };
  const top = h(Head, { zh: open ? (open.kind === "post" ? "帖子" : "回帖") : "论坛足迹",
    sub: open ? "" : "同一个人的三副面孔",
    bg: skin.bg, ink: skin.ink, subInk: skin.dim, lineInk: skin.line,
    onBack: open ? closeOne : onBack,
    right: h("span", { className: "flex items-center justify-center", style: { width: 40, height: 40 } }, h(PGlyph, { k: "forum", size: 17, color: skin.dim })) });
  if (!list.length) return h("div", { className: "h-full flex flex-col", "data-wk": "papp", "data-app": "forum", style: { background: skin.bg } }, top,
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5" }, h("div", { style: { padding: "64px 20px", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.85, color: skin.dim } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: skin.ink, marginBottom: 7 } }, T("论坛还没有他的痕迹")),
      T("等他去论坛发帖或回帖之后再来翻"))));
  if (open) {
    const it = open.item || {}, isPost = open.kind === "post";
    return h("div", { "data-wk": "phoneapppage", "data-part": "phoneforumview", className: "h-full flex flex-col", style: { background: skin.bg } }, top,
      h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
        h("article", { "data-wk": "block", style: { marginTop: 12, borderRadius: 20, padding: "18px 17px", background: skin.paper, border: "1px solid " + skin.line, boxShadow: "0 12px 28px rgba(24,31,24,.09)" } },
          h("div", { className: "flex items-center gap-2 flex-wrap" },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", padding: "3px 9px", borderRadius: 99, background: skin.soft, color: skin.accent } }, isPost ? (it.board || "论坛") : "回帖"),
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: skin.dim } }, fmtTs(it.ts))),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: isPost ? 21 : 16, lineHeight: 1.45, color: skin.ink, marginTop: 12 } }, isPost ? (it.title || "无题") : "在「" + (it.postTitle || "帖子") + "」下面说"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.85, color: skin.ink, marginTop: 10, whiteSpace: "pre-wrap" } }, PTX(isPost ? (it.body || "") : (it.text || ""))),
          isPost && A(it.replies).length ? h("div", { style: { marginTop: 20, borderTop: "1px solid " + skin.line, paddingTop: 13 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".12em", color: skin.dim, marginBottom: 4 } }, "楼下 · " + (it.replyCount || A(it.replies).length)),
            A(it.replies).map((r, i) => h("div", { key: i, style: { padding: "9px 0", borderTop: i ? "1px solid " + skin.line : "none" } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: r.mine ? skin.accent : skin.dim } }, (r.name || "网友") + "："),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.7, color: skin.ink } }, PTX(r.text || ""))))) : null),
        h("button", { onClick: () => peek(it), className: "w-full active:opacity-60", style: { marginTop: 14, borderRadius: 14, padding: "12px 14px", border: "1px solid " + (acc.key === "main" ? skin.line : skin.accent), background: acc.key === "main" ? skin.paper : skin.soft, color: skin.ink, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } },
          acc.key === "main" ? "转发给 TA" : T("摆到 TA 面前 · 这是他藏起来的"))));
  }
  const identityCount = countOf(acc);
  const postCard = (it, i) => h("button", { "data-wk": "block", key: it.id || "p" + i, "data-wk": "pitem", "data-watch": "item:" + (it.title || ""), onClick: () => openOne("post", it), className: "w-full text-left active:opacity-65", style: { display: "block", borderRadius: 18, padding: "14px 15px", marginTop: 10, background: skin.paper, border: "1px solid " + skin.line, boxShadow: "0 8px 22px rgba(28,36,27,.065)" } },
    h("div", { className: "flex items-center justify-between gap-3" },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", padding: "2px 8px", borderRadius: 99, background: skin.soft, color: skin.accent } }, PTX(it.board || "论坛")),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: skin.dim } }, fmtTs(it.ts))),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.45, color: skin.ink, marginTop: 8 } }, PTX(it.title || "无题")),
    it.body ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.65, color: skin.dim, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, PTX(it.body)) : null,
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: skin.dim, marginTop: 9 } }, it.replyCount ? it.replyCount + " 条回复" : "还没人回"));
  // ⚠️楼下那几条原来一个挂点都没有：模型说的名字对上的是【某条回复所在的帖子】时，
  //   页面按 comment 打开，圆点却只能在帖子里模糊找一个——于是「对着一个帖子，点进去是另一个」。
  const commentCard = (it, i) => h("button", { key: "c" + i, "data-watch": "item:" + (it.postTitle || ""), "data-wk": "pitem", onClick: () => openOne("comment", it), className: "w-full text-left active:opacity-65", style: { display: "block", marginTop: 9, padding: "12px 14px", borderRadius: 15, background: skin.paper, border: "1px solid " + skin.line, borderLeft: "3px solid " + skin.accent } },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.65, color: skin.ink } }, PTX(it.text || "")),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: skin.dim, marginTop: 6 } }, "在「" + String(it.postTitle || "帖子").slice(0, 20) + "」下 · " + fmtTs(it.ts)));
  return h("div", { className: "h-full flex flex-col", "data-wk": "papp", "data-app": "forum", style: { background: skin.bg } }, top,
    // 三个账号是三副身份面具：各自带眼孔与自己的颜色，选中的那副下沉接进足迹页。
    // 形状、高度、位置都会变，遵守 tabs-not-plain-pills.md；按钮本身仍保留 50px 以上手感。
    h("div", { className: "shrink-0 flex px-4", style: { gap: 6, alignItems: "flex-end", paddingTop: 6, borderBottom: "1px solid " + skin.line } }, list.map(a => {
      const active = a.key === acc.key, s2 = PHONE_FORUM_SKINS[a.key] || PHONE_FORUM_SKINS.main;
      return h("button", { "data-wk": "block", key: a.key, onClick: () => goTab(a.key), className: "flex-1 outline-none active:opacity-60", style: { minWidth: 0, minHeight: active ? 58 : 50, position: "relative", bottom: -1, marginTop: active ? 0 : 8, borderRadius: "14px 14px 3px 3px", padding: "7px 3px 6px", background: active ? skin.paper : s2.soft, border: "1px solid " + (active ? skin.line : s2.line), borderTop: "3px solid " + s2.accent, borderBottomColor: active ? skin.paper : s2.line, color: active ? skin.ink : skin.dim, boxShadow: active ? "0 -5px 14px rgba(28,36,27,.07)" : "none", opacity: active ? 1 : .72, zIndex: active ? 2 : 1 } },
        h("span", { "aria-hidden": "true", style: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, width: 25, height: 14, borderRadius: "50% 50% 42% 42% / 72% 72% 38% 38%", background: s2.accent, marginBottom: 2 } }, h("i", { style: { width: 4, height: 3, borderRadius: 99, background: active ? skin.paper : skin.bg } }), h("i", { style: { width: 4, height: 3, borderRadius: 99, background: active ? skin.paper : skin.bg } })),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, a.label),
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(8.5px * var(--app-fs, 1))", letterSpacing: ".1em", color: active ? s2.accent : skin.dim, marginTop: 1 } }, countOf(a) + " TRACE"));
    })),
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
      h("section", { "data-wk": "block", style: { marginTop: 13, borderRadius: 22, padding: "16px", background: skin.paper, border: "1px solid " + skin.line, boxShadow: "0 12px 28px rgba(24,31,24,.08)" } },
        h("div", { className: "flex items-center gap-3" },
          h("div", { "data-wk": "block", className: "shrink-0 flex items-center justify-center", style: { width: 48, height: 48, borderRadius: 16, background: skin.soft, border: "1px solid " + skin.line } }, h(PGlyph, { k: "forum", size: 22, color: skin.accent })),
          h("div", { className: "flex-1 min-w-0" },
            h("div", { className: "flex items-center gap-2" }, h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: skin.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, acc.name || acc.label), h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", padding: "2px 7px", borderRadius: 99, background: skin.soft, color: skin.accent } }, skin.label)),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: skin.dim, marginTop: 2 } }, [acc.handle, identityCount + " 条足迹"].filter(Boolean).join(" · ")))),
        acc.bio ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.7, color: skin.ink, marginTop: 12 } }, PTX(acc.bio)) : null,
        (acc.followers != null || acc.following != null) ? h("div", { className: "flex items-center gap-4", style: { marginTop: 10, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: skin.dim } },
          acc.following != null ? h("span", null, h("b", { style: { color: skin.ink } }, acc.following), " 关注") : null,
          acc.followers != null ? h("span", null, h("b", { style: { color: skin.ink } }, acc.followers), " 关注者") : null,
          acc.joinTs ? h("span", null, fmtTs(acc.joinTs).slice(0, -6) + " 注册") : null) : null),
      A(acc.posts).length ? h("section", { style: { marginTop: 19 } },
        h("div", { className: "flex items-center justify-between px-1" }, h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: skin.ink } }, "发过的帖"), h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: skin.dim } }, A(acc.posts).length + " 篇")), A(acc.posts).map(postCard)) : null,
      A(acc.comments).length ? h("section", { style: { marginTop: 21 } },
        h("div", { className: "flex items-center justify-between px-1" }, h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: skin.ink } }, "在别人楼下说的话"), h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: skin.dim } }, A(acc.comments).length + " 条")), A(acc.comments).map(commentCard)) : null,
      !A(acc.posts).length && !A(acc.comments).length ? h("div", { style: { padding: "58px 18px", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.85, color: skin.dim } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: skin.ink, marginBottom: 5 } }, "这个号还是空的"),
        acc.key === "anon" ? T("他还没用匿名发过什么") : T("他还没用这个号露过面")) : null));
}
function renderPhoneModule(key, d, ctx) {
  const {
    t,
    char,
    setSheet
  } = ctx;
  const line = {
    borderTop: `1px solid ${t.line}`
  };
  const wrap = kids => h("div", {
    style: {
      animation: "qqIn .3s ease both"
    }
  }, kids);
  // 模型偶尔会把 items 返回成字符串或对象；a || [] 会原样放行，下一步 .map 就是白屏
  const arr = a => Array.isArray(a) ? a : [];
  // 【偷看转发】她 2026-08-29 定的规矩：手机里的东西不常驻上下文，**转发了才注入**，
  // 而且注入时的语境必须是「她翻了TA的手机」。tier 决定TA该有什么反应：
  //   open   = TA本来就没瞒着（歌单、大号发的帖）
  //   quiet  = 你看得见但TA没主动说（备忘录、购物、浏览器、录音、普通照片）
  //   hidden = TA压根没打算让任何人知道（小号、匿名、深夜、私密、最近删除）
  const peekFoot = (tier, label, title, text) => ctx.onPeek ? h("button", { "data-wk": "pbtn", "data-part": "peek",
    onClick: () => ctx.onPeek({ tier, label, title, text }),
    className: "w-full mt-6 py-3 active:opacity-60",
    style: {
      fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", borderRadius: 13,
      border: "1px solid " + (tier === "hidden" ? "rgba(200,80,70,.45)" : t.line),
      color: tier === "hidden" ? "#b6473c" : t.ink
    }
  }, tier === "hidden" ? T("摆到 TA 面前 · 这是他藏起来的") : tier === "open" ? "转发给 TA" : T("转发给 TA · 他会知道你翻了手机")) : null;
  if (key === "wechat") return h(WeChatViewFull, { d, char, t, profile: ctx.profile, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, drive: ctx.drive, onSendAs: ctx.onSendAs, onTransferAs: ctx.onTransferAs, onTfReplyAs: ctx.onTfReplyAs, onShopAs: ctx.onShopAs, transferPeers: ctx.transferPeers, sendAsWaiting: ctx.sendAsWaiting, onRemark: ctx.onRemark, onDelFriend: ctx.onDelFriend, onDissolve: ctx.onDissolve, onBlockFriend: ctx.onBlockFriend });
  if (key === "notes") return h(StickyView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "calls") return h(PhoneCallsView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "browser") return h(BrowserView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "shopping") return h(ShoppingView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek, monthStats: (ctx.monthStats || {})["shopping"] });
  if (key === "takeout") return h(TakeoutView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek, monthStats: (ctx.monthStats || {})["takeout"] });
  if (key === "album") return h(AlbumView, { drive: ctx.drive, onPhotoEdit: ctx.onPhotoEdit, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek, onDrawPhoto: ctx.onDrawPhoto, drawing: ctx.drawing });
  // ── 论坛：接【真论坛】，不再另生成一份光有标题的假货 ──
  // 论坛界面里她只看得见「匿名用户」和一个不认识的小号；哪些是TA发的，
  // 只有翻TA手机才知道。所以三个账号并排摆在这儿——查手机就是面具掉下来的地方。
  if (key === "forum") return h(PhoneForumView, {
    drive: ctx.drive,
    accounts: ctx.forumAccounts, char, onBack: ctx.onBack, onPeek: ctx.onPeek,
    tab: ctx.forumTab, onTab: ctx.setForumTab
  });
  // ── 音乐：接【一起听】里那张真歌单 ──
  // 以前这儿单独生成一份，于是同一个人有两张互不相干的歌单，
  // 手机里这张还点不动。现在读同一份数据，点开就能放，并且每首带TA自己的心境。
  if (key === "music") return h(MusicView, {
    pl: ctx.playlist, char, t, onGen: ctx.onGenPlaylist, busy: !!ctx.playlistBusy,
    onPlay: ctx.onPlaySong, onPeek: ctx.onPeek, onBack: ctx.onBack, drive: ctx.drive, nowSongId: ctx.nowSongId
  });
  if (key === "reading") return h(ReadingView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "clipboard") return h(ClipView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "health") return h(HealthView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek, vitals: ctx.vitals });
  if (key === "liked") return h(PlazaView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "calendar") return h(CalendarView, { drive: ctx.drive, d: ctx.calendar || d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "bili") return h(BiliView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "latenight") return h(LateNightView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "mail") return h(MailView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "tally") return h(TallyView, { drive: ctx.drive, d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "anon") return h(AnonBox, {
    char,
    data: ctx.anon || {},
    busy: !!ctx.anonBusy,
    onGenNetizen: ctx.onGenAnonQuestion,
    onRefreshPersona: ctx.onRefreshAnonPersona,
    onAsk: ctx.onAskAnon,
    onDelRecord: ctx.onDelAnonRecord,
    onClose: ctx.onBack
  });
  if (key === "astro") return typeof window !== "undefined" && window.AstroPhoneView ? h(window.AstroPhoneView, { char, profile: ctx.profile, onBack: ctx.onBack })
    : h("div", { className: "h-full flex items-center justify-center", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog } }, "星测还没加载好");
  if (key === "timeline") return h(TimelineView, {
    rows: ctx.timelineRows, char, t, onBack: ctx.onBack, onOpenApp: ctx.onOpenApp, onPeek: ctx.onPeek,
    newIds: ctx.newIds, newCount: ctx.newCount, onMarkRead: ctx.onMarkRead,
    kept: ctx.kept, onToggleKeep: ctx.onToggleKeep
  });
  return null;
}

// 单个 app 的详情页
function PhoneApp({
  appKey,
  char,
  charData,
  busyKey,
  onGen,
  onBack,
  profile,
  actualWechat,
  actualMoments,
  live,
  drive
}) {
  const t = useTheme();
  phoneViewTa(char);   // 界面上的「TA/她/TA」跟着这台手机的主人走（v58.88）
  const [sheet, setSheet] = useState(null);
  const zh = PHONE_LABEL[appKey];
  const rawData = charData[appKey];
  const data = appKey === "wechat" && rawData ? { ...rawData, actualChats: actualWechat || [], actualMoments: actualMoments || [], relContacts: (actualMoments && actualMoments.relNames) || [] } : rawData;
  const loading = busyKey === appKey;
  const isLive = PHONE_LIVE_KEYS.indexOf(appKey) >= 0;
  const [forumTab, setForumTab] = useState("main");
  // 点开不再自己生成（群友 2026-10-09：「我只是想进去看看软件，进去就需要生成了」）：
  //   还没内容的 app 先摆一页「还没生成」，她按了那颗键才去调模型——点开一个 app 不该悄悄花一次钱。
  // 视频子版块：点击 tab 时直接生成，失败退回上一级
  let content;
  // ⚠️别写「读取」：这一步是真去调模型现编的，一次一刀（她按次计费）。
  // 写成「读取」会让人以为只是在翻已经存好的东西，于是随手点开一个版块＝
  // 悄悄花掉一次调用，还完全看不出来。接真数据的那几个（isLive）才是真读取。
  // 生成中可以先走（她 2026-09-27「搞个退出键让它后台继续刷，我晚点回来看」；出口是左上角的返回箭头，回查手机）：
  //   生成本来就挂在 app 最外层（genPhoneApp），退出这一屏不会打断它，好了照样存进这台手机；
  //   缺的只是出口——满屏出血那几个 app（浏览器、微信、外卖…）自己画顶栏，转圈时连返回键都没有。
  //   记一笔「她是走开等的」，生成完弹一句告诉她（app.js genPhoneApp）。
  const markLeft = () => { try { (window.__phoneLeftWhileGen = window.__phoneLeftWhileGen || new Set()).add(char.id + ":" + appKey); } catch (e) {} };
  const leaveWhileGen = () => { markLeft(); onBack(); };
  // 不管怎么走的（箭头、回主屏、去别的 app）：离开这一屏时还在生成，就记一笔，好了弹一句
  const stillGen = useRef(false); stillGen.current = busyKey === appKey && !data;
  useEffect(() => () => { if (stillGen.current) markLeft(); }, []);
  const spinning = (loading && !data) || (!data && !isLive && !!drive);
  const notYet = !data && !isLive && !spinning;
  if (spinning) content = h(Spinner, { label: "正在生成 " + zh + "…（这一步会调一次模型）" });
  else if (notYet) content = h("div", { "data-wk": "phonenotyet", className: "flex flex-col items-center justify-center text-center", style: { padding: "80px 24px", gap: 10 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink } }, zh + "里还没有东西"),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7 } }, "要看就生成一份，这一步会调一次模型。"),
    h("button", { onClick: () => onGen(char, appKey), disabled: !!busyKey, className: "active:opacity-70 disabled:opacity-40",
      style: { marginTop: 6, minHeight: 40, padding: "0 22px", borderRadius: 20, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "生成 " + zh));
  else content = renderPhoneModule(appKey, data, {
    t,
    char,
    setSheet,
    profile,
    onBack,
    onRefresh: () => onGen(char, appKey),
    // 同理：顶栏那颗「重新推演」也是她的按钮。它画在各屏自己的顶栏里、不吃 null，
    // 所以按住它——演的过程里点一下就是一枪真钱，而且会把正在演的这一份盖掉。
    refreshing: drive ? true : !!busyKey,
    forumTab,
    setForumTab,
    drive,
    ...(live || {}),
    // ⚠️「看TA玩」的时候把【转发给 TA / 摆到 TA 面前】那颗钮收起来（她 2026-09-10 提）。
    //   这一屏此刻扮的是**TA手里的手机**：TA自己刷着刷着，屏幕上冒出一颗
    //   「转发给TA，TA会知道你翻了手机」——那是她的按钮，出现在TA的手上就穿帮了。
    //   收在这一处就够：二十来屏都是 `onPeek ? h("button"…) : null` 的写法，
    //   给它 null 就整片消失，不用去二十个地方各加一个 if（施工规则/one-public-mechanism.md）。
    onPeek: drive ? null : (live || {}).onPeek
  });
  // ⚠️第二次以后重刷，原来【一点动静都没有】（她 2026-09-01：「刷新的时候没有提醒，
  // 我怀疑全部查手机每个 app 第二次以后都没有」——对，就是全部）。
  // 病在上面那个条件：转圈只在【还没有数据】时才出现，一旦这个 app 已经有内容，
  // loading 就再也没有出口了。顶栏那个刷新键是变淡了，可那是 18px 的图标压到 40%
  // 透明——等于没有。
  // 做成浮在最上面的一条，不进正文流：① 旧内容不清空也不被推下去（清了更像坏了，
  // 推下去等于每次刷新页面跳一下）；② 满屏出血那几个 app（外卖、微信…）自己画顶栏，
  // 塞进正文的话会顶在它们的顶栏上面。
  // top 让开一整条顶栏的高度（safeTop + 40）：压在顶栏上会把返回键盖住，
  // 正刷着的时候更该让她能退出去。
  const respin = loading && data ? h("div", {
    role: "status",
    className: "flex items-center",
    style: {
      position: "absolute", left: 12, right: 12, top: safeTop(52), zIndex: 30,
      gap: 9, background: "rgba(255,255,255,.96)", border: "1px solid " + t.line,
      borderRadius: 13, padding: "10px 13px", boxShadow: "0 8px 22px rgba(28,25,20,.14)"
    }
  },
    h("span", { "aria-hidden": "true", style: { width: 13, height: 13, borderRadius: 99, border: "2px solid " + t.line, borderTopColor: t.ink, flexShrink: 0, animation: "wk-spin .9s linear infinite" } }),
    h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.55 } },
      "正在重新推演 " + zh + "…（这一步会调一次模型）"),
    h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, flexShrink: 0 } }, "下面还是上一次的")) : null;
  // 接真数据的 app 没有「重刷」这回事——它跟着TA真去论坛发帖、真加歌单在变。
  const refreshKey = isLive ? null : appKey;
  const liveTitle = appKey === "music"
    ? (((live || {}).playlist || {}).name || "音乐")
    : appKey === "forum"
      ? (() => { const a = ((live || {}).forumAccounts || []).find(x => x.key === forumTab); return a ? a.label + " · " + (a.name || "") : "论坛"; })()
      : zh;
  // 这台手机里的字都是 TA 的：TA 开着「自带中译」，「译」就直接展开（TransWho）
  return h(window.TransWho || React.Fragment, window.TransWho ? { id: char && char.id } : null, h("div", { "data-wk": "phoneapppage", "data-part": "phoneapp",
    className: "h-full flex flex-col relative",
    style: phoneAppBg(t)
  },
  respin,
  // 满屏出血的 app 转圈时没有自己的顶栏：给一条只有返回箭头的，回查手机，生成在后台接着跑
  FULL_BLEED_KEYS.indexOf(appKey) >= 0 && (spinning || notYet) && h(Head, { zh, bg: t.bg, noLine: true, onBack: spinning ? leaveWhileGen : onBack }),
  FULL_BLEED_KEYS.indexOf(appKey) < 0 && h(Head, {
    zh: isLive ? liveTitle : zh, bg: t.bg, noLine: true, onBack: spinning ? leaveWhileGen : onBack,
    right: refreshKey ? h("button", {
      onClick: () => onGen(char, refreshKey),
      disabled: !!busyKey,
      "aria-label": "重新推演",
      className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center",
      style: { width: 40, height: 40 }
    }, h(IRefresh, { size: 18, color: t.ink })) : null
  }), h("div", {
    className: FULL_BLEED_KEYS.indexOf(appKey) >= 0 ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0 overflow-y-auto px-5 pt-1 pb-5"
  }, content), sheet && h(PageSheet, {
    onClose: () => setSheet(null),
    tall: true
  }, sheet)));
}

// 查手机主界面：仿桌面
function PhoneCarry({
  characters,
  phones,
  selId,
  busyKey,
  onBack,
  onSel,
  onGenApp,
  onGenAll,
  profile,
  actualWechatFor,
  actualMomentsFor,
  onSendAs,
  onTransferAs,
  onTfReplyAs,
  onShopAs,
  transferPeers,
  sendAsWaiting,
  // 改TA通讯录备注（v74.978）。⚠️原来这儿漏收了：app 那头递了 onRemark，
  //   这一层没接、也没放进下面的 ctx，于是微信那页永远拿到 undefined，「›」一次都没出现过
  //   （她 2026-10-07：「为啥 978 的微信改备注 cf 显示不出来」——其实家里也没有）。
  onRemark,
  onDelFriend,
  onDissolve,
  onBlockFriend,
  nowSongId,
  forumAccountsFor,
  playlistFor,
  onGenPlaylist,
  playlistBusyId,
  onPlaySong,
  onPhoneMusicEnter,
  onPhoneMusicLeave,
  calendarFor,
  vitalsFor,
  monthStatsFor,
  anonFor,
  anonBusy,
  onRefreshAnonPersona,
  onGenAnonQuestion,
  onAskAnon,
  onDelAnonRecord,
  archives,
  onResetApp,
  lang,
  onLang,
  autoOn,
  weekAt,
  lastAll,
  onPeek,
  onDrawPhoto,
  onPhotoEdit,
  drawingPhoto,
  onWatchStart,
  onWatchSend,
  onWatchReply,
  onWatchKnock,
  onWatchToast,
  onWatching,
  watchCoolLeft,
  watchHintOn
}) {
  const t = useTheme();
  const [pick, setPick] = useState(false);
  const [open, setOpen] = useState(null);
  const [deskPage, setDeskPage] = useState(0);
  // ── 「看TA玩」：TA自己在刷手机，我在旁边看（js/phone-watch.js 是词表和落盘那一份）──
  // ⚠️TA操作的就是她平时翻的这几屏，不另做一套「TA的手机」——那才是这个玩法成立的地方。
  //   所以这儿只多一个【播放器】：把一串动作按时间演成 open/locked/tab/chat/typing 的变化。
  const [watch, setWatch] = useState(null);   // {acts,i,speed,tab,chat,typing,sent,thought,knocks,knocking,done,note}
  const [watchBusy, setWatchBusy] = useState(false);
  const [dot, setDot] = useState(null);       // 触控圆点落在哪儿 {x,y,press}
  const [barWake, setBarWake] = useState(false);   // 底下那条让路之后，手指按上去先亮回来
  const watchRef = useRef(null); watchRef.current = watch;
  const watchAliveRef = useRef(true);
  useEffect(() => {
    watchAliveRef.current = true;
    return () => { watchAliveRef.current = false; if (onWatching) onWatching(false); };
  }, []);
  // 播放器要知道【此刻开着哪个 app】：同一个 openItem/send 在微信和便签里做的事不一样。
  // open 是 state，effect 里读到的是那一轮的旧值，所以另存一份 ref。
  const openRef = useRef(null);
  openRef.current = open;
  // 便签里点开一条时，手上那份草稿就是它现在的正文——TA要「划掉重写」得先有东西可划
  // 阅读：点开一本书时，手上那份草稿就是它现在的批注（跟便签同一个理由）
  const bookNoteOf = title => {
    const shelves = (((phones || {})[char && char.id] || {}).reading || {}).shelves;
    const flat = [];
    (Array.isArray(shelves) ? shelves : []).forEach(sh => (Array.isArray(sh && sh.books) ? sh.books : []).forEach(b => { if (b) flat.push(b); }));
    const hit = watchPick(flat, title, b => b && b.title);
    return hit ? String(hit.note || "") : "";
  };
  const noteBodyOf = title => {
    const it = (((phones || {})[char && char.id] || {}).notes || {}).items;
    // ⚠️这一处最阴：取不到正文的话，TA「划掉重写」划的是一片空白，
    //   可落盘那头 applyWrite 用的是模糊认名，照样找到那条便签覆盖掉——演的和写的两回事。
    const hit = watchPick(Array.isArray(it) ? it : [], title, x => x && x.title);
    return hit ? String(hit.body || "") : "";
  };
  // ⚠️播放器这一串 hook 必须待在【所有 return 上面】——这个组件下面有好几处早返回
  //   （没选角色 / 通讯录 / 外观设置），挂在它们后面就是条件调用 hook，整页会白。
  //   文件里 deskNow 那儿早就写着同一句话了。
  // ── 播放器：一个动作一个动作往下演 ──────────────────────────────
  // 每一步只做两件事：把这一下的效果落到界面上，然后按这一下该花多久排下一步。
  // ⚠️打字是【逐字】的，所以 type 这一支自己再开一个小节拍；清理函数要把它一起收掉，
  //   不然退出去之后还有一串定时器在往一个已经没了的 state 里写。
  const WK = typeof window !== "undefined" ? window.PhoneWatch : null;
  // 挂点找不着的时候再模糊找一次：模型写的名字标点常常飘（「《长夜》」→「长夜」），
  // 严格选择器就当场落空。认名字的规矩只有 PhoneWatch.sameName 一份。
  // TA说「切到收藏那一栏」，可挂点上写的是 tab:saved——名字对不上的后果是【两处一起哑】：
  // 圆点找不着挂点（她 2026-09-11：「光标有时候还是对不上」），而那一屏被切到一个
  // 根本不存在的栏，于是整页空着（跟「在邮件里切到 sms」同一个病）。
  // ⚠️认名字仍然只走 PhoneWatch.pickName 这一份规矩：先按 key 对，再按那颗键上写的字对。
  const watchTabKey = name => {
    const want = String(name || "").trim();
    if (!want || !WK || !WK.pickName) return want;
    const all = [].slice.call(document.querySelectorAll('[data-watch^="tab:"]'));
    if (!all.length) return want;
    const keyOf = el => String(el.getAttribute("data-watch")).slice(4);
    const hit = WK.pickName(all, want, keyOf) || WK.pickName(all, want, el => String(el.textContent || "").trim());
    return hit ? keyOf(hit) : want;
  };
  // firstIfMiss：点开那一类的动作，认不出名字时圆点落在这一屏第一条上——
  // 跟上面 watchOpenPick 是【同一条判断】：那一下真的会开出第一条来，手指就该按在它身上。
  const watchFuzzy = (name, firstIfMiss) => {
    if (!WK || !WK.pickName) return null;
    if (!name) return firstIfMiss ? document.querySelector('[data-watch^="item:"]') : null;
    // ⚠️必须跟各屏用【同一条】挑人规矩（pickName：先要完全一样的）。
    //   一处 sameName 顺着 DOM 找、一处顺着数据找，撞上两条都像的就各挑各的——
    //   圆点点在这一条上、点进去却是另一条（她 2026-09-10 在视频里看见的）。
    const all = [].slice.call(document.querySelectorAll('[data-watch^="item:"]'));
    return WK.pickName(all, name, el => String(el.getAttribute("data-watch")).slice(5))
      || (firstIfMiss ? all[0] || null : null);
  };
  // 这一屏此刻真正在滚的是哪一块：最大的那个能滚、又看得见的容器。
  // ⚠️不写死某个 ref：二十来屏各有各的滚动容器，写死一个就只有那一屏能滑。
  const watchScroller = () => {
    let best = null, area = 0;
    const all = document.querySelectorAll("div,section,main,ul");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.scrollHeight - el.clientHeight < 24) continue;
      const st = window.getComputedStyle(el).overflowY;
      if (st !== "auto" && st !== "scroll") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 80 || r.height < 80) continue;
      if (r.bottom < 0 || r.top > (window.innerHeight || 0)) continue;
      const a2 = r.width * r.height;
      if (a2 > area) { area = a2; best = el; }
    }
    return best;
  };
  // 这一下有没有【先翻过去】：翻了的话，点开那一下要等它翻完，不然就是没翻页就开了
  const scrolledRef = useRef(false);
  const dotSc = useRef(null);   // 刚才是哪一块在滚（等它停下来）
  const watchDotTo = (sel, fuzzyName, firstIfMiss) => {
    scrolledRef.current = false;
    if (!sel) return;
    // 光标落在哪儿靠挂点量出来，不猜坐标：会话列表滚到哪儿、有几条，每台手机都不一样，
    // 猜出来的点会落在空处——那一眼就看得出是假的。
    // ⚠️量一次是不够的：这一下刚改完 state，要点的那个东西【还没画出来】（切了栏、
    //   进了详情页都是这样），一次 rAF 量到的是 null，于是圆点整段杵在原地不动
    //   （她 2026-09-10：「整体光标都不会移动」）。所以隔几拍再试几次，量到就停。
    let done = false;
    const attempt = () => {
      if (done) return;
      try {
        const el = document.querySelector(sel) || watchFuzzy(fuzzyName, firstIfMiss);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        // ⚠️要点的东西不在屏幕上时【先把它翻出来】，别把圆点甩到屏幕外去
        //   （桌面第二页那几个图标就是这样：量得到坐标，但那是 x=630 的地方，
        //   人根本看不见）。真人也是先划到那一页、或者把列表滚到那一行，才点得着。
        const W0 = window.innerWidth || 0, H0 = window.innerHeight || 0;
        let box = r;
        if (r.right < 0 || r.bottom < 0 || r.left > W0 || r.top > H0) {
          // ⚠️桌面第二页那几个图标：瞬移过去等于「没翻页就开了」（她 2026-09-10 抓到的）。
          //   滚给她看，并且把「点开」那一下往后压一压（下面 open 那一支读 scrolledRef）。
          scrolledRef.current = true;
          dotSc.current = el.parentElement && el.parentElement.closest ? (el.closest("[style*='scroll-snap'],.overflow-x-auto,.overflow-y-auto") || null) : null;
          try { el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }); } catch (e2) {}
          // ⚠️翻完【当场再量一次】：这一下过后屏幕多半就换了（点开 app 那一下尤其），
          //   等下一拍再来量，那个图标早不在 DOM 里了——圆点于是停在上一处不动。
          box = el.getBoundingClientRect();
          // 平滑滚的话这一帧还没到位，等下一拍再量（760 毫秒那一下兜底）
          if (box.right < 0 || box.bottom < 0 || box.left > W0 || box.top > H0) return;
        }
        const r2 = box;
        done = true;
        setDot({ x: Math.round(r2.left + r2.width / 2), y: Math.round(r2.top + r2.height / 2), press: true });
        setTimeout(() => setDot(p => p ? { ...p, press: false } : p), 190);
      } catch (e) {/* 量不到就让圆点留在原地，别为这个崩掉整段 */}
    };
    // ⚠️第一下必须【当场同步量】：手指按的是**按下去之前**那一屏上的东西——
    //   点开一个 app、点开一行、按返回，这几下一按屏幕就换了，等到下一帧那个图标
    //   早没了（她 2026-09-10：「整体光标都不会移动」，病根就在这儿：原来第一下也是异步的）。
    //   effect 里的 setState 不会同步刷 DOM，所以这一刻量到的正是TA手指按下去的那一屏。
    attempt();
    // 按完才出现的那几样（搜出来的那一页、发送键、打字条）第一下量不到，隔几拍再试。
    const shots = [90, 220, 420, 660].map(ms => setTimeout(attempt, ms));
    // ⚠️「几拍都没量到就把圆点收起来」原来挂在 780 毫秒上——**那一枪永远打不响**：
    //   一下动作才 620 毫秒，到点之前清理函数就把它连同别的定时器一起清了。
    //   于是只要这一下没找着挂点，圆点就赖在【上一下】那儿不动——她看见的
    //   「看第二条便签光标还是停在后退键」正是这个，而且每个 app 都会犯
    //   （她 2026-09-10：「我怀疑这个大部分 app 都有这个问题」）。
    //   改成挂在【这一下结束】那一刻：没量到就收起来，不许赖着。
    return () => { shots.forEach(clearTimeout); if (!done) setDot(null); };
  };
  useEffect(() => {
    if (!watch || watch.done || !WK) return;
    const a0 = watch.acts[watch.i];
    if (!a0) { setWatch(w => w ? { ...w, done: true, typing: null } : w); return; }
    // 切栏那一下先把名字对成屏幕上真有的那一栏：圆点和切栏读的是同一个 a，一处对上两处都对
    const a = a0.kind === "tab" ? Object.assign({}, a0, { name: watchTabKey(a0.name) }) : a0;
    const speed = watch.speed || 1;
    let typer = null, openTid = null, openFallback = null, typeMs = 0;
    // ① 圆点先落下去——**在这一下的效果之前**。
    //   顺序反了的话，点开 app、点开一行、按返回这几下量到的都是【换过之后】那一屏，
    //   要点的那个东西已经不在了，于是圆点整段杵着不动。
    //   名字一起递过去：挂点没抓着就按名字模糊找一次（模型写的名字标点常常飘）。
    const stopDot = watchDotTo(WK.watchTargetSel(a), a.name || a.at || "",
      a.kind === "openItem" || a.kind === "look");
    // ② 这一下的效果
    if (a.kind === "wake") { setLocked(false); setOpen(null); }
    else if (a.kind === "lock") { setLocked(true); setOpen(null); setWatch(w => w ? { ...w, item: null, page: null, lastQ: "", searchQ: "", typing: null } : w); }
    else if (a.kind === "home") { setOpen(null); setWatch(w => w ? { ...w, item: null, page: null, tab: null, lastQ: "", searchQ: "", typing: null } : w); }
    else if (a.kind === "open") {
      const app = appByKey(a.app);
      // ⚠️tab 也要清掉：它是【上一个 app 里切到哪一栏】，跟着进下一个 app 就成了
      //   「在邮件里切到 sms」——那一栏不存在，于是整页空着（真机上抓到的）。
      if (app) {
        // ⚠️她 2026-09-11：「有一次卡在主页然后出了个心声，我猜是不是有一个页面打不开卡着了」。
        //   就是这儿：下面那段「等它翻完再点开」最多等 900 毫秒，可这一下本身只演 620
        //   毫秒——时候一到 advance 就把这一步推走，清理函数顺手把 openTid 清掉，
        //   **go() 于是一辈子没跑**：app 没打开，后面 openItem／心声全在主屏上演。
        //   所以这一下只许发生一次，而且【一定】发生：等待封顶 380 毫秒（还在这一下之内），
        //   万一这一步被推走了，清理时也把它补上。
        let opened = false;
        const go = () => { if (opened) return; opened = true; setOpen(app.key); setWatch(w => w ? { ...w, item: null, page: null, tab: null, lastQ: "", searchQ: "", typing: (WATCH_SEARCH_APPS.indexOf(app.key) >= 0 || app.key === "tally") ? "" : null } : w); };
        openFallback = go;
        // ⚠️图标在桌面第二页的话，先看着它翻过去再点开——瞬移等于「没翻页就开了」。
        // ⚠️420 毫秒是拍出来的，平滑滚常常还没走完（她 2026-09-10：「换页换一半就
        //   直接进第二页的 app 了」）。改成【等它真停下来】：盯着位置不动了再点开，
        //   最多等 900 毫秒，免得某一屏滚不动就卡在这儿。
        if (scrolledRef.current) {
          const box = dotSc.current;
          let last = -1, still = 0, t0 = Date.now();
          const wait = () => {
            const now2 = box ? Math.round(box.scrollLeft + box.scrollTop) : 0;
            still = (now2 === last) ? still + 1 : 0;
            last = now2;
            if (still >= 2 || Date.now() - t0 > 380) { go(); return; }
            openTid = setTimeout(wait, 70);
          };
          openTid = setTimeout(wait, 70);
        } else go();
      }
    }
    else if (a.kind === "back") {
      const w0 = watchRef.current;
      const inner = !!(w0 && (w0.item || w0.page));
      setWatch(w => w ? { ...w, item: null, page: null, typing: WATCH_SEARCH_APPS.indexOf(openRef.current) >= 0 ? "" : null } : w);
      if (!inner) setOpen(null);
    }
    else if (a.kind === "tab") setWatch(w => w ? { ...w, tab: a.name, item: null, typing: null } : w);
    else if (a.kind === "openItem") setWatch(w => w ? {
      ...w, item: a.name, page: null,
      // 微信：点开会话＝可以开始打字（空草稿）。便签：点开＝手上是那条现有的正文，
      // TA要划掉重写就从这一份上删起。相册／音乐：纯点开，压根不给草稿。
      // 微信／短信／邮件：点开＝可以开始打字（空草稿）。
      // 便签／阅读：点开＝手上是它现在的正文／批注，TA要划掉重写就从这一份上删起。
      // 相册／音乐／视频／健康这些：纯点开，压根不给草稿。
      typing: (openRef.current === "wechat" || openRef.current === "calls" || openRef.current === "mail") ? ""
        : openRef.current === "notes" ? String((noteBodyOf(a.name) || ""))
        : openRef.current === "reading" ? String((bookNoteOf(a.name) || "")) : null
    } : w);
    // 浏览器：TA刚搜出来点进去的那一页。这一页在TA手机里本来不存在——是现编的。
    else if (a.kind === "openPage") {
      const pg = { title: a.name, site: a.site || "", gist: a.gist || "", price: a.price != null ? a.price : null, priv: !!a.priv };
      // ⚠️只有浏览器那一路的 openPage 才接得住「TA刚搜的那句」。
      //   lastQ 原来跨 app 不清：先在浏览器搜过「怎么煮溏心蛋」，后来点开购物点一件商品，
      //   那件商品就被存成了「怎么煮溏心蛋」（购物/外卖/小红书/视频四处同一行写法，全中）。
      const q = openRef.current === "browser" ? String((watchRef.current && watchRef.current.lastQ) || "") : "";
      // ⚠️item 要一起清掉：小红书那一屏的详情页是【顶掉整屏】的，item 还挂着的话
      //   现编的这一页就被压在它下面，等于什么都没看见。
      setWatch(w => w ? { ...w, page: pg, item: null, typing: null } : w);
      if (onWatchSend) { try { onWatchSend(char, openRef.current, q, a.name, Object.assign({ act: "openPage" }, pg)); } catch (e) {/* 落盘失败不该把这段演砸 */} }
    }
    // ⚠️scroll 原来是个【空动作】：词表里有、提示词里三处让TA用（小红书／视频／深夜台
    //   这三个「只能刷」的 app 里TA几乎只能干这个），可播放器一个分支都没有——
    //   屏幕纹丝不动地停 700 毫秒。这个功能的命根子就是「一眼看得出是真的」。
    else if (a.kind === "scroll") {
      const px = Math.max(-1400, Math.min(1400, Number(a.amount) || 320));
      requestAnimationFrame(() => {
        const el = watchScroller();
        if (!el) return;
        try { el.scrollBy({ top: px, behavior: "smooth" }); } catch (e) { el.scrollTop += px; }
        // 手指落在TA划的那一片上，跟着往下带一截
        const r = el.getBoundingClientRect();
        setDot({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height * (px > 0 ? 0.62 : 0.38)), press: false });
      });
    }
    // 复制一段字：不属于任何一个 app，直接落进剪贴板（她 2026-09-10 点名的那一格）
    else if (a.kind === "copy") {
      const app0 = appByKey(openRef.current);
      if (onWatchSend && String(a.text || "").trim()) {
        try { onWatchSend(char, "clipboard", (app0 && app0.zh) || "", a.text, { act: "copy" }); } catch (e) {/* 落盘失败不该把这段演砸 */}
      }
    }
    // 写了一半没发：落进这个 app 的草稿箱
    else if (a.kind === "draft") {
      if (onWatchSend && String(a.text || "").trim()) {
        try { onWatchSend(char, openRef.current, a.name || "", a.text, { act: "draft" }); } catch (e) {/* 同上 */}
      }
      setWatch(w => w ? { ...w, typing: null } : w);
    }
    // 把正看着的这张照片挪到另一摞（她 2026-09-10：「照片换相册我是说看TA玩让TA弄」）。
    // ⚠️不另开落盘路径：跟发微信、下单同一条路（onWatchSend → applyWrite → savePhoneApp）。
    else if (a.kind === "move") {
      const w0 = watchRef.current;
      const nm = a.name || (w0 && w0.item) || "";
      if (onWatchSend && nm && a.to) { try { onWatchSend(char, openRef.current, nm, a.to, { act: "move" }); } catch (e) {/* 落盘失败不该把这段演砸 */} }
    }
    else if (a.kind === "think") setWatch(w => w ? { ...w, thought: a.text, thoughtZh: a.zh || "" } : w);
    // 对面回一句（她 2026-09-10：「微信也模拟一下对面的回复」）——
    // 不然那一屏永远停在TA自己那条上，像对面死了。
    else if (a.kind === "reply") {
      setWatch(w => w ? { ...w, sent: (w.sent || []).concat([{ from: a.name, text: a.text, them: true }]) } : w);
      if (onWatchReply) { try { onWatchReply(char, a.name, a.text, openRef.current); } catch (e) {/* 落盘失败不该把这段演砸 */} }
    }
    else if (a.kind === "erase") setWatch(w => w ? { ...w, typing: a.n == null ? "" : String(w.typing || "").slice(0, Math.max(0, String(w.typing || "").length - a.n)) } : w);
    else if (a.kind === "send") {
      const w0 = watchRef.current;
      const text = String((w0 && w0.typing) || "").trim(), to = w0 && w0.item, where = openRef.current;
      if (where === "browser") {
        // ⚠️这一支要放在 browser 分支【里面】：写在外面的 else-if 永远走不到，
        //   因为上面这个 if 已经把浏览器里所有的 send 都接住了（真机上抓到的：书签一直是空的）。
        if (!text && w0 && w0.page) {
          // 手上没在打字、屏幕上摆着一页 → 这一下是把它收进书签（跟买东西那几屏同一条分家规矩）
          if (onWatchSend) { try { onWatchSend(char, "browser", "", w0.page.title, Object.assign({}, w0.page, { act: "mark" })); } catch (e) {} }
        }
        // 浏览器里按回车＝搜这一句。搜完不一定点得开东西（那也很像TA），
        // 所以这一下先只记 searches；真点开哪一页由后面的 openPage 决定。
        else if (text) {
          // ⚠️敲完回车得【先看见搜出来的那一列】，再点进去其中一条（她 2026-09-10：
          //   「搜浏览器顺序错了，现在是先打开了搜索后的页面退出才显示搜索」）。
          //   原来这一下只把地址栏清空，屏幕还停在标签页那一栏，于是下一下 openPage
          //   直接盖上来——看着就是「凭空冒出一页，退出来才看见TA搜了什么」。
          setWatch(w => w ? { ...w, lastQ: text, typing: "", page: null, tab: "search" } : w);
          if (onWatchSend) { try { onWatchSend(char, "browser", text, "", { act: "send" }); } catch (e) {} }
        }
      }
      else if (text && WATCH_SEARCH_APPS.indexOf(where) >= 0) {
        // ⚠️同一颗键，两件事，靠【手上有没有草稿】分：
        //   有草稿＝TA在搜索框里敲完了 → 这一下是搜索（先让那句话留在框里）；
        //   没草稿＝屏幕上摆着一页 → 这一下才是这个 app 的动作（收藏／加购／下单）。
        //   真手机就是这么分的，不用另造一个词。
        setWatch(w => w ? { ...w, searchQ: text, typing: "", page: null } : w);
      }
      else if (WATCH_BUY_APPS.indexOf(where) >= 0) {
        // 购物／外卖／小红书里没有输入框：这一下按的是【TA正看着的那一页】上那颗钮——
        // 加进购物车 / 下这一单 / 收藏这一条。所以看的不是草稿，是屏幕上那一页。
        const pg = w0 && w0.page;
        if (pg && pg.title && onWatchSend) { try { onWatchSend(char, where, pg.title, "", Object.assign({}, pg, { act: "send" })); } catch (e) {/* 同上 */} }
      }
      else if (where === "tally" && text) {
        // 账本：记在【TA此刻翻开的那一栏】里（五栏字段各不相同，落盘那头按 tab 分流）
        if (onWatchSend) { try { onWatchSend(char, "tally", (w0 && w0.item) || "", text, { act: "send", tab: (w0 && w0.tab) || "debts" }); } catch (e) {} }
        setWatch(w => w ? { ...w, typing: "" } : w);
      }
      else if (text) {
        // 边演边落（她 2026-09-10 定的）：看到一半退出去，TA已经做过的就是做过了。
        // ⚠️先落盘再决定要不要挂气泡：发给【她】的那一条落进的是真聊天，
        //   而她那条聊天在这一屏上是活的——再挂一条演出用的气泡，同一句话就出现两遍
        //   （她 2026-09-10 抓到的）。落盘那头回一个「真」字，这儿据此让路。
        let toReal = false;
        if (onWatchSend) { try { toReal = onWatchSend(char, where, to, text, { act: "send" }) === true; } catch (e) {/* 落盘失败不该把这段演砸 */} }
        // 微信／短信里发出去的那条要当场挂在气泡串上；便签、邮件、阅读是就地改，正文由 drive.typing 顶着
        // ⚠️「谁说的」两屏认的键不一样：微信认 __me__，短信那一屏认的是 "me"（照各自那屏自己的写法来）
        if (!toReal && (where === "wechat" || where === "calls") && to) setWatch(w => w ? { ...w, typing: "", sent: (w.sent || []).concat([{ from: where === "calls" ? "me" : "__me__", text: text }]) } : w);
        else if (toReal) setWatch(w => w ? { ...w, typing: "" } : w);
      }
    }
    else if (a.kind === "type") {
      // 逐字打：底稿在开始那一刻定死，后面每一拍只往后接一个字
      const full = String(a.text || "");
      const base = String((watchRef.current && watchRef.current.typing) || "");
      let n = 0;
      // ⚠️她 2026-09-11：「微信还是会截断」。病根不在字数上限，在【两个节拍不是同一个数】：
      //   往下走那一脚按 actDuration/speed 算，可真正打字那一拍有一道 12 毫秒的地板
      //   （Math.max(12, …)）。开到 2 倍速以后每拍还是 12 毫秒，budget 却被除掉了一半——
      //   时候一到这一步就被推走，清理函数把 typer 清掉，那句话【正好打到一半】。
      //   现在这一下演多久由【真实那一拍】算出来：打完了才往下走。
      const tick = Math.max(12, (WK.typeTick ? WK.typeTick(full) : 90) / speed);
      typeMs = full.length * tick + 160;
      typer = setInterval(() => {
        if (watchRef.current && watchRef.current.paused) return;   // 暂停时连字都不许再往下打
        n += 1;
        setWatch(w => w ? { ...w, typing: base + full.slice(0, n) } : w);
        if (n >= full.length) { clearInterval(typer); typer = null; }
      }, tick);
    }

    // ③ 排下一步
    // ⚠️暂停【不能挂进这个 effect 的 deps】：deps 一变整段 effect 重跑，
    //   这一下的效果就会再做一遍——发出去的再发一次、打过的字再打一遍。
    //   所以暂停只拦【往下走那一脚】：时候到了先看一眼旗子，还举着就每 200ms 再问一次。
    let hold = null;
    const advance = () => {
      if (watchRef.current && watchRef.current.paused) { hold = setTimeout(advance, 200); return; }
      setWatch(w => w ? { ...w, i: w.i + 1, thought: a.kind === "think" ? "" : w.thought } : w);
    };
    const tid = setTimeout(advance, Math.max(120, typeMs || WK.actDuration(a) / speed));
    return () => {
      clearTimeout(tid); if (hold) clearTimeout(hold); if (openTid) clearTimeout(openTid);
      // ⚠️等着翻页的那一下要是没等到就被推走了，在这儿补开——不补的话这一段就卡在主屏
      //   （她 2026-09-11：「卡在主页然后出了个心声」）。go 自己带着「只跑一次」的闸。
      if (openFallback) openFallback();
      if (typer) clearInterval(typer); if (stopDot) stopDot();
    };
    // eslint-disable-next-line
  }, [watch && watch.i, watch && watch.speed, watch && watch.done]);
  // ── 心声自己会退场（她 2026-09-10：「台词显示太久了太碍眼了看不到屏幕」）──
  // 原来它只在【演到下一个 think 那一下】才被清掉：中间隔着十几个动作，那句话就
  // 一直压在屏幕上；敲一下回的那句更糟——它压根等不到下一个 think，能挂到整段结束。
  // 现在按字数给它一条命：读得完就走。
  const thought = watch && watch.thought;
  useEffect(() => {
    if (!thought) return;
    const ms = Math.min(2600, 900 + String(thought).length * 55) / ((watch && watch.speed) || 1);
    // 暂停时这句话得留在屏幕上——她按暂停多半就是为了把它看完（同上，不挂 deps）
    let id = null;
    const bye = () => {
      if (watchRef.current && watchRef.current.paused) { id = setTimeout(bye, 200); return; }
      setWatch(w => (w && w.thought === thought) ? { ...w, thought: "" } : w);
    };
    id = setTimeout(bye, ms);
    return () => clearTimeout(id);
  }, [thought, watch && watch.speed]);
  const startWatch = async () => {
    if (watchBusy || !onWatchStart) return;
    setWatchBusy(true);
    try {
      const acts = await onWatchStart(char);
      if (!watchAliveRef.current) return;
      if (!acts || !acts.length) return;
      setWatch({ acts, i: 0, speed: 1, tab: "chats", chat: null, typing: null, sent: [], thought: "", knocks: 0, knocking: false, paused: false, done: false });
      setDot(null);
      // 让别的浮层（秋秋那颗球）让开——这一屏扮的是TA的手机
      if (onWatching) onWatching(true);
    } finally { setWatchBusy(false); }
  };
  const endWatch = () => { setWatch(null); setDot(null); setOpen(null); setLocked(true); if (onWatching) onWatching(false); };
  const doKnock = async () => {
    const w = watchRef.current;
    if (!w || w.knocking || !onWatchKnock || WK && WK.knockOver(w.knocks)) return;
    setWatch(p => p ? { ...p, knocking: true } : p);
    try {
      // 第三下TA可能真的给她发了一条微信：那一下回的是 {say, wx}，别的时候还是一句话。
      // ⚠️那条消息在 app.js 那头就已经【真的发出去】了（走 watchSend 的真聊天路径），
      //   这儿只负责让她知道——不然她要退出去翻聊天才发现TA刚跟她说了话。
      const got = await onWatchKnock(char, (w.knocks || 0) + 1, w.acts[w.i] || null);
      const say = (got && typeof got === "object") ? String(got.say || "") : got;
      const sentWx = (got && typeof got === "object") ? String(got.wx || "").trim() : "";
      if (sentWx && onWatchToast) onWatchToast("TA给你发了一条：" + sentWx.slice(0, 24));
      // 真出声了才算这一下：没出声还扣次数，就是「敲了没反应，还少一下」
      setWatch(p => {
        if (!p) return p;
        const n = (p.knocks || 0) + (say ? 1 : 0);
        // 敲完TA真的会变一下：往【当前这一下后面】插一段停住（第三下起还会把
        // 手上打了一半那句删光）。⚠️只插不删——截掉剩下的动作会把本该落盘的演漏。
        // 那一句心声跟着这一段一起演，不再直接压在 thought 上：走同一条退场路，
        // 才不会一句话挂到整段结束（她 9-10 报过的那条）。
        const beat = (say && WK && WK.knockBeat) ? WK.knockBeat(n, say, p.typing) : [];
        return beat.length
          ? { ...p, acts: WK.spliceBeat(p.acts, p.i, beat), knocks: n, knocking: false }
          : { ...p, knocks: n, knocking: false, thought: say || p.thought };
      });
    } catch (e) {
      setWatch(p => p ? { ...p, knocking: false } : p);
      // ⚠️失败必须说出来。一声不响就是她看到的那个「卡住了一直没反应」。
      if (onWatchToast) onWatchToast("没敲动：" + (e && e.message ? e.message : "再试一下"));
    }
  };

  // 桌面上那只表要走针。半分钟对一次就够——画秒针的话整页每秒重渲染，不值。
  // ⚠️跟上面那些 hook 一样，必须待在所有 return 上面（见下面那条 #310 的教训）。
  const [deskNow, setDeskNow] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setDeskNow(Date.now()), 30000); return () => clearInterval(iv); }, []);
  const deskRef = useRef(null);
  // 点进 app 时桌面整个卸载，回来重挂就在第一页了——每次都得再翻一遍
  //（她 2026-08-29：「每次都得翻回来好累」）。回来后按记着的页码归位。
  const deskPageRef = useRef(0);
  deskPageRef.current = deskPage;
  const [inList, setInList] = useState(true); // 先看通讯录列表，点某人才进 Ta 的手机
  // ⚠️必须declare在下面那个 effect 之前：const 有暂时性死区，effect 体里引用它
  // 而它在下面才声明的话，一渲染就抛 ReferenceError 整页白。
  const [lookOpen, setLookOpen] = useState(false);
  // 数据设置（清空重生 / 写哪种语言）跟外观一样是【整页顶掉桌面】的，所以同一条规矩：
  // declare 在下面那个 effect 之前，并且写进它的依赖里，不然退回来又弹到第一页。
  const [dataOpen, setDataOpen] = useState(false);
  // ⚠️这个 effect 必须待在所有 return 上面。它原来写在函数中段（通讯录那个 return
  // 之后），于是列表页少调一次 hook、桌面页多调一次——从列表点进某人手机的那一下，
  // React 数出来的 hook 变多了，直接抛 #310 整页白（她 2026-08-29：查手机页面直接崩了）。
  // 提前 return 的组件里，hook 一律排在最前面，条件写进 effect 体内。
  // ⚠️lookOpen 也要在这儿。外观设置是【整页顶掉桌面】的（if (lookOpen) return …），
  // 退回来时那个横滑容器是新挂的，scrollLeft 从 0 开始；这个 effect 的依赖里
  // 没有它，就不会重跑，于是永远弹回第一页——她 2026-09-01：「外观退出去又跳回第一页」。
  // 而外观那一格恰好只摆在最后一页，等于每次退出来都跑到离它最远的地方。
  useEffect(() => {
    if (open || inList || lookOpen || dataOpen || !deskRef.current) return;
    const n = deskPageRef.current;
    if (!n) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (deskRef.current) deskRef.current.scrollLeft = deskRef.current.clientWidth * n;
    }));
  }, [open, inList, lookOpen, dataOpen]);
  // 锁屏：拿起TA手机的第一眼，不该直接是一片图标网格
  const [locked, setLocked] = useState(true);
  // 外观只存小引用；图片本体进图片金库。按角色分桶，谁的手机就只改谁。
  const [phoneLooks, setPhoneLooks] = useState(phoneLooksBoot);
  // 「我收着的」——她自己留的那些，只给她自己看，不进任何上下文。
  // 转发是摆到TA面前，收着是我自己留一份：两件事。
  const [kept, setKept] = useState(() => phoneTlKeepLoad());
  // 桌面顶部的全局搜索。在TA手机里搜自己的名字，是所有偷看动作里最真的一个。
  const [q, setQ] = useState("");
  // delta 账本：上次翻完时手机上有哪些条目。x_phoneMark[charId].ids = { 指纹: 1 }
  // 指纹只由内容决定（见 phoneEntryId），所以TA没动的东西不会因为你又翻了一次就变新。
  const [mark, setMark] = useState(() => loadJSON("x_phoneMark", {}));
  // 绿点 = 有数据且还没看过；打开即消，刷新全部时重新点亮
  const [seen, setSeen] = useState(() => loadJSON("x_phoneSeen", {}));
  const isSeen = (cid, k) => !!(seen[cid] && seen[cid][k]);
  const markSeen = (cid, k) => setSeen(p => { const n = { ...p, [cid]: { ...(p[cid] || {}), [k]: true } }; saveJSON("x_phoneSeen", n); return n; });
  const clearSeen = cid => setSeen(p => { const n = { ...p }; delete n[cid]; saveJSON("x_phoneSeen", n); return n; });
  const allNowKey = String(busyKey || "").indexOf("__all__") === 0 ? (String(busyKey).split(":")[1] || "__all__") : null;
  const isAllRun = String(busyKey || "").indexOf("__all__") === 0;
  const char = characters.find(c => c.id === selId) || characters[0];
  phoneViewTa(char);   // 同上：列表页的标签也跟着选中的这位走
  // 进了谁的手机就放TA那张歌单，退出去还回她原来在听的（她 2026-09-06：
  // 「查手机也改成和情侣空间一样点进去就会播放吧」）。落针/收针那套礼数全在
  // app.js 的 roomMusicEnter/Leave 里（和情侣唱片共用一份），这儿只负责喊人。
  // ⚠️只在【真进了某个人的手机】时落针：还在通讯录那一屏不算——那是名单，不是TA的手机。
  // ⚠️这个 effect 必须待在所有 return 上面（这一份文件里已经因为这条摔过两次：
  //   列表页少调一次 hook，从列表点进某人手机那一下 React 直接抛 #310 整页白）。
  const inPhoneOf = !inList && char ? char.id : null;
  useEffect(() => {
    if (!inPhoneOf || !onPhoneMusicEnter) return;
    onPhoneMusicEnter(inPhoneOf);
    return () => { if (onPhoneMusicLeave) onPhoneMusicLeave(inPhoneOf); };
  }, [inPhoneOf]);
  const look = char ? (phoneLooks[char.id] || {}) : {};
  const patchLook = patch => {
    if (!char) return;
    setPhoneLooks(prev => {
      const next = { ...prev, [char.id]: { ...(prev[char.id] || {}), ...patch } };
      saveJSON("x_phoneLooks", next);
      return next;
    });
  };
  if (!char) return h("div", { "data-wk": "phoneapppage", "data-part": "phonecarry",
    className: "h-full flex flex-col"
  }, h(Head, {
    zh: "查手机",
    en: "Inspect",
    onBack
  }), h(Empty, {
    text: "还没有角色",
    sub: "先去人格档案馆录入一位"
  }));
  // 通讯录列表：做成一块「手机屏」——顶部我的头像+通讯录，下面角色列表在屏内下滑；点某人才进 Ta 的手机
  if (inList) {
    const p = profile || {};
    const meAv = { name: p.name || "我", avatarImage: p.avatarImage, color: p.color || t.accent };
    // 这一页正中摆的是一块「手机屏」——手机是摆在【桌上】的，所以外壳该是张桌子，
    // 不是一片米白（顶栏跟着透上来，不然顶上横一条没盖住的带子）
    return h("div", { "data-wk": "phonepage", "data-view": "list", className: "h-full flex flex-col", style: pageSkin("wood", t, { corner: false }) },
      // 紧凑标题栏（施工规则/mobile-ui-layout.md §1），不再顶一块 30px 大标题
      h(Head, { zh: "查手机",
        bg: "transparent",
        noLine: true,
        onBack: onBack }),
      h("div", { className: "flex-1 min-h-0 px-4 pb-6" },
        h("div", { "data-wk": "block", className: "h-full flex flex-col rounded-[30px] overflow-hidden", style: { background: "linear-gradient(180deg,#fbfaf7,#f1eee7)", border: "1px solid " + t.line, boxShadow: "0 12px 34px rgba(0,0,0,0.10)" } },
          // 手机顶栏：我的头像 + 通讯录
          h("div", { className: "shrink-0 flex items-center gap-3 px-5 pt-6 pb-4", style: { borderBottom: "1px solid " + t.line } },
            h(Avatar, { character: meAv, size: 50, radius: 999 }),
            h("div", { className: "flex-1 min-w-0" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.1 } }, "通讯录"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 3 } }, characters.length + " 个人"))),
          // 每周刷新正在跑：一次唤起会把这一周欠的人连着刷完，一个人十几次串行调用。
          // 中间那几分钟不摆出来的话，看起来跟卡住了一模一样。
          weekAt ? h("div", {
            className: "shrink-0 flex items-center gap-2 px-5 py-2",
            style: { background: "rgba(0,0,0,.035)", borderBottom: "1px solid " + t.line }
          },
            h("span", { className: "shrink-0", style: { width: 6, height: 6, borderRadius: 999, background: t.accent } }),
            h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
              "每周刷新中 · 正在刷「" + weekAt.name + "」"),
            h("div", { className: "shrink-0", style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } }, weekAt.i + "/" + weekAt.n)) : null,
          // 角色列表：在手机屏内下滑
          h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 py-1" },
            characters.map(c => h("div", {
              key: c.id, "data-wk": "phonerow", "data-id": c.id, className: "w-full flex items-center gap-3", style: { borderBottom: "1px solid " + t.line }
            },
              h("button", {
                onClick: () => { onSel(c.id); setOpen(null); setLocked(true); setInList(false); },
                className: "flex-1 min-w-0 flex items-center gap-3 py-3 active:opacity-60 text-left"
              },
                h(Avatar, { character: c, size: 44, radius: 13 }),
                h("div", { className: "flex-1 min-w-0" },
                  h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name),
                  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 1 } },
                    weekAt && weekAt.id === c.id ? "正在刷新……" : phoneLastAllLabel((lastAll || {})[c.id])))),
              // ⚠️这儿【只标不开】（她 2026-09-06：「不应该那里有按钮，设置里面都已经开了一次了」）。
              // 原来这是个开关，和 设置·自动刷新 里那一份是【同一个总闸的两个手柄】：
              // 一个东西两处能拧，她在设置里开过之后，这一行看着还像没开、顺手一点就变成了
              // 「开了又关」——而每周刷新一开就是十几次调用，她按次计费。
              // 一个开关只留一处（设置里那处是统一的、和别的自动刷新排在一起）；
              // 这儿保留一枚不能点的标，好让「这是谁的手机」和「TA开着每周刷新」还在同一屏上。
              (autoOn || {})[c.id] ? h("span", {
                className: "shrink-0",
                title: "每周自动刷新已开（在 设置 · 自动刷新 里改）",
                style: {
                  fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", padding: "4px 10px", borderRadius: 99,
                  background: t.ink, color: t.bg
                }
              }, "每周") : null,
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(20px * var(--app-fs, 1))", color: t.fog, flexShrink: 0 } }, "\u203a")))))));
  }
  if (lookOpen) return h(PhoneLookSettings, { char, look, onPatch: patchLook, onBack: () => setLookOpen(false), t });
  if (dataOpen) return h(PhoneDataSettings, {
    char, t, look, lang, onLang,
    saved: phones[char.id] || {},
    onReset: k => onResetApp && onResetApp(char.id, k),
    onBack: () => setDataOpen(false)
  });
  const data = phones[char.id] || {};
  // 真数据这两个不看 phones，看 App 里那份真的
  const liveForum = forumAccountsFor ? forumAccountsFor(char) : null;
  const livePlaylist = playlistFor ? playlistFor(char.id) : null;
  const liveCtx = {
    forumAccounts: liveForum,
    playlist: livePlaylist,
    onGenPlaylist: () => onGenPlaylist && onGenPlaylist(char),
    playlistBusy: playlistBusyId === char.id,
    onPlaySong: s => onPlaySong && onPlaySong(s),
    // 日历接 App 里那份真的：TA自己那格日历 + 带时刻的日程 + TA答应过她的事
    calendar: calendarFor ? calendarFor(char) : null,
    // 健康的每日快照（趋势）。报告本身照旧每次重写，这一条是另存的轻量线。
    vitals: vitalsFor ? vitalsFor(char.id) : null,
    // 本月消费/单数以钱包流水为准，不用模型编的那两个数
    monthStats: monthStatsFor ? monthStatsFor(char) : null,
    // 匿名信箱沿用主 App 的 x_anon：同一个马甲、同一批问答、同一份删除结果。
    anon: anonFor ? anonFor(char.id) : {},
    anonBusy: !!anonBusy,
    onRefreshAnonPersona: () => onRefreshAnonPersona && onRefreshAnonPersona(char),
    onGenAnonQuestion: () => onGenAnonQuestion && onGenAnonQuestion(char),
    onAskAnon: q => onAskAnon && onAskAnon(char, q),
    onDelAnonRecord: ts => onDelAnonRecord && onDelAnonRecord(char.id, ts),
    // 她在TA手机上以TA的名义真的发一条（只有真实会话给这条口子，见 app.js phoneSendAs）
    onSendAs: (sess, text) => onSendAs ? onSendAs(char, sess, text) : false,
    onTransferAs: onTransferAs ? (sess, amt, note, toId, opt) => onTransferAs(char, sess, amt, note, toId, opt) : null,
    onTfReplyAs: onTfReplyAs ? (tid, ok) => onTfReplyAs(char, tid, ok) : null,
    transferPeers: sess => transferPeers ? transferPeers(char, sess) : [],
    onShopAs: onShopAs ? where => onShopAs(char, where) : null,
    sendAsWaiting: sendAsWaiting || "",
    // 没有 onRemark 就别给一个空函数：微信那页拿它的真假决定要不要露「›」
    onRemark: onRemark ? (ch, c, v) => onRemark(ch, c, v) : null,
    onDelFriend: onDelFriend ? (ch, name, undo) => onDelFriend(ch, name, undo) : null,
    onDissolve: onDissolve ? (ch, name, undo) => onDissolve(ch, name, undo) : null,
    onBlockFriend: onBlockFriend ? (ch, name, undo) => onBlockFriend(ch, name, undo) : null,
    // 偷看转发：手机里的东西只有【转发了】才进TA的上下文（她 2026-08-29 定的）
    onPeek: pk => onPeek && onPeek(char, pk),
    // 相册里【我收着的】那几张可以真画出来（v59.59）。drawing 存的是正在画的那张
    // 的指纹，不是 true/false——同屏两张的按钮不能一起转圈。
    onDrawPhoto: (photo, key, override) => onDrawPhoto && onDrawPhoto(char, photo, key, override),
    onPhotoEdit: items => onPhotoEdit && onPhotoEdit(char, items),
    drawing: drawingPhoto || ""
  };
  // ── 时间线 + delta ──────────────────────────────────────────
  // 时间线不生成任何东西：它把上面那些 app 已经翻出来的碎片按时间串起来。
  // delta 就是「这一串里，上次翻完之后才出现的那些」。
  const tlRows = phoneTimelineWithArchive(data, liveCtx, (archives || {})[char.id], Date.now());
  const seenIds = (mark[char.id] || {}).ids || {};
  const newIds = {};
  let newCount = 0;
  tlRows.forEach(r => { if (!seenIds[r.id]) { newIds[r.id] = 1; newCount++; } });
  // 记账本封顶：只留最近这一批的指纹。手机内容本来就是滚动覆盖的，
  // 留着几千条早就不存在的指纹只会把 localStorage 撑爆。
  const MARK_CAP = 900;
  const markRead = ids => {
    if (!ids || !ids.length) return;
    setMark(p => {
      const cur = (p[char.id] || {}).ids || {};
      const merged = { ...cur };
      ids.forEach(id => { merged[id] = 1 });
      const keys = Object.keys(merged);
      const kept = keys.length > MARK_CAP ? keys.slice(keys.length - MARK_CAP) : keys;
      const box = {};
      kept.forEach(k => { box[k] = 1 });
      const n = { ...p, [char.id]: { ids: box, at: Date.now() } };
      saveJSON("x_phoneMark", n);
      return n;
    });
  };
  const markAppRead = k => markRead(tlRows.filter(r => r.app === k).map(r => r.id));
  const keptIds = (kept || {})[char.id] || {};
  const toggleKeep = id => setKept(p => {
    const box = { ...((p[char.id]) || {}) };
    if (box[id]) delete box[id]; else box[id] = 1;
    const n = { ...p, [char.id]: box };
    saveJSON("x_phoneTlKeep", n);
    return n;
  });
  // 搜索：不调模型。时间线已经把各 app 的碎片规范化了，再补上它不收的那几栏。
  const searchExtra = phoneSearchExtra(data, liveCtx);
  const hits = q.trim() ? phoneSearch(tlRows, searchExtra, q) : [];
  const liveCount = k => {
    if (k === "forum") return (liveForum || []).reduce((n, a) => n + (a.posts || []).length + (a.comments || []).length, 0);
    if (k === "music") return ((livePlaylist && livePlaylist.songs) || []).length;
    if (k === "calendar") return ((liveCtx.calendar || {}).items || []).length;
    if (k === "anon") return ((liveCtx.anon || {}).records || []).length || ((liveCtx.anon || {}).netname ? 1 : 0);
    if (k === "timeline") return tlRows.length;
    return 0;
  };
  const hasData = a => PHONE_LIVE_KEYS.indexOf(a.key) >= 0 ? liveCount(a.key) > 0
    : data[a.key];
  const appByKey = k => PHONE_APPS.find(a => a.key === k);
  // 外观设置那一格：长得跟别的 app 图标一模一样，只是点开进的是设置。
  const lookIcon = () => {
    const preset = look.iconPreset || "own";
    const iconBg = preset === "own" ? "rgba(255,255,255,.62)"
      : preset === "mono" ? "linear-gradient(145deg,#f4f2ed,#d8d5ce)"
        : preset === "glass" ? "rgba(255,255,255,.38)" : phoneTone("settings").wash;
    const glyph = preset === "own" ? phoneOwnInk(char && char.id) : preset === "mono" ? "#4d4b47" : phoneTone("settings").glyph;
    return h("button", {
      key: "__look", "data-wk": "phoneicon", "data-app": "__look", onClick: () => setLookOpen(true),
      className: "flex flex-col items-center active:opacity-60", style: { gap: 7, minWidth: 0 }
    },
      h("div", { className: "relative flex items-center justify-center",
        style: { width: 56, height: 56, borderRadius: 17, background: iconBg, boxShadow: preset === "own" ? "0 6px 16px rgba(40,50,45,.13),inset 0 0 0 1px rgba(255,255,255,.55)" : "0 8px 22px rgba(28,25,20,.10)" } },
        (phoneImage(look.icons && look.icons["__look"]) ? h("img", { src: phoneImage(look.icons["__look"]), alt: "", style: { width: "100%", height: "100%", objectFit: "cover", borderRadius: 17 } }) : h(PGlyph, { k: "settings", size: 24, color: glyph }))),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: preset === "own" ? phoneOwnInk(char && char.id) : t.sub, textAlign: "center" } }, "外观"));
  };
  // 数据那一格：跟外观并排，长得也一样。清空重生和「写哪种语言」都在里面。
  const dataIcon = () => {
    const preset = look.iconPreset || "own";
    const iconBg = preset === "own" ? "rgba(255,255,255,.62)"
      : preset === "mono" ? "linear-gradient(145deg,#f4f2ed,#d8d5ce)"
        : preset === "glass" ? "rgba(255,255,255,.38)" : phoneTone("notes").wash;
    const glyph = preset === "own" ? phoneOwnInk(char && char.id) : preset === "mono" ? "#4d4b47" : phoneTone("notes").glyph;
    return h("button", {
      key: "__data", "data-wk": "phoneicon", "data-app": "__data", onClick: () => setDataOpen(true),
      className: "flex flex-col items-center active:opacity-60", style: { gap: 7, minWidth: 0 }
    },
      h("div", { className: "relative flex items-center justify-center",
        style: { width: 56, height: 56, borderRadius: 17, background: iconBg, boxShadow: preset === "own" ? "0 6px 16px rgba(40,50,45,.13),inset 0 0 0 1px rgba(255,255,255,.55)" : "0 8px 22px rgba(28,25,20,.10)" } },
        (phoneImage(look.icons && look.icons["__data"]) ? h("img", { src: phoneImage(look.icons["__data"]), alt: "", style: { width: "100%", height: "100%", objectFit: "cover", borderRadius: 17 } }) : h(PGlyph, { k: "notes", size: 24, color: glyph }))),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: preset === "own" ? phoneOwnInk(char && char.id) : t.sub, textAlign: "center" } }, "数据"));
  };
  // 「看TA玩」那一层罩子：触控圆点 / TA心里那一句 / 底下那条。
  // 三处 return（app 里、锁屏、桌面）都套同一个——各写一份的话，改一处另两处必然落单。
  const watchSkin = view => {
    if (!watch || !WK) return view;
    // ⚠️底下那条会把正在打字的那一栏压住（真机上看见的）。给正文让出一条的高度，
    //   别让「TA打了又删」那一下正好被自己的控制条挡掉——那是这个功能最戳人的一眼。
    // ⚠️原来这儿给正文让出 54px（怕底下那条压住正在打字的那一栏）。可她 2026-09-10 说
    //   「按键是实的会把手机屏幕往上推一节」——让位＝手机变矮了一截，那才是真穿帮：
    //   TA的手机不会因为她在看就少一块。改成真悬浮：这一条压在屏幕上，一个像素都不占。
    //   压住打字那一栏的问题另解：把它收窄压扁，并且演到打字那几下自己让路（变淡）。
    return h(React.Fragment, null,
      h("div", { style: { height: "100%" } }, view),
      h("div", { style: { position: "fixed", inset: 0, zIndex: 55, pointerEvents: "none" } },
        h(WK.WatchDot, dot || {}),
        h(WK.WatchThought, { text: watch.thought, zh: watch.thoughtZh })),
      h("div", { style: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 56 } },
        h(WK.WatchBar, {
          char,
          // TA正在打字（或者刚打完还没发）的时候这一条让路——那一眼是这个功能最戳人的
          // 一下，不能被自己的控制条挡掉。手指按上去它就亮回来。
          dim: watch.typing != null && !watch.done && !barWake,
          onWake: () => { setBarWake(true); setTimeout(() => setBarWake(false), 2600); },
          t, i: watch.i, total: watch.acts.length, done: watch.done, speed: watch.speed,
          knocks: watch.knocks, knocking: watch.knocking, paused: watch.paused,
          onSpeed: () => setWatch(w => w ? { ...w, speed: w.speed >= 4 ? 1 : w.speed * 2 } : w),
          // 暂停（她 2026-09-10 那批里的第 ⑦ 条）：TA打了一句又删掉、心声一闪而过，
          // 原来想看清楚只能按 1× 或者错过。⚠️「跳到最后」要顺手放开暂停，
          // 否则按了没反应——暂停着的时候倍速再快也不往下走。
          onPause: () => setWatch(w => w ? { ...w, paused: !w.paused } : w),
          onSkip: () => setWatch(w => w ? { ...w, speed: 8, paused: false } : w),
          onKnock: doKnock,
          onClose: endWatch
        })));
  };

  const openApp = a => {
    if (!a || a.soon) return;
    // 原来的匿名正门首次打开会自动准备马甲；从查手机进也保持同一体验。
    if (a.key === "anon" && !(liveCtx.anon || {}).netname && !anonBusy && onRefreshAnonPersona) {
      onRefreshAnonPersona(char);
    }
    markSeen(char.id, a.key);
    // 桌面绿点和时间线的「新」得是同一件事——不然她明明刚在便签里读完，
    // 时间线里那几条还标着新，两处对不上。
    if (a.key !== "timeline") markAppRead(a.key);
    setOpen(a.key);
  };
  const latestLine = (value, fallback) => {
    if (!value) return fallback;
    const pool = value.chats || value.items || value.songs || value.apps || value.week;
    const x = Array.isArray(pool) && pool[0];
    return String((x && (x.last || x.title || x.caption || x.name || x.transcript || x.content || x.text || (x.day && x.hours != null ? x.day + " 睡了 " + x.hours + " 小时" : ""))) || value.desc || value.playlist || value.weekNote || fallback);
  };
  const appIcon = (a, compact) => {
    const custom = phoneImage(look.icons && look.icons[a.key]);
    const tone = phoneTone(a.key);
    const preset = look.iconPreset || "own";
    // own：深底上一块半透明浅玻璃——玻璃这时候才成立（底下真有东西可透）
    const iconBg = preset === "own" ? "rgba(255,255,255,.62)"
      : preset === "mono" ? "linear-gradient(145deg,#f4f2ed,#d8d5ce)"
        : preset === "glass" ? "rgba(255,255,255,.38)"
          : preset === "soft" ? "linear-gradient(rgba(255,255,255,.46),rgba(255,255,255,.46))," + tone.wash
            : tone.wash;
    const glyph = preset === "own" ? phoneOwnInk(char && char.id) : preset === "mono" ? "#4d4b47" : tone.glyph;
    return h("button", {
    key: a.key, "data-wk": "phoneicon", "data-app": a.key,
    // 「看TA玩」的圆点要落在这上面。⚠️原来一个 app: 挂点都没有，于是【点开一个 app】
    //   这个最常见的动作永远不动圆点（她 2026-09-10：「整体光标都不会移动」）。
    "data-watch": "app:" + a.key,
    onClick: () => openApp(a),
    className: "flex flex-col items-center active:opacity-60",
    style: { gap: compact ? 3 : 7, minWidth: 0 }
  }, h("div", {
    className: "relative flex items-center justify-center",
    style: {
      width: compact ? 44 : 56,
      height: compact ? 44 : 56,
      borderRadius: compact ? 13 : 17,
      background: custom ? "rgba(255,255,255,.72)" : iconBg,
      border: "1px solid rgba(255,255,255,.72)",
      boxShadow: preset === "glass" ? "0 8px 22px rgba(28,25,20,.06),inset 0 0 0 1px rgba(255,255,255,.30)" : "0 8px 22px rgba(28,25,20,.10)",
      overflow: "hidden"
    }
  }, custom ? h("img", { src: custom, alt: "", style: { width: "100%", height: "100%", objectFit: "cover" } })
    : h(PGlyph, { k: a.key, size: compact ? 22 : 27, color: glyph }),
    // 还没生成过的 app 右下角一个空心圈：点进去不会自己生成，要按了才调模型（群友 2026-10-09）
    PHONE_LIVE_KEYS.indexOf(a.key) < 0 && !data[a.key] && h("span", { "data-wk": "phonenotyetdot", "aria-label": "还没生成",
      style: { position: "absolute", bottom: 3, right: 3, width: 9, height: 9, borderRadius: 9, border: "1.5px dashed rgba(60,55,48,.55)", background: "rgba(255,255,255,.8)" } }),
    hasData(a) && !isSeen(char.id, a.key) && h("span", {
    style: {
      position: "absolute", top: -3, right: -3, width: 10, height: 10,
      borderRadius: 9, background: "#78bd58", border: "2px solid rgba(255,255,255,.95)"
    }
  })), h("span", {
    // ⚠️dock 那排也要写名字。浏览器在四套布局里有三套只在 dock，没有名字就等于
    // 这个 app 不存在（她 2026-08-29：「我的查手机浏览器怎么找不到了」）。
    // iOS 的 dock 不写字，但这不是 iOS，是「翻TA手机」——找得到比像不像重要。
    style: {
      width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      // 图标名也跟着底走：底自成一套色，名字还用她那套墨，一屏上就有两种黑
      fontFamily: F_BODY, fontSize: compact ? 9.5 : 11,
      color: preset === "own" ? phoneOwnInk(char && char.id) : t.ink,
      textShadow: compact ? "none" : "0 1px 8px rgba(255,255,255,.85)"
    }
  }, a.zh));
  };
  if (open) return watchSkin(h(PhoneApp, {
    appKey: open,
    char,
    charData: data,
    // 全刷时 busyKey 是 "__all__:当前那个 key"。以前不分是谁，一律当成「打开的这个正在生成」，
    // 于是全刷期间随便点哪个 app 都是一个转不完的圈，看起来就像卡死了（她 2026-08-29 报音乐打不开）。
    busyKey: allNowKey || busyKey,
    onGen: onGenApp,
    profile,
    actualWechat: actualWechatFor ? actualWechatFor(char) : [],
    actualMoments: actualMomentsFor ? actualMomentsFor(char) : [],
    live: {
      ...liveCtx,
      nowSongId,
      timelineRows: tlRows, newIds, newCount,
      kept: keptIds, onToggleKeep: toggleKeep,
      onMarkRead: () => markRead(tlRows.map(r => r.id)),
      onOpenApp: k => { const a = appByKey(k); if (a) openApp(a); }
    },
    // 一份 drive 递给所有被驱动的 app（微信／相册／便签各取所需）——
    // 各拼一份的话，第三批加浏览器又要在这儿多一支（一层写在多处）。
    drive: watch ? { tab: watch.tab, item: watch.item, page: watch.page, typing: watch.typing, searchQ: watch.searchQ,
      // sent 里两种人：TA自己发的（右侧绿气泡）和对面回的
      // ⚠️「TA自己」在两屏上叫的名字不一样：微信按头像认人，所以要换成TA的微信昵称；
      //   短信那一屏认的是死字符串 "me"（照各自那屏自己的写法来）。
      //   原来这儿一律换成昵称——于是短信里TA自己发的那条被画成了对面的灰气泡（真机上抓到的）。
      sent: (watch.sent || []).map(x => ({
        from: x.them ? x.from : (x.from === "me" ? "me" : ((data.wechat && data.wechat.me && data.wechat.me.wechatName) || char.name)),
        text: x.text, _new: true })) } : null,
    onBack: () => setOpen(null)
  }));
  if (locked) return watchSkin(h(LockScreen, {
    char, t, rows: tlRows, newIds, newCount, look,
    onUnlock: () => setLocked(false),
    onTimeline: () => { setLocked(false); setOpen("timeline"); },
    onOpenApp: k => { setLocked(false); const a = appByKey(k); if (a) openApp(a); }
  }));
  const homeSrc = phoneImage(look.homeWallpaper);
  const layout = phoneDesktopLayout(char);
  const widgetData = key => data[key];
  const widgetCopy = key => {
    const fallback = {
      wechat: "点开看看最近和谁说过话", notes: "最近没有留下新备忘", browser: "最近没有浏览记录",
      music: T("他还没有歌单"), album: "相册还没翻过", bili: "最近没有观看记录", latenight: "深夜台还是空的",
      forum: T("论坛上还没有他的痕迹"), reading: "最近没在读什么", liked: "还没点过什么",
      health: "还没有健康记录", clipboard: "剪贴板是空的", calendar: "日历上没有安排", takeout: "最近没点过吃的",
      timeline: "先刷一遍手机，这里才串得起来", tally: T("他还没记这本账"), mail: "邮箱还没翻过",
      anon: "匿名箱里还没有问答"
    }[key] || "还没有内容";
    // 真数据这几个走自己那份，不然桌面小组件永远显示兜底话
    if (key === "timeline") {
      // 小组件说的是「TA最近干了什么」，不是待办清单，所以跳过还没发生的那几条
      const r = tlRows.find(x => !x.ahead) || tlRows[0];
      if (!r) return fallback;
      return (newCount > 0 ? newCount + " 条新的 · " : "") + (r.ts == null ? "" : phoneClock(r.ts) + " ") + (r.title || r.text || "");
    }
    if (key === "calendar") {
      const ci = ((liveCtx.calendar || {}).items || [])[0];
      return ci ? (ci.date ? String(ci.date).replace(/^\d{4}-/, "") + " " : "") + ci.title : fallback;
    }
    if (key === "music") {
      const sgs = (livePlaylist && livePlaylist.songs) || [];
      const sg = (nowSongId && sgs.find(x => x && x.id === nowSongId)) || sgs[0];
      return sg ? (livePlaylist.name || "歌单") + " · " + sg.title : fallback;
    }
    if (key === "forum") {
      const all = (liveForum || []).reduce((a, x) => a.concat((x.posts || []).map(p => ({ ts: p.ts, s: p.title })), (x.comments || []).map(c => ({ ts: c.ts, s: c.text }))), []);
      const last = all.sort((a, b) => b.ts - a.ts)[0];
      return last ? String(last.s || "").slice(0, 40) : fallback;
    }
    return latestLine(widgetData(key), fallback);
  };
  // ── 桌面组件的长相 ───────────────────────────────────────────
  // 以前所有组件共用一套：一行灰标签 + 一行黑字。音乐、健康、相册、日历长得一模一样，
  // 摆四个上去就是四个一样的白盒子，谁是谁得读字才知道（她 2026-08-30 报的就是这个）。
  // 下面给认得出来的那几个各自的样子；剩下的还走那套通用的（它们本来也只有一句话可说）。
  const wRows = k => { const d = data[k]; if (!d || typeof d !== "object") return [];
    const arr = ["items", "chats", "history", "photos", "inbox", "orders", "cart", "timeline", "posts"]
      .map(x => Array.isArray(d[x]) ? d[x] : null).filter(Boolean)[0];
    return Array.isArray(arr) ? arr.filter(x => x && typeof x === "object") : []; };
  const wText = x => ["title", "subject", "name", "text", "preview", "main", "shop", "caption", "q"]
    .map(k => (x && typeof x[k] === "string") ? x[k].trim() : "").filter(Boolean)[0] || "";
  const wTime = x => ["time", "at", "date", "when"].map(k => (x && typeof x[k] === "string") ? x[k].trim() : "").filter(Boolean)[0] || "";
  const dimOn = dark => dark ? "rgba(255,255,255,.55)" : t.fog;
  const inkOn = dark => dark ? "#fff" : t.ink;

  function deskBody(key, dark, hero) {
    const dim = dimOn(dark), ink = inkOn(dark);
    const line = (s2, size, weight) => h("div", { style: { fontFamily: F_DISPLAY, fontSize: size || 14, color: ink, lineHeight: 1.4, fontWeight: weight || 400, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, s2);
    const small = s2 => h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: dim, marginTop: 4 } }, s2);

    // 表：走针的模拟表盘，纯装饰，不读任何数据
    if (key === "clock") {
      const d = new Date(deskNow), mm = d.getMinutes(), hh = d.getHours() % 12 + mm / 60;
      const hand = (deg, len, w2, col) => h("div", { style: { position: "absolute", left: "50%", bottom: "50%", width: w2, height: len,
        background: col, borderRadius: 9, transformOrigin: "50% 100%", transform: "translateX(-50%) rotate(" + deg + "deg)" } });
      return h("div", { className: "flex items-center justify-center", style: { flex: 1 } },
        h("div", { style: { position: "relative", width: 68, height: 68, borderRadius: 999, border: "1px solid " + (dark ? "rgba(255,255,255,.28)" : "rgba(35,31,25,.16)") } },
          [0, 3, 6, 9].map(n => h("div", { key: n, style: { position: "absolute", left: "50%", top: "50%", width: 1.5, height: 5, background: dim,
            transformOrigin: "50% 0", transform: "translate(-50%,0) rotate(" + (n * 30) + "deg) translateY(26px)" } })),
          hand(hh * 30, 18, 2.6, ink), hand(mm * 6, 25, 1.8, ink),
          h("div", { style: { position: "absolute", left: "50%", top: "50%", width: 5, height: 5, borderRadius: 999, background: ink, transform: "translate(-50%,-50%)" } })));
    }
    // 相框：从TA相册里挑一张。没有真图就按标题生成一块底色——不是占位符，是一张卡片
    if (key === "frame") {
      const ph = wRows("album")[0];
      const cap = ph ? (wText(ph) || "相册") : "相册还没翻过";
      const c1 = strColor(cap), c2 = strColor(cap.slice(1) + "x");
      return h("div", { className: "flex flex-col", style: { flex: 1 } },
        h("div", { style: { height: 74, borderRadius: 15, marginTop: 8, background: "linear-gradient(150deg," + c1 + "cc," + c2 + "88)" } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: dim, marginTop: 9 } }, cap));
    }
    // 一句话：把TA自己写过的一句放大。挑最长的那句——短的那种「买牛奶」放大了很傻
    if (key === "saying") {
      const pool = [].concat(wRows("notes"), wRows("tally"), wRows("latenight"))
        .map(x => (x.body && String(x.body).trim()) || wText(x)).filter(x => x && x.length >= 6);
      const said = pool.sort((a2, b2) => b2.length - a2.length)[0] || "";
      return h("div", { className: "flex flex-col justify-center", style: { flex: 1 } },
        h("div", { style: { fontFamily: "Georgia,'Noto Serif SC',serif", fontSize: "calc(26px * var(--app-fs, 1))", lineHeight: .6, color: dim } }, "“"),
        h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.75, color: ink, marginTop: 8,
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } },
          said || T("他还没写下什么")));
    }
    // 时间线：一条竖线串三个点
    if (key === "timeline") {
      const rows = tlRows.filter(x => !x.ahead).slice(0, 3);
      if (!rows.length) return line("先刷一遍手机，这里才串得起来");
      return h("div", { style: { flex: 1 } },
        newCount > 0 ? small(newCount + " 条新的") : null,
        h("div", { style: { position: "relative", paddingLeft: 13, marginTop: 8 } },
          h("div", { style: { position: "absolute", left: 3, top: 5, bottom: 5, width: 1, background: dark ? "rgba(255,255,255,.24)" : "rgba(35,31,25,.14)" } }),
          rows.map((r, i2) => h("div", { key: i2, style: { position: "relative", marginBottom: i2 < rows.length - 1 ? 7 : 0 } },
            h("div", { style: { position: "absolute", left: -13, top: 5, width: 7, height: 7, borderRadius: 999, background: i2 ? dim : ink } }),
            h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: i2 ? dim : ink } },
              (r.ts == null ? "" : phoneClock(r.ts) + "  ") + (r.title || r.text || ""))))));
    }
    // 微信：两条聊天，像真的消息列表
    if (key === "wechat") {
      const rows = ((data.wechat || {}).chats || []).slice(0, hero ? 3 : 2);
      if (!rows.length) return line("点开看看最近和谁说过话");
      return h("div", { style: { flex: 1, marginTop: 4 } }, rows.map((c, i2) =>
        h("div", { key: i2, className: "flex items-center", style: { gap: 9, marginTop: i2 ? 11 : 0 } },
          h("div", { style: { width: 26, height: 26, borderRadius: 9, flexShrink: 0, background: strColor(c.name || i2) } }),
          h("div", { className: "min-w-0", style: { flex: 1 } },
            h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: ink } }, PTX(c.name || "未命名")),
            h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: dim, marginTop: 1 } }, PTX(c.preview || ""))),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: dim, flexShrink: 0 } }, phoneChatWhen(c)))));
    }
    // 音乐：碟 + 曲名 + 一条进度
    if (key === "music") {
      // 正在放的那首优先；这张歌单里没有它（或者压根没在放）才退回第一首
      const sgs = (livePlaylist && livePlaylist.songs) || [];
      const sg = (nowSongId && sgs.find(x => x && x.id === nowSongId)) || sgs[0];
      return h("div", { className: "flex flex-col", style: { flex: 1, marginTop: 6 } },
        h("div", { className: "flex items-center", style: { gap: 12 } },
          h("div", { style: { width: hero ? 46 : 36, height: hero ? 46 : 36, borderRadius: 999, flexShrink: 0,
            background: "radial-gradient(circle at 50% 50%,rgba(255,255,255,.9) 12%," + strColor((sg && sg.title) || "?") + " 14%," + strColor((sg && sg.title) || "?") + "aa 100%)" } }),
          h("div", { className: "min-w-0", style: { flex: 1 } },
            h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: hero ? 16 : 13.5, color: ink } }, sg ? sg.title : T("他还没有歌单")),
            h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: dim, marginTop: 3 } },
              sg ? ((sg.artist || "") + (livePlaylist && livePlaylist.name ? " · " + livePlaylist.name : "")) : "点开去看看"))),
        sg ? h("div", { style: { height: 2, borderRadius: 9, marginTop: 14, background: "rgba(255,255,255,.22)" } },
          h("div", { style: { width: "38%", height: "100%", borderRadius: 9, background: "rgba(255,255,255,.85)" } })) : null);
    }
    // 健康：一个综合分 + 两三项，不是一行字
    if (key === "health") {
      const hd = data.health || {}, today = hd.today || {};
      const score = Number(today.score);
      const cards = (Array.isArray(hd.cards) ? hd.cards : []).filter(c => c && c.name).slice(0, 2);
      // 模型有时只回 today:{steps,sleep,hr}——直接摆出来就是一排英文字段名，
      // 认不出来的字段宁可不显示，也别把 schema 露到脸上
      const ZH = { steps: "步数", sleep: "睡眠", hr: "心率", heart: "心率", weight: "体重", water: "喝水", mood: "情绪", stress: "压力", calories: "热量" };
      const picks = cards.length ? cards.map(c => [String(c.name).slice(0, 4), (c.value != null && c.value !== "" ? String(c.value) : (c.num != null ? String(c.num) : ""))])
        : Object.keys(today).filter(k2 => k2 !== "score" && ZH[k2]).slice(0, 2).map(k2 => [ZH[k2], String(today[k2])]);
      if (!isFinite(score) && !picks.length) return line("还没有健康记录");
      return h("div", { className: "flex items-center", style: { flex: 1, gap: 13, marginTop: 8 } },
        isFinite(score) ? h("div", { style: { position: "relative", width: 44, height: 44, borderRadius: 999, flexShrink: 0,
          background: "conic-gradient(" + t.accent + " " + Math.max(0, Math.min(100, score)) + "%, rgba(35,31,25,.10) 0)" } },
          h("div", { className: "flex items-center justify-center", style: { position: "absolute", inset: 5, borderRadius: 999, background: dark ? "#1e1d1b" : "#fff",
            fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: ink } }, Math.round(score))) : null,
        h("div", { style: { flex: 1, minWidth: 0 } }, picks.map((pk, i2) =>
          h("div", { key: i2, className: "flex items-baseline", style: { gap: 6, marginTop: i2 ? 5 : 0 } },
            h("span", { className: "truncate", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: dim, flex: 1 } }, pk[0]),
            h("span", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: ink, maxWidth: "60%" } }, pk[1])))));
    }
    // 相册：四宫格
    if (key === "album") {
      const ps = wRows("album").slice(0, 4);
      if (!ps.length) return line("相册还没翻过");
      // ⚠️别用 aspectRatio：两列宽的格子里，1:1 会把整块撑到 240px 高，图标就被挤出屏幕了
      return h("div", { style: { flex: 1, marginTop: 8 } },
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 } },
          [0, 1, 2, 3].map(i2 => { const ph = ps[i2];
            return h("div", { key: i2, style: { height: 48, borderRadius: 9,
              background: ph ? "linear-gradient(150deg," + strColor(wText(ph) || i2) + "cc," + strColor((wText(ph) || "") + "x") + "77)"
                : (dark ? "rgba(255,255,255,.07)" : "rgba(35,31,25,.055)") } }); })),
        h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: dim, marginTop: 8 } }, wText(ps[0])));
    }
    // 日历：一块真正的日期，不是一行字
    if (key === "calendar") {
      const ci = ((liveCtx.calendar || {}).items || [])[0];
      const d = new Date(deskNow);
      return h("div", { className: "flex items-center", style: { flex: 1, gap: 13, marginTop: 6 } },
        h("div", { style: { textAlign: "center", flexShrink: 0 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: ".1em", color: "#c2503f" } }, ["日", "一", "二", "三", "四", "五", "六"][d.getDay()]),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(30px * var(--app-fs, 1))", lineHeight: 1.05, color: ink } }, d.getDate())),
        h("div", { style: { flex: 1, minWidth: 0, borderLeft: "1px solid " + (dark ? "rgba(255,255,255,.2)" : "rgba(35,31,25,.12)"), paddingLeft: 12 } },
          ci ? h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: dim } }, String(ci.date || "").replace(/^\d{4}-/, "")),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: ink, marginTop: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, PTX(ci.title)))
            : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: dim } }, "这几天没安排")));
    }
    // 便签：撕下来的一角
    if (key === "notes") {
      const n = wRows("notes")[0];
      if (!n) return line("最近没有留下新备忘");
      return h("div", { style: { flex: 1, marginTop: 8, borderRadius: 12, padding: "11px 13px",
        background: dark ? "rgba(255,255,255,.07)" : "rgba(226,214,178,.30)", borderLeft: "3px solid " + t.accent + "88" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: hero ? 16 : 13.5, color: ink } }, wText(n)),
        n.body ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.6, color: dim, marginTop: 5,
          display: "-webkit-box", WebkitLineClamp: hero ? 3 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, PTX(n.body)) : null);
    }
    // 阅读：一条进度
    if (key === "reading") {
      const r = wRows("reading")[0];
      if (!r) return line("最近没在读什么");
      const pg = String(r.progress || "").match(/(\d+)\s*%/);
      return h("div", { style: { flex: 1, marginTop: 8 } },
        line(wText(r), 13.5),
        h("div", { className: "flex items-center", style: { gap: 8, marginTop: 10 } },
          h("div", { style: { flex: 1, height: 3, borderRadius: 9, background: dark ? "rgba(255,255,255,.18)" : "rgba(35,31,25,.10)" } },
            h("div", { style: { width: (pg ? pg[1] : 30) + "%", height: "100%", borderRadius: 9, background: t.accent } })),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: dim } }, r.progress || "")));
    }
    // 账本：没结清的那几笔
    if (key === "tally") {
      const rows = wRows("tally").slice(0, 2);
      if (!rows.length) return line(T("他还没记这本账"));
      return h("div", { style: { flex: 1, marginTop: 8 } }, rows.map((x, i2) =>
        h("div", { key: i2, className: "flex items-baseline", style: { gap: 7, marginTop: i2 ? 7 : 0 } },
          h("span", { style: { width: 5, height: 5, borderRadius: 999, background: t.accent, flexShrink: 0 } }),
          h("span", { className: "truncate", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: ink, flex: 1 } }, wText(x)))));
    }
    // 邮件：几封 + 谁来的
    if (key === "mail") {
      const rows = wRows("mail").slice(0, 2);
      if (!rows.length) return line("邮箱还没翻过");
      return h("div", { style: { flex: 1, marginTop: 8 } }, rows.map((x, i2) =>
        h("div", { key: i2, style: { marginTop: i2 ? 9 : 0 } },
          h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: ink } }, wText(x)),
          h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: dim, marginTop: 2 } },
            (x.from || "") + (wTime(x) ? " · " + wTime(x) : "")))));
    }
    return h("div", { style: { fontFamily: F_DISPLAY, fontSize: hero ? 18 : 14, lineHeight: 1.42, color: ink, marginTop: hero ? 20 : 13,
      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, widgetCopy(key));
  }

  // ⚠️底换深了，上层也得跟着换：widget 卡原来用 tone.wash（浅底专用的彩釉），
  // 压在深壁纸上成了一摊脏色，里头的字还是浅色主题的墨色——黑字压深底看不清。
  // 真手机上本来就是【深壁纸 + 浅色卡片】，所以 own 档直接给不透明的浅卡。
  const wPreset = look.iconPreset || "own";
  const deskWidget = spec => {
    const key = spec.key;
    const wide = spec.span === 2;
    const hero = spec.size === "hero";
    const tall = spec.size === "tall";
    const dark = key === "music" || key === "latenight";
    // 刷新是个【动作】，不是内容：以前它占一整块组件的高度，把图标整排挤到屏幕外面去。
    // 改成一条通栏细条，省下来的一百来像素刚好够图标露出来。
    if (key === "refresh") return h("button", {
      key,
      onClick: () => { clearSeen(char.id); onGenAll(char); }, disabled: !!busyKey,
      className: "flex items-center justify-center active:opacity-70 disabled:opacity-50",
      style: {
        gridColumn: "span 1", minHeight: 46, gap: 7, borderRadius: 16,
        background: wPreset === "own" ? "rgba(255,255,255,.72)" : "rgba(255,255,255,.52)",
        border: "1px solid " + (wPreset === "own" ? "rgba(255,255,255,.34)" : "rgba(255,255,255,.66)")
      }
    }, h(IRefresh, { size: 15, color: t.fog }), h("span", {
      style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub }
    }, isAllRun ? (allNowKey && PHONE_LABEL[allNowKey] ? "正在翻…" + PHONE_LABEL[allNowKey] : "正在翻…") : "刷新全部"));
    // 「看TA玩」跟「刷新全部」并排：它们是同一层的两面——一个是我翻TA的手机，
    // 一个是TA自己在刷、我在旁边看。所以摆成一对，一人一半。
    if (key === "watch") return h("button", {
      key,
      onClick: () => { if (!watchCoolLeft) startWatch(); },
      disabled: watchBusy || !!busyKey || watchCoolLeft > 0,
      className: "flex items-center justify-center active:opacity-70 disabled:opacity-50",
      style: {
        gridColumn: "span 1", minHeight: 46, gap: 7, borderRadius: 16,
        background: wPreset === "own" ? "rgba(255,255,255,.72)" : "rgba(255,255,255,.52)",
        border: "1px solid " + (wPreset === "own" ? "rgba(255,255,255,.34)" : "rgba(255,255,255,.66)")
      }
    }, h("span", { "aria-hidden": "true", style: {
        width: 7, height: 7, borderRadius: 999, flexShrink: 0,
        background: watchCoolLeft > 0 ? t.line : "#78bd58",
        // 「TA这会儿在手机上」（她 2026-09-10 第 ⑩ 条）：这颗点本来就在，
        // 提示只是让它【呼吸一下】——不另加一个红点、也不多一行字。
        // 判据零调用，节奏由 PhoneWatch 兜（冷却是关着的，见台账那条红的）。
        animation: (watchHintOn && !watchCoolLeft && !watchBusy) ? "wkbreathe 2.4s ease-in-out infinite" : undefined
      } }),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub } },
        watchBusy ? T("等他拿起手机…") : watchCoolLeft > 0 ? Math.ceil(watchCoolLeft / 60000) + " 分钟后"
          : (watchHintOn ? T("他在手机上") : T("看他玩"))));
    // 装饰件不是 app：表点了什么都不做，相框去相册，一句话去便签
    const decor = PHONE_DECOR.indexOf(key) >= 0;
    const jump = key === "frame" ? "album" : key === "saying" ? "notes" : key;
    const app = decor ? null : appByKey(key);
    if (!decor && !app) return null;
    const label = decor ? { clock: "时间", frame: "相册", saying: T("他写过的") }[key] : app.zh;
    const tone = phoneTone(jump);
    return h("button", {
      key, "data-wk": "phonewidget", "data-app": jump,
      "data-watch": "app:" + jump,
      onClick: () => { if (key === "clock") return; const a = appByKey(jump); if (a) openApp(a); },
      className: "text-left active:opacity-70",
      style: {
        gridColumn: wide ? "span 2" : "span 1",
        minWidth: 0, overflow: "hidden",   // 组件里的长字不许把卡片（和旁边那张）撑破
        minHeight: hero ? 124 : tall ? 132 : spec.size === "wide" ? 112 : 104,
        padding: hero ? 17 : 15, borderRadius: hero ? 25 : 23,
        display: "flex", flexDirection: "column",
        background: dark ? "rgba(30,29,27,.88)" : wPreset === "own" ? "rgba(255,255,255,.88)" : tone.wash,
        color: dark ? "#fff" : t.ink, border: dark ? "none" : "1px solid rgba(255,255,255,.72)",
        boxShadow: hero ? "0 12px 28px rgba(35,31,25,.09)" : "none"
      }
    }, h("div", { className: "flex items-center justify-between shrink-0" },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".11em", color: dark ? "rgba(255,255,255,.62)" : t.fog } }, label),
      decor && key === "clock" ? null : h(PGlyph, { k: decor ? jump : key, size: 19, color: dark ? "#fff" : tone.glyph })),
    deskBody(key, dark, hero));
  };
  const pages = layout.pages.map((keys, pageIndex) => h("section", {
    key: pageIndex,
    className: "h-full min-w-full overflow-y-auto px-5 pt-3",
    // ⚠️底部要让开那排 dock：pb-5 只有 20px，最后一排图标会被压在 dock 底下
    //（多加一格「外观」之后一眼看出来的）。
    // ⚠️每页钉死一屏宽（她 2026-09-27 截图：别人的查手机整页往左错开、字冲出卡片，她自己的没事）。
    //   原来只有 min-w-full：横排里的一页是按【内容最宽能有多宽】长的，谁的组件里有一行不换行的长字
    //  （很长的动态、很长的邮件标题），这一页就被撑得比屏幕宽，翻页对不齐。
    style: { scrollSnapAlign: "start", scrollSnapStop: "always", paddingBottom: 104, flex: "0 0 100%", width: "100%", maxWidth: "100%" }
  }, h("div", { className: "grid grid-cols-2 gap-3 mb-6" }, (layout.widgets[pageIndex] || []).map(deskWidget)),
  // 这一页已经摆了组件的 app，就不在同一页再放一个图标——她 2026-08-30 问的
  //「哪些留图标、哪些换组件」，答案是【按页去重】：组件已经把内容摊开了，
  // 旁边再放个同名图标只是重复一次，而且把真正需要图标的那几个挤下去。
  h("div", { className: "grid grid-cols-4 gap-x-2 gap-y-6" },
    keys.filter(k => !(layout.widgets[pageIndex] || []).some(w => w.key === k))
      .map(k => appIcon(appByKey(k), false))
      // 外观设置：她 2026-09-01「做他们 app 的一个图标，不要放在上面」。
      // 只摆在最后一页，跟别的 app 一样是个图标——顶栏那一格还给搜索。
      .concat(pageIndex === layout.pages.length - 1 ? [lookIcon(), dataIcon()] : []))));
  return watchSkin(h("div", {
    "data-wk": "phonepage", "data-view": "desk",
    className: "h-full flex flex-col overflow-hidden",
    style: homeSrc ? {
      backgroundImage: "linear-gradient(rgba(246,243,237,.13),rgba(246,243,237,.31)),url(\"" + homeSrc.replace(/\"/g, "%22") + "\")",
      backgroundSize: "cover", backgroundPosition: "center"
    } : { background: phonePaper(char && char.id, look) }
  }, h("div", {
    "data-wk": "head",
    className: "shrink-0 px-4 pb-2 flex items-center",
    style: { paddingTop: safeTop(20) }
  }, h("button", { onClick: () => { setInList(true); setLocked(true); }, className: "active:opacity-50 flex items-center", style: { width: 34, height: 36 }, "aria-label": "返回通讯录" }, h(IArrow, { size: 19, color: t.ink })),
  // 她 2026-09-01：「搜索键缩短放顶上时间那块地方，所以最顶部就留返回键、搜索框、
  // 头像切换角色」。时间那一格让给搜索——上面本来就该是「你在找什么」，
  // 而不是再报一次几点（系统状态栏已经有了）。
  // 她 2026-09-01：「搜索框可以放长一点居中」——左右两侧收成等宽（各 34），
  // 中间那条就自然居中，也长了一截。
  h("div", { "data-wk": "block", className: "flex-1 min-w-0 flex items-center", style: { gap: 7, height: 34, borderRadius: 12, padding: "0 12px", margin: "0 10px", background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.66)" } },
    h("span", { "aria-hidden": "true", style: { fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog } }, "\u2315"),
    h("input", {
      value: q, onChange: e => setQ(e.target.value),
      placeholder: T("在他手机里搜…"),
      "aria-label": T("在他手机里搜"),
      style: { flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink }
    }),
    q ? h("button", { onClick: () => setQ(""), "aria-label": "清空", className: "active:opacity-60", style: { fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "0 2px" } }, "\u00d7") : null),
  // ⚠️「手机外观设置」不在顶栏了：那是【偶尔做一次】的事，不该常驻着占掉搜索的位置。
  // 改成桌面上的一个 app 图标（她 2026-09-01 定）。
  h("div", { className: "flex items-center justify-end shrink-0", style: { width: 34 } },
    h("button", { onClick: () => setPick(true), className: "active:opacity-50", "aria-label": "切换角色" }, h(Avatar, { character: char, size: 28, radius: 9 })))),
  // 名字和头像顶栏已经有了，这儿不再顶一大块（她 2026-08-29：「那一大块角色名也删了吧」）
  // 搜索条已经并进顶栏（她 2026-09-01：「搜索键缩短放顶上时间那块地方」），
  // 这儿不再单占一条。
  // 「看TA玩」的入口在桌面组件里，跟「刷新全部」并排（她 2026-09-10 定的：
  // 全刷从 4×1 收成 2×1，另一半让给它）——它们是同一层的两面。
  q.trim() ? h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, padding: "2px 2px 10px" } },
      hits.length ? T("在他手机里找到 ") + hits.length + " 处" : T("他手机里没有这个")),
    hits.slice(0, 60).map(r => h("button", {
      key: r.id,
      onClick: () => { const a = appByKey(r.app); if (a) { setQ(""); openApp(a); } },
      className: "w-full text-left active:opacity-60",
      style: { display: "block", background: "rgba(255,255,255,.72)", borderRadius: 15, padding: "12px 14px", marginBottom: 8 }
    },
      h("div", { className: "flex items-center", style: { gap: 6, marginBottom: 4 } },
        h(PGlyph, { k: r.app, size: 12, color: t.fog }),
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          r.appZh + (r.tag ? " · " + r.tag : "")),
        r.when ? h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog } }, r.when) : null),
      r.title ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.45, wordBreak: "break-word" } }, PTX(r.title)) : null,
      r.text ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.65, marginTop: 3, wordBreak: "break-word" } },
        r.text.length > 60 ? r.text.slice(0, 60) + "…" : r.text) : null))) : null,
  !q.trim() && h("div", { className: "shrink-0 px-5 pb-1 flex items-center justify-between" },
  h("div", null),   // 「向左滑还有一页」她 2026-09-01 说去掉——底下那排页点已经在说这件事了
  h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: ".04em", color: t.fog } }, layout.label)),
  !q.trim() && h("div", {
    ref: deskRef,
    className: "flex-1 min-h-0 flex overflow-x-auto",
    onScroll: e => {
      const el = e.currentTarget;
      const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      if (n !== deskPage) setDeskPage(n);
    },
    style: { scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }
  }, pages),
  !q.trim() && h("div", { className: "shrink-0 flex justify-center gap-1.5 py-1" }, layout.pages.map((_, i) => h("button", {
    key: i, onClick: () => deskRef.current && deskRef.current.scrollTo({ left: deskRef.current.clientWidth * i, behavior: "smooth" }),
    "aria-label": "第 " + (i + 1) + " 页",
    style: { width: i === deskPage ? 15 : 6, height: 6, borderRadius: 9, background: i === deskPage ? t.ink : "rgba(30,28,24,.25)", transition: "all .2s" }
  }))),
  h("div", { "data-wk": "block", className: "shrink-0 mx-4 mb-3 px-3 py-2 grid grid-cols-4", style: { borderRadius: 25, background: "rgba(255,255,255,.66)", border: "1px solid rgba(255,255,255,.74)", boxShadow: "0 12px 30px rgba(35,31,25,.11)" } }, layout.dock.map(k => appIcon(appByKey(k), true))), pick && h(Sheet, {
    onClose: () => setPick(false)
  }, h(Eyebrow, {
    style: {
      marginBottom: 12
    }
  }, "切换角色"), h("div", {
    className: "space-y-1 max-h-72 overflow-y-auto"
  }, characters.map(c => h("button", {
    key: c.id,
    onClick: () => {
      onSel(c.id);
      setPick(false);
      setOpen(null);
      setLocked(true);
    },
    className: "w-full flex items-center gap-3 py-2.5 active:opacity-60"
  }, h(Avatar, {
    character: c,
    size: 34,
    radius: 7
  }), h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: "calc(16px * var(--app-fs, 1))",
      color: t.ink
    }
  }, PTX(c.name))))))));
}
