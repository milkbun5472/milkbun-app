// ============================================================
// 查手机 — 仿 iOS 桌面：锁屏 → 桌面 → 各 app。生成的那些各自独立刷新；
// 论坛/音乐/日历读 App 里的真数据；时间线不生成，只把翻出来的碎片按时间串起来。
// ============================================================
const PHONE_APPS = [{
  key: "wechat",
  zh: "微信"
}, {
  key: "notes",
  zh: "便签"
}, {
  key: "calls",
  zh: "电话"
}, {
  key: "browser",
  zh: "浏览器"
}, {
  key: "shopping",
  zh: "购物"
}, {
  key: "album",
  zh: "相册"
}, {
  key: "forum",
  zh: "论坛"
}, {
  key: "music",
  zh: "音乐"
}, {
  key: "bili",
  zh: "视频"
}, {
  key: "latenight",
  zh: "深夜台"
}, {
  key: "reading",
  zh: "阅读"
}, {
  key: "liked",
  zh: "小红书"
}, {
  key: "health",
  zh: "健康"
}, {
  key: "clipboard",
  zh: "剪贴板"
}, {
  key: "calendar",
  zh: "日历"
}, {
  key: "takeout",
  zh: "外卖"
}, {
  // 邮件：他对外那一面。跟微信不撞车——微信是熟人和随口，邮件是**正式的**：
  // 工作、账单、订阅、学校。真正有东西的是【正式腔和他私下说话的落差】。
  key: "mail",
  zh: "邮件"
}, {
  // 账本：他心里给这段关系记的账。跟钱包不是一回事——钱包记钱，这儿记
  // 没结清的东西（欠着的、兜过的底、放过的狠话、舍不得的、拿不准的）。
  key: "tally",
  zh: "账本"
}, {
  // 时间线不推演任何东西，它只把上面那些 app 已经翻出来的碎片按时间串起来。
  // 所以它同时属于 PHONE_LIVE_KEYS（不调模型、不进 phones）。
  key: "timeline",
  zh: "时间线"
}];
const PHONE_LABEL = PHONE_APPS.reduce((o, a) => (o[a.key] = a.zh, o), {});
// 接真数据的 app：不调模型、不存进 phones，直接读 App 里那份真的。
// 论坛读 x_forumPosts（他真发过的帖，连小号和匿名一起），
// 音乐读「一起听」里归到他名下的那张歌单（点开就能放）。
// 以前这两个各自另生成一份，等于同一个人有两套互不相干的论坛痕迹和歌单，
// 而且手机里那份点不动、也不会因为他真去发帖而变。
const PHONE_OUT_CEILING = 65535;   // 同 StylePresets.OUT_CEILING；中转会自行 clamp 到模型上限
// 日历接的是 App 里那份真的（x_calendar 里他自己的那格 + 带时刻的日程 + 他答应过她的事），
// 不再另生成一份假的——翻到他日历上真的写着某一天有事，比生成出来的任何一条都重。
const PHONE_LIVE_KEYS = ["forum", "music", "calendar", "timeline"];
// 自己画满整屏（连顶栏和内页导航一起画）的 app：外层不套通用 Head，也不加 padding，
// 否则会叠出两层标题栏。
const FULL_BLEED_KEYS = ["wechat", "album", "reading", "shopping", "takeout", "health", "bili", "latenight", "liked", "calendar", "notes", "clipboard", "browser", "calls", "timeline", "tally", "mail"];
// 桌面只负责摆放入口。下面这份是兜底布局；真实桌面会按角色稳定选择不同布局。
const PHONE_DOCK_KEYS = ["calls", "wechat", "browser", "music"];
const PHONE_DESKTOP_PAGES = [
  ["timeline", "notes", "album", "liked", "forum", "shopping", "calendar"],
  ["reading", "bili", "health", "clipboard", "takeout", "latenight", "tally", "mail"]
];
const PHONE_DESKTOP_LAYOUTS = [{
  id: "social", label: "SOCIAL",
  dock: ["calls", "wechat", "browser", "music"],
  pages: [["timeline", "notes", "album", "liked", "forum", "shopping", "calendar"], ["reading", "bili", "health", "clipboard", "takeout", "latenight", "tally", "mail"]],
  widgets: [[{ key: "timeline", span: 2, size: "wide" }, { key: "wechat", span: 2, size: "hero" }, { key: "liked" }, { key: "refresh" }], [{ key: "album" }, { key: "health" }]]
}, {
  id: "archive", label: "ARCHIVE",
  dock: ["calls", "wechat", "notes", "browser"],
  pages: [["timeline", "reading", "clipboard", "calendar", "album", "music", "takeout"], ["shopping", "forum", "liked", "bili", "health", "latenight", "tally", "mail"]],
  widgets: [[{ key: "timeline", span: 2, size: "wide" }, { key: "notes", span: 2, size: "hero" }, { key: "calendar" }, { key: "refresh" }], [{ key: "reading", span: 2, size: "wide" }, { key: "music", span: 2, size: "wide" }]]
}, {
  id: "media", label: "MEDIA",
  dock: ["calls", "wechat", "music", "album"],
  pages: [["timeline", "bili", "liked", "forum", "browser", "notes", "reading", "shopping"], ["health", "clipboard", "calendar", "takeout", "latenight", "tally", "mail"]],
  widgets: [[{ key: "timeline", span: 2, size: "wide" }, { key: "music", span: 2, size: "hero" }, { key: "album" }, { key: "refresh" }], [{ key: "bili", span: 2, size: "wide" }, { key: "liked", span: 2, size: "wide" }]]
}, {
  id: "wander", label: "WANDER",
  dock: ["calls", "wechat", "browser", "album"],
  pages: [["timeline", "notes", "reading", "calendar", "health", "music", "shopping", "takeout"], ["liked", "bili", "clipboard", "forum", "latenight", "tally", "mail"]],
  widgets: [[{ key: "timeline", span: 2, size: "wide" }, { key: "browser", span: 2, size: "hero" }, { key: "reading" }, { key: "refresh" }], [{ key: "shopping" }, { key: "clipboard" }]]
}];
const phoneStableHash = value => [...String(value || "?")].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
const phoneDesktopLayout = char => PHONE_DESKTOP_LAYOUTS[phoneStableHash(char && (char.id || char.name)) % PHONE_DESKTOP_LAYOUTS.length];

// ─────────────────────────────────────────────────────────────
// 时间线：把 16 个 app 的碎片按时间串成一条线
// ─────────────────────────────────────────────────────────────
// 单看每个 app，里面那些条目都挺平的：一通未接来电、一段没发出去的话、一个
// 深夜看完的视频、一条只有两个字的便签。可它们都带时间——按时间排一下，
// 就是他一个晚上的完整心路。这一层不生成任何新内容，只是把已经翻出来的东西
// 重新放在一起看；刷新一次手机的成本一分没多，看到的东西完全不一样。
//
// 难在时间。模型写出来的时间串写法五花八门：「今天 09:12」「昨天 21:03」
// 「14:20」「3天前」「上周」「2026-08-28 18:42」「8月28日 14:15」「存了 11 天」。
// 要排到同一根轴上，第一步就是把这些全换算成毫秒。
const PHONE_CN_NUM = { "零": 0, "一": 1, "两": 2, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
const phoneNum = v => {
  const s = String(v == null ? "" : v).trim();
  if (/^\d+$/.test(s)) return +s;
  const m = /^([零一两二三四五六七八九]?)十([零一两二三四五六七八九]?)$/.exec(s);
  if (m) return (m[1] ? PHONE_CN_NUM[m[1]] : 1) * 10 + (m[2] ? PHONE_CN_NUM[m[2]] : 0);
  return PHONE_CN_NUM[s] != null ? PHONE_CN_NUM[s] : 0;
};
// 认不出来的一律返回 null。宁可让它落进「时间不详」那一格，也不许瞎猜一个
// 时刻排进去——时间线只要有一条排错位，整条线讲的故事就是假的。
function phoneWhenTs(raw, nowTs) {
  if (typeof raw === "number" && raw > 1e11) return raw;
  const now = new Date(nowTs || Date.now());
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return null;
  if (/^\d{12,}$/.test(s)) return Number(s);
  const hm = /(\d{1,2})\s*[:：]\s*(\d{2})/.exec(s);
  const H = hm ? Math.min(23, +hm[1]) : null;
  const M = hm ? Math.min(59, +hm[2]) : null;
  // defH：只知道是哪天、不知道几点时用的默认时刻。「昨晚」给 22 点、「今早」给 8 点，
  // 不是为了准，是为了让同一天里「晚上那条」排在「白天那条」后面。
  const at = (d, defH) => { d.setHours(H == null ? (defH == null ? 12 : defH) : H, M == null ? 0 : M, 0, 0); return d.getTime(); };
  const ago = n => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
  let m;
  if ((m = /(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})/.exec(s))) return at(new Date(+m[1], +m[2] - 1, +m[3]), 12);
  if ((m = /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/.exec(s))) {
    const d = new Date(now.getFullYear(), +m[1] - 1, +m[2]);
    // 手机里的痕迹都是【已经发生过的】。八月里看到「12月28日」，那是去年的，
    // 不是四个月后的。所以只要落在未来超过几天，一律退一年。
    //（真有未来日期的只有日历，那一路走的是 YYYY-MM-DD 那一支，不经过这儿。）
    if (d.getTime() - now.getTime() > 86400000 * 7) d.setFullYear(d.getFullYear() - 1);
    return at(d, 12);
  }
  if (/刚刚|刚才/.test(s)) return now.getTime() - 300000;
  if (/大前天/.test(s)) return at(ago(3), 21);
  if (/前天/.test(s)) return at(ago(2), 21);
  if (/昨/.test(s)) return at(ago(1), /晚|夜/.test(s) ? 22 : 15);
  if (/今/.test(s)) return at(new Date(now), /晚|夜/.test(s) ? 21 : /早|晨/.test(s) ? 8 : null);
  if ((m = /(\d+|[零一两二三四五六七八九十]+)\s*分钟前/.exec(s))) return now.getTime() - phoneNum(m[1]) * 60000;
  if ((m = /(?:开了|过了|存了|放了)?\s*(\d+|[零一两二三四五六七八九十]+)\s*(?:个)?\s*小时(?:前)?/.exec(s))) return now.getTime() - phoneNum(m[1]) * 3600000;
  if ((m = /(?:开了|过了|存了|放了)?\s*(\d+|[零一两二三四五六七八九十]+)\s*天(?:前)?/.exec(s))) return at(ago(phoneNum(m[1])), 12);
  if ((m = /(\d+|[零一两二三四五六七八九十]+)\s*(?:个)?\s*(?:周|星期|礼拜)前/.exec(s))) return at(ago(phoneNum(m[1]) * 7), 12);
  if (/上(?:个)?(?:周|星期|礼拜)/.test(s)) return at(ago(7), 12);
  if (/(?:本|这)(?:周|星期|礼拜)/.test(s)) return at(ago(3), 12);
  if ((m = /(\d+|[零一两二三四五六七八九十]+)\s*(?:个)?月前/.exec(s))) return at(ago(phoneNum(m[1]) * 30), 12);
  if (/上(?:个)?月/.test(s)) return at(ago(30), 12);
  if (hm) return at(new Date(now), null);   // 光有 HH:MM 没有日期 → 当成今天
  return null;
}
// 每条的指纹。delta（「这次比上次多出来的」）靠它认人，所以只能由内容决定，
// 不能掺进数组下标或生成时刻——不然刷新一次全变新的，delta 就废了。
const phoneEntryId = (app, title, text, when) =>
  app + "|" + phoneStableHash([app, title, text, when].join("~|~")).toString(36);

function phoneTimeline(charData, live, nowTs) {
  const now = nowTs || Date.now();
  const d = (charData && typeof charData === "object") ? charData : {};
  const L = (live && typeof live === "object") ? live : {};
  const A = a => Array.isArray(a) ? a : [];
  const S = v => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const out = [];
  const push = (app, tag, when, title, text, thought) => {
    const ti = S(title), tx = S(text);
    if (!ti && !tx) return;
    const w = S(when);
    out.push({
      app, appZh: PHONE_LABEL[app] || app, tag, when: w, ts: phoneWhenTs(when, now),
      title: ti.slice(0, 60), text: tx.slice(0, 220), thought: S(thought).slice(0, 220),
      id: phoneEntryId(app, ti, tx, w)
    });
  };
  const g = k => (d[k] && typeof d[k] === "object") ? d[k] : {};

  A(g("wechat").chats).forEach(x => x && push("wechat", "聊天", x.time, x.name, x.last));
  A(g("wechat").moments).forEach(x => x && push("wechat", "朋友圈", x.time, (S(x.author) || "谁") + " 发了条朋友圈", x.content));

  A(g("notes").items).forEach(x => x && push("notes", x.kind === "voice" ? "录音" : "便签", x.time, x.title, x.body));

  A(g("calls").calls).forEach(x => x && push("calls", x.answered === false ? "未接" : (x.dir === "out" ? "拨出" : "来电"),
    x.time, S(x.name) || S(x.number) || "陌生号", x.gist, x.thought));
  A(g("calls").sms).forEach(x => x && push("calls", "短信", x.time, S(x.name) || S(x.number), (A(x.msgs)[0] || {}).text, x.thought));
  A(g("calls").voicemail).forEach(x => x && push("calls", "语音信箱", x.time, S(x.from) + " 留了言", x.transcript, x.thought));

  A(g("browser").searches).forEach(x => x && push("browser", "搜索", x.time, x.q, x.site));
  A(g("browser").tabs).forEach(x => x && push("browser", "开着没关", x.age, x.title, x.gist));

  A(g("shopping").orders).forEach(x => x && push("shopping", S(x.status) || "订单", x.time, x.title, S(x.shop) + (x.reason ? " · " + S(x.reason) : "")));
  A(g("shopping").viewed).forEach(x => x && push("shopping", "看过没买", x.time, x.title, x.shop));

  A(g("album").items).forEach(x => x && push("album", x.category === "private" ? "私密相册" : "相册", x.date, x.caption, x.desc, x.thought));

  A(g("liked").items).forEach(x => x && push("liked", S(x.act) || "小红书", x.time, x.title, x.excerpt));
  A(g("liked").mine).forEach(x => x && push("liked", "自己发的", x.time, x.title, x.excerpt));
  A(g("liked").drafts).forEach(x => x && push("liked", "草稿没发", x.savedAt, x.title, x.excerpt));

  A(g("health").timeline).forEach(x => x && push("health", S(x.tag) || "健康", x.time, x.text, ""));

  A(g("clipboard").items).forEach(x => x && push("clipboard", x.sent ? "复制过" : "没发出去", x.time, x.text, S(x.from) ? "从" + S(x.from) + "里复制的" : ""));

  A(g("takeout").orders).forEach(x => x && push("takeout", S(x.status) || "外卖", x.time, x.main || x.shop, S(x.shop) + (x.reason ? " · " + S(x.reason) : "")));

  A(g("mail").inbox).forEach(x => x && push("mail", S(x.kind) || "收件", x.time, x.subject, S(x.from) + (x.preview ? " · " + S(x.preview) : ""), x.thought));
  A(g("mail").sent).forEach(x => x && push("mail", "发出去的", x.time, x.subject, "寄给 " + S(x.to)));
  const ln = g("latenight");
  if (ln.me && ln.me.lastAt) push("latenight", "深夜台", ln.me.lastAt, "半夜又开了一次", ln.me.note);

  // 真数据这两层走 live，不看 phones（跟 app 里其他地方一个规矩）
  A(L.forumAccounts).forEach(a => {
    if (!a) return;
    A(a.posts).forEach(p => p && push("forum", S(a.label) + "发帖", p.ts, p.title, p.body));
    A(a.comments).forEach(c => c && push("forum", S(a.label) + "回帖", c.ts, "在「" + S(c.postTitle) + "」下面说", c.text));
  });
  A((L.calendar || g("calendar")).items).forEach(x => x && push("calendar", S(x.kind) || "日程",
    S(x.date) + (S(x.time) ? " " + S(x.time) : ""), x.title, x.note));

  // 三段：还没发生的（正序，摆最前）、已经发生的（倒序）、认不出时间的（沉底）。
  // 日历接真数据之后时间线里才第一次有「未来」——一起倒序排的话，后天的事会压在
  // 今天上面，整条线读起来是乱的。未来归未来，走过的路归走过的路。
  // ⚠️只有日历那一路能算「还没发生」。别的 app 全是【推演出来的今天】——模型写
  // 一整天的痕迹时不管现在几点，你早上七点翻手机，它照样会写「今天 14:20」。
  // 那不是预告，那是这一天的记录。要是照时钟去判，早上翻手机会看到大半天的事
  // 被推到「未来」那一段去，今天这一格反而空了。
  const soon = now + 3600000;   // 一小时内的算「刚刚过去」
  const canAhead = x => x.app === "calendar";
  const ahead = out.filter(x => x.ts != null && x.ts > soon && canAhead(x)).sort((a, b) => a.ts - b.ts).map(x => ({ ...x, ahead: true }));
  const past = out.filter(x => x.ts != null && !(x.ts > soon && canAhead(x))).sort((a, b) => b.ts - a.ts);
  const loose = out.filter(x => x.ts == null);
  return ahead.concat(past, loose);
}
// ─────────────────────────────────────────────────────────────
// 钱：花钱的那几个 app 得知道他有多少钱
// ─────────────────────────────────────────────────────────────
// 钱包那边算着他的存款、月收入、固定支出，购物和外卖却各编各的价钱——
// 一个月俸微薄的小官照样下单六百八十文的袍子，两边说的不是同一个人。
// 这一块只是把钱包那份【读过来】发给它们，不生成任何东西。
const PHONE_MONEY_KEYS = ["shopping", "takeout"];
function phoneMoneyBlock(appKey, money) {
  if (PHONE_MONEY_KEYS.indexOf(appKey) < 0 || !money) return "";
  const n = v => (v == null || !isFinite(Number(v))) ? null : Math.round(Number(v));
  const bits = [];
  if (n(money.balance) != null) bits.push("手头（可动用）约 " + n(money.balance));
  if (n(money.monthlyIncome)) bits.push("每月进账约 " + n(money.monthlyIncome));
  if (n(money.fixedMonthly)) bits.push("每月固定要出 " + n(money.fixedMonthly));
  if (!bits.length && !money.spendingNote) return "";
  let out = "\n\n【他的钱】" + bits.join("；") + "。";
  if (money.spendingNote) out += "他对花钱的态度：" + String(money.spendingNote).slice(0, 200);
  out += "\n**金额必须落在这个水平上**：买不起的东西他就是买不起，别让他随手下单一笔够他过半个月的单子。"
    + "手头紧的时候，想买清单会变长、真下单的会变少——那种落差本身就是内容。"
    + (n(money.balance) != null && n(money.balance) <= 0 ? "他现在已经透支了：这一轮不该有任何非必需的下单。" : "");
  return out;
}

// ═════════════════════════════════════════════════════════════
// 四层手机数据模型
// ═════════════════════════════════════════════════════════════
// 刷新是整份重生成。什么该保、什么该换，不是一个开关，是【四层】：
//
//   🔒 硬钉死 PHONE_STICKY —— 除非手动改，永远不变。身份证一样的东西：
//      号码、账号 id、过敏和真忌口。这些变了就等于换了个人。
//   🌱 缓慢演化 PHONE_EVOLVE —— 默认原样沿用，但允许变。昵称、签名、
//      给她的备注、对她的评价、住址、消费习惯、口味偏好。
//      **不许硬钉死**：关系会长，人会搬家，评价会变——钉死等于他永远拿
//      第一次见面的眼光看她（Codex 2026-08-29 指出，是我做错了）。
//   📚 累积日志 PHONE_GROW —— 发生过的事，新旧合并去重，满了挤掉最旧的。
//   ♻️ 当前快照（不登记 = 默认）—— 只表示此刻：购物车、在途、开着的标签页、
//      今天的健康、常联系人、黑名单、关注列表。
//
// 判据两问：
//   一、这一栏变了，是「他变了」还是「系统忘了」？系统忘了 → 🔒 或 🌱。
//   二、它说的是「发生过什么」还是「现在有哪些」？
//       发生过 → 📚（只进不出是对的，发生过就是发生过）；
//       现在有哪些 → ♻️（名册必须能出，只进不出的黑名单是坟场）。
const PHONE_STICKY = {
  wechat: ["me.wechatId"],
  calls: ["me.number"],
  browser: ["me.uid"],
  shopping: ["account.uid"],
  // 过敏和真忌口属于身份：那是身体的事，不是心情
  takeout: ["account.uid", "taste.avoidTags"],
  liked: ["me.xhsId"],
  bili: ["me.uid"],
  latenight: ["me.uid"],
  reading: ["archive.uid"],
  mail: ["me.addr"]
};
// 🌱 默认沿用、允许变。跟 ♻️ 的区别：♻️ 每次照实重写，🌱 要有理由才动。
const PHONE_EVOLVE = {
  // 「对你的评价」尤其不能钉死——钉死就是关系长了他还拿第一次的眼光看你
  wechat: ["me.wechatName", "me.signature", "userContact"],
  browser: ["me.name"],
  // 地址也不能钉死：会搬家，也会多出「她家」这一条
  shopping: ["account.name", "account.member", "account.style", "account.persona", "addrs", "habit"],
  takeout: ["account.name", "account.member", "account.persona", "addrs",
    "taste.spicyTags", "taste.likeTags", "taste.budget", "taste.habit"],
  liked: ["me.name", "me.bio", "me.tag"],
  bili: ["me.name"],
  reading: ["archive.name", "archive.favorite"],
  mail: ["me.name", "me.sign"]
};
// 一次刷新最多允许几项 🌱 真的改动。光靠提示词说「别乱改」只是降概率，
// 模型高兴起来能把六项一起换掉——那 🌱 就退化成 ♻️ 了。超出的按旧值回填。
const PHONE_EVOLVE_CHURN = 2;

const phoneGetPath = (obj, path) => String(path || "").split(".").reduce((o, k) => (o && typeof o === "object") ? o[k] : undefined, obj);
const phoneSetPath = (obj, path, val) => {
  const ks = String(path || "").split(".");
  let cur = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    if (!cur[ks[i]] || typeof cur[ks[i]] !== "object") cur[ks[i]] = {};
    cur = cur[ks[i]];
  }
  cur[ks[ks.length - 1]] = val;
};
const phoneHasVal = v => !(v == null || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length));
const phoneSame = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return a === b; } };

// 🔒 新生成的那份 + 旧那份里的硬身份 = 存进去的那份
function phoneKeepIdentity(appKey, oldData, newData) {
  const paths = PHONE_STICKY[appKey];
  if (!paths || !oldData || !newData || typeof newData !== "object") return newData;
  const out = JSON.parse(JSON.stringify(newData));
  paths.forEach(pt => {
    const v = phoneGetPath(oldData, pt);
    if (phoneHasVal(v)) phoneSetPath(out, pt, v);
  });
  return out;
}
// 🌱 空的不许把旧值抹掉；真改动一次最多 PHONE_EVOLVE_CHURN 项，超出的回填旧值
function phoneEvolveMerge(appKey, oldData, newData) {
  const paths = PHONE_EVOLVE[appKey];
  if (!paths || !oldData || !newData || typeof newData !== "object") return newData;
  const out = JSON.parse(JSON.stringify(newData));
  let changed = 0;
  paths.forEach(pt => {
    const oldV = phoneGetPath(oldData, pt);
    const newV = phoneGetPath(out, pt);
    if (!phoneHasVal(oldV)) return;                    // 以前就没有，随新的
    if (!phoneHasVal(newV)) { phoneSetPath(out, pt, oldV); return; }  // 模型没给，别抹掉
    if (phoneSame(oldV, newV)) return;                  // 没动
    changed++;
    if (changed > PHONE_EVOLVE_CHURN) phoneSetPath(out, pt, oldV);   // 一次改太多，多的回填
  });
  return out;
}
// 🔒 要喂回提示词：不然模型不知道他的账号是什么，编的内容跟钉死的对不上
function phoneIdentityBlock(appKey, oldData) {
  const paths = PHONE_STICKY[appKey];
  if (!paths || !oldData) return "";
  const lines = [];
  paths.forEach(pt => {
    const v = phoneGetPath(oldData, pt);
    if (!phoneHasVal(v)) return;
    let txt = (typeof v === "string" || typeof v === "number") ? String(v) : JSON.stringify(v);
    if (txt.length > 300) txt = txt.slice(0, 300) + "…";
    lines.push("- " + pt + "：" + txt);
  });
  if (!lines.length) return "";
  return "\n\n【这几项是他的身份，原样照抄回来，一个字都不要改】\n" + lines.join("\n");
}
// 🌱 也要喂回去，但说法不一样：默认沿用，有理由才改，一次别改一片
function phoneEvolveBlock(appKey, oldData) {
  const paths = PHONE_EVOLVE[appKey];
  if (!paths || !oldData) return "";
  const lines = [];
  paths.forEach(pt => {
    const v = phoneGetPath(oldData, pt);
    if (!phoneHasVal(v)) return;
    let txt = (typeof v === "string" || typeof v === "number") ? String(v) : JSON.stringify(v);
    if (txt.length > 300) txt = txt.slice(0, 300) + "…";
    lines.push("- " + pt + "：" + txt);
  });
  if (!lines.length) return "";
  return "\n\n【这几项是他现在的样子，默认照抄回来】\n" + lines.join("\n")
    + "\n它们不是永远不能变——**关系真的变了、他真的搬了家、口味真的换了，就该跟着变**。"
    + "但一次刷新最多动其中一两项，而且改了的那项要能说得出为什么改。**没有理由就原样抄回来。**"
    + "\n新写的内容必须和上面这些对得上（地址、账号、称呼、口味都照这份来），别另编一份。";
}

// ─────────────────────────────────────────────────────────────
// 累积层：日志该越攒越长，当前状态该照实重写
// ─────────────────────────────────────────────────────────────
// 上面钉死了身份，这里管剩下那些。剩下的又分两种，别混：
//
//   · 【日志】——通话、便签、订单、搜索、看过的视频。它们是「发生过的事」，
//     发生过就不该消失。新的并进旧的，攒到上限从最旧的挤掉。
//   · 【当前状态】——购物车、在途包裹、开着的标签页、本月消费、今天的健康。
//     它们是「此刻是什么样」，每次刷新照实重写才对。攒起来反而是错的：
//     购物车里堆着三个月前的东西，那不叫真实，那叫没清过。
//
// 判据：这一栏说的是「发生过什么」还是「现在是什么样」？前者累积，后者重写。
//
// ⚠️相对时间会变成谎话。存下来的是「今天 09:12」这个字符串，一周后它还写着
// 「今天」。所以并进来的那一刻就把时刻算死（_ts），并且在它不再是今天的时候
// 把显示的那行改写成绝对写法——只改一次，之后不再动。
const PHONE_GROW = {
  wechat: { chats: 14, moments: 14, contacts: 24, "me.accounts": 12 },
  notes: { items: 24 },
  calls: { calls: 30, sms: 20, voicemail: 12, frequent: 12, blocked: 10 },
  browser: { searches: 44, marks: 14, private: 10 },
  shopping: { orders: 36, wish: 24, viewed: 24, shops: 18, gifts: 20 },
  takeout: { orders: 36, shops: 18, wish: 16, together: 16 },
  // 相册的收口交给 phoneAlbumTidy（要先判重、再按五类保底分配额）。
  // 在这一步就砍到 80 的话，数量少的那一类会先被挤掉，保底就没得保了。
  album: { items: 400 },
  liked: { items: 36, mine: 16, drafts: 12, follows: 20 },
  bili: { items: 34 },
  latenight: { items: 34 },
  clipboard: { items: 24 },
  // 账本这几栏都是【长期挂着】的东西：欠着的没还、放过的话没收回、舍不得的一直舍不得。
  // 所以一律累积——它本来就不是「最近怎么样」，是「一直以来欠着什么」。
  tally: { debts: 14, policies: 10, statements: 22, treasures: 18, appraisals: 16 },
  mail: { inbox: 30, sent: 20, drafts: 10 }
};
// ── 每周自动刷一次（她 2026-08-29 定：像周刊，抓上一周的素材）──
// ⚠️不是真的「周一 0:00 有个定时器在跑」——PWA 后台不执行代码，
// 半夜没人会替你调模型。真实含义是：**进入新的一周之后，你第一次打开 App
// （或切回前台）时补刷一次**。跟行程、钱包补账完全一样的形状，靠一个
// 「上次刷到哪一周」的游标防重复，而不是靠闹钟。
// 周从【周一】起算，跟她说的「周一 0:00」对齐。
function phoneWeekKey(d) {
  const x = new Date(d || Date.now());
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));   // 退到本周一
  return x.getFullYear() + "-W" + String(Math.floor((x.getTime() - new Date(x.getFullYear(), 0, 1).getTime()) / 604800000) + 1).padStart(2, "0");
}
// 周刊式刷新时告诉模型取材的时间窗。平时手动刷不发这一段。
const PHONE_WEEKLY_HINT = "\n\n【这一次是每周一次的例行刷新】写的是**过去这一周**新发生的事，"
  + "不是从头再编一遍他这个人。上面列出来的旧东西该留的留着，你补的是这七天里多出来的那些。"
  + "一周该有一周的量：不必每一栏都塞满，有些栏这一周本来就没什么新的。";

// ── 健康的趋势：另存每日轻量快照，不把整份报告天天累计 ──────
// 健康那一份【全部 ♻️ 是对的】——它代表今天，不是病历。
// 但「这一周睡得怎么样」是真的想知道的东西，所以每次刷新另外抽一条极轻的
// 快照存起来：一个综合分 + 几个核心指标，一天一条，留 90 天。
// 整份报告天天累计是错的（Codex 指出）：那不是趋势，那是一堆重复的长文。
const PHONE_VITAL_DAYS = 90;
const PHONE_VITAL_MARKS = 10;
function phoneVitalOf(healthData, nowTs) {
  const d = (healthData && typeof healthData === "object") ? healthData : null;
  if (!d) return null;
  const today = d.today && typeof d.today === "object" ? d.today : {};
  const score = Number(today.score);
  const cards = Array.isArray(d.cards) ? d.cards : [];
  const marks = {};
  cards.slice(0, PHONE_VITAL_MARKS).forEach(c => {
    if (!c || typeof c !== "object") return;
    const n = String(c.name || "").trim();
    const v = Number(c.score);
    if (n && isFinite(v)) marks[n] = Math.round(v);
  });
  if (!isFinite(score) && !Object.keys(marks).length) return null;
  const dt = new Date(nowTs || Date.now());
  return {
    day: dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"),
    score: isFinite(score) ? Math.round(score) : null,
    marks: marks
  };
}
// 一天一条，同一天覆盖（一天刷好几次只留最后那次）；留 90 天
function phoneVitalMerge(prev, add) {
  if (!add) return Array.isArray(prev) ? prev : [];
  const list = (Array.isArray(prev) ? prev : []).filter(x => x && x.day !== add.day);
  list.push(add);
  list.sort((a, b) => String(a.day) < String(b.day) ? 1 : -1);
  return list.slice(0, PHONE_VITAL_DAYS);
}

// ── 名册：累积保稳定，墓碑保能出去 ─────────────────────────
// 书签会取消收藏、草稿会发出去或删掉、关注会取关、黑名单里的人会被放出来、
// 想买的会买到手或不想要了。这几样不是日志（不是「发生过什么」），是名册
// （「现在有哪些」）——但也不能做成 ♻️ 每次重掷：♻️ 的字段压根不发回给模型，
// 它会每次凭空编一份新黑名单，比只进不出还糟。
//
// 所以走【累积 + 墓碑】：名单原样发回去，还在的照抄，不在了的写进 retired。
// ⚠️关键是必须【显式】退出——累积层里「没写」等于「还在」，不等于「删了」。
// 提示词里这句话是这一层的全部：不写不算删，要删就写进 retired。
const PHONE_RETIRE = {
  browser: { marks: "书签" },
  liked: { follows: "关注的人", drafts: "草稿箱" },
  calls: { frequent: "常联系", blocked: "黑名单" },
  shopping: { wish: "想买清单" },
  takeout: { wish: "想吃的" },
  // 草稿会发出去或删掉，是名册不是日志
  mail: { drafts: "草稿箱" }
};
// 一行在名单上叫什么（用来和 retired 里的名字对上）
const phoneRowName = x => {
  if (!x || typeof x !== "object") return String(x == null ? "" : x);
  return ["name", "title", "caption", "q", "text", "shop", "who"]
    .map(k => (typeof x[k] === "string" ? x[k].trim() : "")).filter(Boolean)[0] || "";
};
// 名字对名字：去掉空白和标点再比，模型回写时标点常常飘
const phoneNameNorm = v => String(v == null ? "" : v).replace(/[\s。，、,.!！?？:：;；"'「」『』（）()\[\]【】~～·-]/g, "");
// 明确【不累积】的（当前状态，每次刷新照实重写）——写出来是为了别人来看的时候
// 知道这不是漏了：
//   browser.tabs（现在开着哪些）、shopping.cart / shopping.shipping（购物车与在途）、
//   takeout.today / takeout.live（今天这单与在途）、takeout.week（本周吃了什么）、
//   health.*（今天的身体状况，每天重算）、*.coupons（会过期）、
//   *.account.month* / points（本月统计）、latenight.me.lastAt / note、
//   latenight.me.note
const PHONE_TIME_FIELDS = ["time", "date", "savedAt", "lastAt"];
const phoneTimeField = x => (x && typeof x === "object") ? PHONE_TIME_FIELDS.find(k => typeof x[k] === "string" && x[k].trim()) : undefined;
// 一行的身份：由内容决定，不用模型自己编的 id（那玩意儿每次都变，或者反过来撞车）
const phoneRowKey = x => {
  if (!x || typeof x !== "object") return String(x);
  // 只认【一个】标识字段 + 时刻。取两个的话，正文改一个字就成了新的一条——
  // 模型重写同一件事时措辞总会变，那样永远认不出是同一条，会攒成两份。
  const word = ["title", "caption", "q", "text", "content", "main", "shop", "name", "body", "excerpt", "transcript", "from", "author", "number"]
    .map(k => (typeof x[k] === "string" ? x[k].trim() : "")).filter(Boolean)[0];
  const f = phoneTimeField(x);
  return (word || JSON.stringify(x).slice(0, 90)) + "@" + (f ? x[f] : "");
};
// 「今天 09:12」存久了就是谎话，落成绝对写法。只落一次（_abs），之后不再动。
function phoneFreezeTime(x, nowTs) {
  const f = phoneTimeField(x);
  if (!f) return x;
  const ts = x._ts != null ? x._ts : phoneWhenTs(x[f], nowTs);
  if (ts == null) return x;
  const out = { ...x, _ts: ts };
  if (out._abs) return out;
  const d = new Date(ts), n = new Date(nowTs);
  const sameDay = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  if (sameDay) return out;                 // 还是今天，「今天 09:12」没说错，先留着
  // 只改写【相对】写法。本来就写成绝对日期的别动——相册跨年，把
  // 「2024-03-11 18:42」改成「3月11日」会丢掉年份，下次一解析就认成今年。
  if (!/今|昨|前天|刚刚|刚才|天前|分钟前|小时前|周|星期|礼拜|月前|存了|放了|开了|过了/.test(String(x[f]))) { out._abs = 1; return out; }
  const hm = /(\d{1,2})\s*[:：]\s*(\d{2})/.test(String(x[f]));
  out[f] = (d.getFullYear() !== n.getFullYear() ? d.getFullYear() + "年" : "")
    + (d.getMonth() + 1) + "月" + d.getDate() + "日"
    + (hm ? " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") : "");
  out._abs = 1;
  return out;
}
// 新的并进旧的：新的在前（同一条以新的为准），有时刻的按时间倒序，攒到上限挤掉最旧的
function phoneGrowList(fresh, old, cap, nowTs) {
  const A = a => Array.isArray(a) ? a : [];
  const now = nowTs || Date.now();
  const seen = {};
  const out = [];
  A(fresh).concat(A(old)).forEach(x => {
    if (x == null) return;
    const frozen = (x && typeof x === "object") ? phoneFreezeTime(x, now) : x;
    const k = phoneRowKey(frozen);
    if (seen[k]) return;
    seen[k] = 1;
    out.push(frozen);
  });
  // 全都认得出时刻才排序——一半有一半没有的话，排完顺序更乱
  if (out.length && out.every(x => x && typeof x === "object" && x._ts != null)) out.sort((a, b) => b._ts - a._ts);
  return out.slice(0, cap || 30);
}
// 阅读单开一路：它是【两层】的（shelves[].books[]），上面那套平的配置盖不住。
// 不处理的话，书架名每刷一次全换（她 v57.47 专门要求书架名要有脾气，等于白要），
// 而且一架书永远只有生成那一轮的几本——攒不起来。
// 规矩：书架按名字认人，老架子留着；每架里的书累积；新长出来的架子接在后面。
const PHONE_SHELF_CAP = 8, PHONE_BOOK_CAP = 40;
function phoneMergeShelves(oldData, newData, nowTs) {
  const A = a => Array.isArray(a) ? a : [];
  const oldSh = A(oldData && oldData.shelves), newSh = A(newData && newData.shelves);
  if (!oldSh.length) return newData;
  const byName = {};
  newSh.forEach(sh => { if (sh && sh.name) byName[String(sh.name)] = sh });
  const out = [];
  const used = {};
  oldSh.forEach(sh => {
    if (!sh || !sh.name) return;
    const n = byName[String(sh.name)];
    used[String(sh.name)] = 1;
    out.push({ ...sh, books: phoneGrowList(n && n.books, sh.books, PHONE_BOOK_CAP, nowTs) });
  });
  newSh.forEach(sh => { if (sh && sh.name && !used[String(sh.name)]) out.push(sh) });
  return { ...newData, shelves: out.slice(0, PHONE_SHELF_CAP) };
}
// ── 相册单开一路：回收站会过期、五类要留住、同一张照片别攒两份 ──
// 相册的「最近删除」是个回收站，不是相簿：iOS 里 30 天就自动清空。
// 累积层不管的话，删掉的照片会永远躺在那儿，越攒越多（Codex 2026-08-29 指出）。
const PHONE_TRASH_DAYS = 30;
const PHONE_ALBUM_CATS = ["memory", "favorite", "saved", "private", "deleted"];
const PHONE_ALBUM_CAP = 80;
// 满仓时每一类的保底。不设保底的话，某一类（比如「私密」本来就只有一两张）
// 会被数量大的那类挤到一张不剩——相册就退化成一本流水账（Codex 提的）。
const PHONE_ALBUM_MIN = 8;
// 同一张照片换个说法就攒两份（现在只按标题+日期认人）。真语义判重要跑向量，
// 那太重了。这里用一条【启发式】：同一天里，两条标题去掉标点空白之后，
// 一方包含另一方、或者头六个字一样，就认成同一张，留新的那条。
// 它挡不住完全换一套说法的情况——那种只能靠模型自己不重复写；
// 但「秒撤回的邀请记录」和「那条秒撤回的邀请记录。」这类最常见的重复能挡住。
const phoneCapNorm = v => String(v == null ? "" : v).replace(/[\s。，、,.!！?？:：;；"'「」『』（）()\[\]【】~～·-]/g, "");
function phoneSamePhoto(a, b, nowTs) {
  const da = a._ts != null ? a._ts : phoneWhenTs(a.date, nowTs);
  const db = b._ts != null ? b._ts : phoneWhenTs(b.date, nowTs);
  if (da == null || db == null) return false;
  const d1 = new Date(da), d2 = new Date(db);
  if (d1.getFullYear() !== d2.getFullYear() || d1.getMonth() !== d2.getMonth() || d1.getDate() !== d2.getDate()) return false;
  const ca = phoneCapNorm(a.caption), cb = phoneCapNorm(b.caption);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca.indexOf(cb) >= 0 || cb.indexOf(ca) >= 0) return true;
  if (ca.length >= 6 && cb.length >= 6 && ca.slice(0, 6) === cb.slice(0, 6)) return true;
  // 字重排：「秒撤回的那条邀请记录」和「那条秒撤回的邀请记录」——模型改写时
  // 最爱换语序，字一个没变。字排序后相同就是同一张。
  const sortCh = v => [...v].sort().join("");
  if (ca.length >= 5 && sortCh(ca) === sortCh(cb)) return true;
  // 近似：同一天里字重合度很高的也算同一张（改写常常只换掉一两个字）
  if (ca.length >= 6 && cb.length >= 6) {
    const A2 = new Set([...ca]), B2 = new Set([...cb]);
    let inter = 0;
    A2.forEach(c => { if (B2.has(c)) inter++; });
    const jac = inter / (A2.size + B2.size - inter);
    if (jac >= 0.85) return true;
  }
  return false;
}
function phoneAlbumTidy(data, nowTs) {
  if (!data || !Array.isArray(data.items)) return data;
  const now = nowTs || Date.now();
  const floor = now - PHONE_TRASH_DAYS * 86400000;
  // ① 回收站过期（认不出日期的留着，不瞎删）
  let items = data.items.filter(x => {
    if (!x || typeof x !== "object") return false;
    if (x.category !== "deleted") return true;
    const ts = x._ts != null ? x._ts : phoneWhenTs(x.date, now);
    return ts == null || ts >= floor;
  });
  // ② 语义判重：留先出现的那条（列表是新在前，所以留的是新的）
  const kept = [];
  items.forEach(x => { if (!kept.some(y => phoneSamePhoto(x, y, now))) kept.push(x); });
  items = kept;
  // ③ 五类保底再补齐到总量上限
  if (items.length > PHONE_ALBUM_CAP) {
    const picked = [], taken = {};
    PHONE_ALBUM_CATS.forEach(cat => {
      items.forEach(x => {
        if (x.category !== cat) return;
        const n = picked.filter(y => y.category === cat).length;
        if (n >= PHONE_ALBUM_MIN) return;
        picked.push(x); taken[items.indexOf(x)] = 1;
      });
    });
    items.forEach((x, i) => { if (!taken[i] && picked.length < PHONE_ALBUM_CAP) picked.push(x); });
    // 按原来的先后（新在前）排回去
    items = items.filter(x => picked.indexOf(x) >= 0).slice(0, PHONE_ALBUM_CAP);
  }
  return items.length === data.items.length ? data : { ...data, items: items };
}
function phoneGrowMerge(appKey, oldData, newData, nowTs) {
  if (appKey === "reading") return phoneMergeShelves(oldData, newData, nowTs);
  const conf = PHONE_GROW[appKey];
  if (!conf || !newData || typeof newData !== "object") return newData;
  const out = JSON.parse(JSON.stringify(newData));
  const now = nowTs || Date.now();
  const retired = (newData && newData.retired && typeof newData.retired === "object") ? newData.retired : {};
  Object.keys(conf).forEach(field => {
    const fresh = phoneGetPath(out, field);
    const old = oldData ? phoneGetPath(oldData, field) : null;
    if (!Array.isArray(fresh) && !Array.isArray(old)) return;
    let list = phoneGrowList(fresh, old, conf[field], now);
    // 墓碑：模型显式说这几个已经不在名单上了
    const gone = (Array.isArray(retired[field]) ? retired[field] : []).map(phoneNameNorm).filter(Boolean);
    if (gone.length) list = list.filter(x => gone.indexOf(phoneNameNorm(phoneRowName(x))) < 0);
    phoneSetPath(out, field, list);
  });
  delete out.retired;    // 它是一条指令，不是要存下来的内容
  return appKey === "album" ? phoneAlbumTidy(out, now) : out;
}
// 存进去的那一份：新生成的 + 沿用的身份 + 并进来的日志
function phoneMergeSaved(appKey, oldData, newData, nowTs) {
  // 顺序：🔒 硬钉死盖回来 → 🌱 缓慢演化收口 → 📚 日志并进来。
  // 剩下没登记的一律 ♻️ 照实重写。
  return phoneGrowMerge(appKey, oldData,
    phoneEvolveMerge(appKey, oldData, phoneKeepIdentity(appKey, oldData, newData)), nowTs);
}
// 名册发回去。跟 phoneSelfAvoidBlock 说的是相反的话：
// 日志那些「别再写一遍」，名册这些「还在的请照抄回来」。
function phoneRosterBlock(appKey, known) {
  const conf = PHONE_RETIRE[appKey];
  if (!conf || !known) return "";
  const lines = [];
  Object.keys(conf).forEach(field => {
    const arr = phoneGetPath(known, field);
    if (!Array.isArray(arr) || !arr.length) return;
    const names = arr.map(phoneRowName).filter(Boolean).slice(0, 24);
    if (names.length) lines.push("- " + conf[field] + "（" + field + "）：" + names.join("｜"));
  });
  if (!lines.length) return "";
  return "\n\n【他这几份名单上现在有这些】\n" + lines.join("\n")
    + "\n**还在名单上的请原样照抄回来**（连名字一起，别改写），这几份是「现在有哪些」不是「这次新增了哪些」。"
    + "\n**已经不在了的，写进 retired**：取消收藏的书签、发出去或删掉的草稿、取关的人、放出黑名单的人、买到手或不想要了的东西。"
    + " retired 的格式是 {\"字段名\":[\"那一条在名单上的名字\"]}，名字要和上面列的对得上。"
    + "\n⚠️**光是不写它不算删掉**——不写等于它还在。要它消失就必须写进 retired。"
    + "\n大多数轮次 retired 是空的：名单本来就该慢慢变，不是每次换一批。";
}
// 同一个 app 里已经攒着的那些，回喂给模型：别把已经有的再写一遍。
// 这跟跨 app 的 phoneAvoidBlock 是同一个形状，只是范围换成了自己。
function phoneSelfAvoidBlock(appKey, known) {
  const conf = PHONE_GROW[appKey];
  if (!conf || !known) return "";
  const roster = PHONE_RETIRE[appKey] || {};
  const lines = [];
  Object.keys(conf).forEach(field => {
    // 名册那几栏走 phoneRosterBlock，说的是「照抄回来」；
    // 这儿说的是「别再写一遍」——同一栏两句相反的话，模型必然写歪。
    if (roster[field]) return;
    const arr = phoneGetPath(known, field);
    if (!Array.isArray(arr) || !arr.length) return;
    const picked = arr.slice(0, 12).map(x => {
      if (!x || typeof x !== "object") return String(x || "");
      return ["title", "caption", "q", "text", "name", "shop", "main"].map(k => typeof x[k] === "string" ? x[k].trim() : "").filter(Boolean)[0] || "";
    }).filter(Boolean);
    if (picked.length) lines.push("- " + field + "：" + picked.join("｜"));
  });
  if (!lines.length) return "";
  let body = lines.join("\n");
  if (body.length > 1200) body = body.slice(0, 1200) + "…";
  return "\n\n【这个 app 里已经攒着这些了，不要再写一遍】\n" + body
    + "\n你这次写的是【新发生的】，和上面这些都不一样的东西。旧的会自己留在下面，不用你重复。";
}

// ─────────────────────────────────────────────────────────────
// 归档：刷新会整份覆盖某个 app，旧痕迹就没了
// ─────────────────────────────────────────────────────────────
// savePhoneApp 是【整份覆盖】那个 app 的数据。所以在加这一层之前，时间线其实
// 只是「当前快照的重排」：刷新一次，昨天翻到的东西全消失，delta 也就退化成
// 「这次刷了哪几个 app」。她 2026-08-29 一眼看出来了。
//
// 修法不多花一次调用：覆盖之前，先把旧那份抽成时间线条目存起来。
// 时间线 =「归档 ∪ 当前」，靠指纹去重，同一条刷两次不会出现两遍。
//
// ⚠️时间戳必须在【归档那一刻】就算死。「昨天 21:03」这种相对写法，隔一周再解析
// 就漂到别的日子去了；存的时候它还是当时那个意思，之后就不许再重算。
const PHONE_ARCH_CAP = 500;          // 每人封顶条数
const PHONE_ARCH_DAYS = 90;          // 只留这么多天内的
// 全局再封一道。她 2026-08-29 搬进 VPS 之后不再跟 localStorage 那 5MB 抢地方，
// 所以这道放宽了——但不能没有：无上限的日志迟早会把加载和云同步拖慢。
// 超了从最旧的开始扔。
const PHONE_ARCH_CAP_ALL = 20000;
// 归档存的是精简版：正文和心声各截到 120 字。整条时间线只显示一两行，
// 存全文纯粹是拿 localStorage 换看不见的东西（她的存档本来就紧）。
const phoneArchTrim = r => ({
  app: r.app, tag: r.tag, when: r.when, ts: r.ts, id: r.id,
  title: String(r.title || "").slice(0, 60),
  text: String(r.text || "").slice(0, 120),
  thought: String(r.thought || "").slice(0, 120)
});
// 把某个 app 【即将被覆盖】的那份数据抽成时间线条目
function phoneArchiveFrom(appKey, oldData, nowTs) {
  if (!appKey || !oldData) return [];
  const box = {};
  box[appKey] = oldData;
  try { return phoneTimeline(box, null, nowTs || Date.now()).map(phoneArchTrim); } catch (e) { return []; }
}
// 并进归档：指纹去重（先到的那份为准，保住它当初算出来的时刻），
// 然后砍掉太旧的、超量的。认不出时间的不进归档——它在线上没有位置，留着只占地方。
function phoneArchMerge(prev, add, nowTs) {
  const now = nowTs || Date.now();
  const floor = now - PHONE_ARCH_DAYS * 86400000;
  const seen = {};
  const out = [];
  (Array.isArray(prev) ? prev : []).concat(Array.isArray(add) ? add : []).forEach(r => {
    if (!r || !r.id || r.ts == null) return;
    if (r.ts < floor) return;
    if (seen[r.id]) return;
    seen[r.id] = 1;
    out.push(r);
  });
  out.sort((a, b) => b.ts - a.ts);
  return out.slice(0, PHONE_ARCH_CAP);
}
// 全库超量时按时间从最旧的开始扔（不是按角色平均砍——翻得多的那个角色
// 本来就该留得多）。返回新的整张表。
function phoneArchCapAll(map) {
  const m = (map && typeof map === "object") ? map : {};
  const ids = Object.keys(m);
  let total = 0;
  ids.forEach(k => { total += (Array.isArray(m[k]) ? m[k] : []).length });
  if (total <= PHONE_ARCH_CAP_ALL) return m;
  const all = [];
  ids.forEach(k => (Array.isArray(m[k]) ? m[k] : []).forEach(r => { if (r && r.ts != null) all.push({ k, r }) }));
  all.sort((a, b) => b.r.ts - a.r.ts);
  const out = {};
  all.slice(0, PHONE_ARCH_CAP_ALL).forEach(x => { (out[x.k] = out[x.k] || []).push(x.r) });
  return out;
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
// 全局搜索：在他手机里搜一个词
// ─────────────────────────────────────────────────────────────
// 所有偷看动作里最真的一个是【搜自己的名字】——看她在他手机的几个角落出现过、
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
  if (uc) add("wechat", "他给你的备注", S(uc.name) + "（备注：" + S(uc.remark) + "）", uc.intro);
  A(g("calls").frequent).forEach(x => x && add("calls", "常联系", x.name, x.why));
  A(g("calls").blocked).forEach(x => x && add("calls", "黑名单", x.name, x.why));
  A(g("browser").marks).forEach(f => f && A(f.items).forEach(x => x && add("browser", "书签 · " + S(f.name), x.title, x.site)));
  A(g("shopping").wish).forEach(x => x && add("shopping", "想买没买", x.title, x.why));
  A(g("shopping").gifts).forEach(x => x && add("shopping", "送出去的", x.title, S(x.who) + "｜" + S(x.note)));
  A(g("takeout").wish).forEach(x => x && add("takeout", "想吃的", x.title, x.when));
  A(g("takeout").together).forEach(x => x && add("takeout", "一起吃过", x.who, S(x.items) + "｜" + S(x.story)));
  A(g("liked").follows).forEach(x => x && add("liked", "关注的人", x.name, x.desc));
  A(g("reading").shelves).forEach(sh => sh && A(sh.books).forEach(b => b && add("reading", "书架 · " + S(sh.name), b.title, S(b.author) + "｜" + S(b.note))));
  const tl = g("tally");
  A(tl.debts).forEach(x => x && add("tally", "没结清", x.title, x.note));
  A(tl.policies).forEach(x => x && add("tally", "兜底", x.name, S(x.clause) || S(x.scope)));
  A(tl.statements).forEach(x => x && add("tally", "定论", x.text, x.heat));
  A(tl.treasures).forEach(x => x && add("tally", "估价", x.title, x.worth));
  A(tl.appraisals).forEach(x => x && add("tally", "自问", x.q, x.a));
  A(g("mail").drafts).forEach(x => x && add("mail", "写了没发", x.subject, S(x.to) + "｜" + S(x.body)));
  A(L.forumAccounts).forEach(a => a && add("forum", S(a.label) + "账号", S(a.name), a.bio));
  A(((L.playlist || {}).songs)).forEach(x => x && add("music", "歌单", S(x.title) + " · " + S(x.artist), x.note));
  return out;
}
// 一个词在这部手机里出现在哪儿。词不区分大小写、去掉空白再比。
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
const parseMins = s => {
  s = String(s || "");
  let m = 0;
  const hm = s.match(/(\d+)\s*(小时|时|h)/i),
    mm = s.match(/(\d+)\s*(分|min|m)/i);
  if (hm) m += parseInt(hm[1]) * 60;
  if (mm) m += parseInt(mm[1]);
  if (!hm && !mm) {
    const n = s.match(/\d+/);
    if (n) m = parseInt(n[0]);
  }
  return m;
};
const fmtMoney = n => "¥" + Number(n || 0).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const fmtMD = d => d.getMonth() + 1 + "月" + d.getDate() + "日";
const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
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
function PGlyph({
  k,
  size = 26,
  color = "#1b1a17"
}) {
  const P = d => h("path", {
    d
  });
  const C = (cx, cy, r) => h("circle", {
    cx,
    cy,
    r
  });
  const R = (x, y, w, ht, rx) => h("rect", {
    x,
    y,
    width: w,
    height: ht,
    rx
  });
  const kids = {
    wechat: [P("M21 11.5a8.5 8.5 0 01-8.5 8.5 8.5 8.5 0 01-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 013.5 11.5 8.5 8.5 0 0112 3a8.5 8.5 0 019 8.5z")],
    notes: [P("M4.5 4.2h15v10.6l-4.4 4.4H4.5z"), P("M19.5 14.8h-4.4v4.4"), P("M8 8.4h8M8 11.8h6")],
    calls: [P("M22 16.9v3a2 2 0 01-2.2 2A19.8 19.8 0 013.1 4.2 2 2 0 015 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L9 11.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z")],
    browser: [C(12, 12, 9), P("M16.2 7.8l-2.1 6.4-6.4 2.1 2.1-6.4 6.4-2.1z")],
    shopping: [P("M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"), P("M3 6h18"), P("M16 10a4 4 0 01-8 0")],
    wallet: [R(3, 6, 18, 14, 2), P("M3 10h18"), C(17, 14, 1)],
    album: [R(3, 4, 18, 16, 2), C(8.5, 9, 1.5), P("M21 16l-5-5L5 20")],
    forum: [P("M21 15a2 2 0 01-2 2H8l-4 4V5a2 2 0 012-2h13a2 2 0 012 2z"), P("M8 9h8M8 12h5")],
    music: [P("M9 18V5l12-2v13"), C(6, 18, 3), C(18, 16, 3)],
    mic: [R(9, 2, 6, 12, 3), P("M5 10v2a7 7 0 0014 0v-2"), P("M12 19v3")],
    bili: [R(2.5, 6.5, 19, 14, 3.4), P("M7.5 2.6l3 3.9M16.5 2.6l-3 3.9"), h("polygon", {
      points: "10,10.5 15.5,13.5 10,16.5",
      fill: color,
      stroke: "none"
    })],
    latenight: [P("M20.5 14.6A8.6 8.6 0 019.4 3.5a8.6 8.6 0 1011.1 11.1z"), h("polygon", {
      points: "8.2,8.6 12,10.6 8.2,12.6",
      fill: color,
      stroke: "none"
    })],
    reading: [P("M12 6.6C10.5 5.1 8 4.3 5 4.3V19c3 0 5.5.8 7 2.3 1.5-1.5 4-2.3 7-2.3V4.3c-3 0-5.5.8-7 2.3z"), P("M12 6.6V21.3")],
    liked: [R(3.2, 3.2, 17.6, 17.6, 5), P("M9 8.4v7.2M15 8.4v7.2M9 12h6"), P("M12 8.4v7.2")],
    health: [P("M2.5 12.5H6l2.2-6.4 3.3 12.4 2.6-8.2 1.6 2.2h5.8")],
    clipboard: [R(6, 3.5, 12, 17.5, 2.2), R(9, 1.6, 6, 4, 1.2), P("M9.5 11.5h5M9.5 15.5h3.5")],
    calendar: [R(3, 5, 18, 16, 2.4), P("M3 10h18M8 2.6v4.4M16 2.6v4.4")],
    me: [C(12, 8, 3.7), P("M4.8 20.6a7.2 7.2 0 0114.4 0")],
    cart: [C(9.5, 20, 1.4), C(17.5, 20, 1.4), P("M2 3h3l2.6 12.2a1.6 1.6 0 001.6 1.3h8.4a1.6 1.6 0 001.6-1.3L21 7H6")],
    orders: [P("M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22z"), P("M9.5 7.5h5M9.5 11.5h5M9.5 15.5h3")],
    takeout: [P("M3 11h18a9 9 0 01-18 0z"), P("M2.5 20.5h19"), P("M12 3.2v2.4M8.6 4.4l.9 1.6M15.4 4.4l-.9 1.6")],
    timeline: [P("M7 3v18"), C(7, 7, 2.1), C(7, 13.4, 2.1), C(7, 19.6, 1.6), P("M11.5 7h8.5M11.5 13.4h6.5M11.5 19.6h4.5")],
    tally: [P("M5 3.2h14v17.6H5z"), P("M9 3.2v17.6"), P("M12 7.6h4.2M12 11.6h4.2M12 15.6h2.6"), P("M6.4 8.6l1.2 1.2 1.4-2.2")],
    mail: [R(2.6, 5, 18.8, 14, 2.6), P("M2.6 7.2l9.4 6.4 9.4-6.4")]
  };
  return h(Svg, {
    size,
    color,
    sw: 1.5
  }, ...(kids[k] || []));
}

// ─────────────────────────────────────────────────────────────
// 邮件：他对外那一面
// ─────────────────────────────────────────────────────────────
// 这个 app 的全部意义是【落差】：邮件里的他是对陌生人和上级说话的样子，
// 客气、绕、留余地；而同一个人在便签里骂的是另一句。
// 界面照着真邮箱做：列表只露主题和那一截，点进去才是全文。
const MAIL_BG = "#f2f4f7", MAIL_INK = "#1b1f26", MAIL_DIM = "#8a919c", MAIL_LINE = "#e3e7ec", MAIL_BLUE = "#2f6fd0";
const MAIL_TABS = [{ k: "inbox", zh: "收件箱" }, { k: "sent", zh: "发出去的" }, { k: "drafts", zh: "草稿" }];
function MailView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [tab, setTab] = useState("inbox");
  const [open, setOpen] = useState(null);
  const A = a => Array.isArray(a) ? a : [];
  const S = v => String(v == null ? "" : v).trim();
  const data = (d && typeof d === "object") ? d : {};
  const me = (data.me && typeof data.me === "object") ? data.me : {};
  const rows = k => A(data[k]).filter(x => x && typeof x === "object");
  const who = x => S(x.from) || S(x.to) || "—";
  const unreadN = rows("inbox").filter(x => x.unread).length;

  const listRow = (x, i, kind) => h("button", {
    key: i, onClick: () => setOpen({ ...x, _kind: kind }),
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
          flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: 14.5, color: MAIL_INK,
          fontWeight: (kind === "inbox" && x.unread) ? 600 : 400,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }
      }, kind === "drafts" ? ("给 " + (S(x.to) || "谁")) : who(x)),
      h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10.5, color: MAIL_DIM, flexShrink: 0 } }, S(x.time) || S(x.savedAt))),
    h("div", {
      style: { fontFamily: F_BODY, fontSize: 13, color: MAIL_INK, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
    }, S(x.subject) || "（没有主题）"),
    h("div", {
      style: { fontFamily: F_BODY, fontSize: 12, color: MAIL_DIM, marginTop: 2, lineHeight: 1.55,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }
    }, S(x.preview) || S(x.body)),
    S(x.kind) && kind === "inbox" ? h("span", {
      style: { display: "inline-block", marginTop: 6, fontFamily: F_BODY, fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#e7ebf1", color: MAIL_DIM }
    }, S(x.kind)) : null));

  const body = rows(tab).length
    ? rows(tab).map((x, i) => listRow(x, i, tab))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: MAIL_DIM } },
        tab === "drafts" ? "草稿箱是空的" : tab === "sent" ? "他最近没往外发什么" : "收件箱是空的");

  const detail = open ? h("div", { className: "absolute inset-0 flex flex-col", style: { background: "#fff", zIndex: 30 } },
    h("div", { className: "shrink-0 flex items-center px-2 pb-2", style: { paddingTop: safeTop(8), borderBottom: "1px solid " + MAIL_LINE } },
      h("button", { onClick: () => setOpen(null), "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IArrow, { size: 19, color: MAIL_INK })),
      h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_BODY, fontSize: 12.5, color: MAIL_DIM } },
        open._kind === "drafts" ? "草稿 · 没发出去" : open._kind === "sent" ? "已发送" : "收件箱"),
      h("div", { style: { width: 40 } })),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, lineHeight: 1.5, color: MAIL_INK, marginTop: 18, wordBreak: "break-word" } }, S(open.subject) || "（没有主题）"),
      h("div", { className: "flex items-center", style: { gap: 10, marginTop: 14, paddingBottom: 14, borderBottom: "1px solid " + MAIL_LINE } },
        h("span", {
          "aria-hidden": "true",
          style: { width: 34, height: 34, borderRadius: 99, flexShrink: 0, background: "#e7ebf1", color: MAIL_DIM, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 15 }
        }, (who(open) || "?").slice(0, 1)),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: MAIL_INK, wordBreak: "break-word" } },
            open._kind === "inbox" ? who(open) : ("给 " + (S(open.to) || "谁"))),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: MAIL_DIM, marginTop: 2, wordBreak: "break-all" } },
            [S(open.fromAddr), S(open.time) || S(open.savedAt)].filter(Boolean).join(" · ")))),
      h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 2, color: "#3c424b", marginTop: 16, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, S(open.body)),
      // 他心里那句：邮件那套客气话之外的真话，落差就在这儿
      S(open.thought) ? h("div", {
        style: { marginTop: 20, background: "#f5f7fa", borderRadius: 13, padding: "13px 15px" }
      },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: MAIL_DIM } }, "他看完心里那句"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.9, color: MAIL_INK, marginTop: 5, wordBreak: "break-word" } }, S(open.thought))) : null,
      open._kind === "drafts" ? h("div", {
        style: { marginTop: 18, fontFamily: F_BODY, fontSize: 12, color: "#b6473c", lineHeight: 1.8 }
      }, "这封一直没发出去。" + (S(open.savedAt) ? "已经存了 " + S(open.savedAt) + "。" : "")) : null,
      onPeek ? h("button", {
        onClick: () => onPeek({
          tier: open._kind === "drafts" ? "hidden" : "quiet",
          label: open._kind === "drafts" ? "邮件 · 写了没发的那封" : open._kind === "sent" ? "他发出去的邮件" : "他收到的邮件",
          title: S(open.subject),
          text: [open._kind === "inbox" ? who(open) : "给 " + S(open.to), S(open.body), S(open.thought)].filter(Boolean).join("｜")
        }),
        className: "w-full active:opacity-60",
        style: {
          marginTop: 22, padding: "12px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: 12.5,
          border: "1px solid " + (open._kind === "drafts" ? "rgba(182,71,60,.42)" : MAIL_LINE),
          color: open._kind === "drafts" ? "#b6473c" : MAIL_INK
        }
      }, open._kind === "drafts" ? "摆到他面前 · 这封他没敢发" : "转发给 TA · 他会知道你翻了手机") : null)) : null;

  return h("div", { className: "h-full min-h-0 flex flex-col relative", style: { background: MAIL_BG } },
    h("div", { className: "shrink-0 px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("div", { className: "flex items-center", style: { gap: 8 } },
        h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 38, height: 38, marginLeft: -6 } }, h(IArrow, { size: 19, color: MAIL_INK })),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: MAIL_INK } },
            "邮件" + (unreadN ? " · " + unreadN + " 封未读" : "")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: MAIL_DIM, marginTop: 1, wordBreak: "break-all" } }, S(me.addr))),
        h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 38, height: 38 } }, h(IRefresh, { size: 17, color: MAIL_INK }))),
      h("div", { className: "flex", style: { gap: 4, marginTop: 10 } }, MAIL_TABS.map(x => h("button", {
        key: x.k, onClick: () => { setTab(x.k); setOpen(null); },
        className: "flex-1 active:opacity-60",
        style: {
          fontFamily: F_BODY, fontSize: 12.5, padding: "7px 4px", borderRadius: 9,
          background: tab === x.k ? "#fff" : "transparent", color: tab === x.k ? MAIL_INK : MAIL_DIM,
          border: "1px solid " + (tab === x.k ? MAIL_LINE : "transparent")
        }
      }, x.zh + (rows(x.k).length ? " " + rows(x.k).length : ""))))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingBottom: COMPOSER_PAD_BOTTOM, background: "#fff", borderTop: "1px solid " + MAIL_LINE } }, body),
    detail);
}

// ─────────────────────────────────────────────────────────────
// 账本：他心里给这段关系记的那本账
// ─────────────────────────────────────────────────────────────
// 五栏各有各的腔调，界面也就各长各的样子——挤成一个样式就白分了。
//   负债 = 两栏对账（他欠 / 她欠 / 悬着）
//   保单 = 条款卡（虚线框、条目式）
//   声明 = 一句一张的盖章卡
//   藏品 = 横滑的估价牌
//   估值 = 问答
const TALLY_BG = "#f4f2ee", TALLY_INK = "#1f1d1a", TALLY_DIM = "#8b8578", TALLY_LINE = "rgba(31,29,26,.12)";
const TALLY_DIR = { mine: { zh: "他欠", c: "#b6473c" }, theirs: { zh: "记着", c: "#3f7f8a" }, open: { zh: "还悬着", c: "#8b8578" } };
const TALLY_TABS = [
  { k: "debts", zh: "没结清", en: "OPEN" },
  { k: "policies", zh: "兜底", en: "COVER" },
  { k: "statements", zh: "定论", en: "STAMP" },
  { k: "treasures", zh: "估价", en: "WORTH" },
  { k: "appraisals", zh: "自问", en: "ASK" }
];
function TallyView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [tab, setTab] = useState("debts");
  const [open, setOpen] = useState(null);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const S = v => String(v == null ? "" : v).trim();
  const count = k => A(data[k]).filter(x => x && typeof x === "object").length;
  const card = (kids, key, onClick, dashed) => h(onClick ? "button" : "div", {
    key, onClick, className: onClick ? "w-full text-left active:opacity-70" : "",
    style: {
      display: "block", background: dashed ? "transparent" : "#fff", borderRadius: 18, padding: "15px 16px", marginBottom: 10,
      border: dashed ? "1px dashed " + TALLY_LINE : "1px solid rgba(31,29,26,.06)",
      boxShadow: dashed ? "none" : "0 2px 10px rgba(31,29,26,.045)"
    }
  }, kids);
  const peekBtn = (label, title, text) => onPeek ? h("button", {
    onClick: e => { e.stopPropagation(); onPeek({ tier: "hidden", label: "账本 · " + label, title, text }); },
    className: "active:opacity-60",
    style: { marginTop: 12, fontFamily: F_BODY, fontSize: 11.5, padding: "6px 12px", borderRadius: 99, border: "1px solid rgba(182,71,60,.4)", color: "#b6473c" }
  }, "摆到他面前") : null;

  let body = null;
  if (tab === "debts") {
    const rows = A(data.debts).filter(x => x && typeof x === "object");
    body = rows.length ? rows.map((x, i) => {
      const dir = TALLY_DIR[S(x.dir)] || TALLY_DIR.open;
      return card([
        h("div", { key: "h", style: { display: "flex", alignItems: "flex-start", gap: 9 } },
          h("span", {
            style: {
              fontFamily: F_BODY, fontSize: 10.5, padding: "2px 8px", borderRadius: 99, flexShrink: 0, marginTop: 2,
              background: dir.c + "1c", color: dir.c
            }
          }, dir.zh),
          h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.5, color: TALLY_INK, wordBreak: "break-word" } }, S(x.title))),
        S(x.note) ? h("div", { key: "n", style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.75, color: TALLY_DIM, marginTop: 9, paddingLeft: 10, borderLeft: "2px solid " + TALLY_LINE, wordBreak: "break-word" } }, S(x.note)) : null,
        peekBtn("没结清", S(x.title), S(x.note))
      ], "d" + i);
    }) : null;
  } else if (tab === "policies") {
    const rows = A(data.policies).filter(x => x && typeof x === "object");
    body = rows.length ? rows.map((x, i) => card([
      h("div", { key: "h", style: { display: "flex", alignItems: "flex-start", gap: 10 } },
        h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.45, color: TALLY_INK, wordBreak: "break-word" } }, S(x.name)),
        S(x.terms) ? h("span", {
          style: { fontFamily: F_BODY, fontSize: 10.5, padding: "3px 9px", borderRadius: 8, background: "rgba(31,29,26,.05)", color: TALLY_DIM, flexShrink: 0, maxWidth: 150, wordBreak: "break-word", lineHeight: 1.45 }
        }, S(x.terms)) : null),
      S(x.scope) ? h("div", { key: "s", style: { fontFamily: F_BODY, fontSize: 11.5, color: TALLY_DIM, marginTop: 7, wordBreak: "break-word" } }, S(x.scope)) : null,
      S(x.clause) ? h("div", { key: "c", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.85, color: TALLY_INK, marginTop: 8, wordBreak: "break-word" } }, S(x.clause)) : null,
      peekBtn("兜底", S(x.name), S(x.clause) || S(x.scope))
    ], "p" + i, null, true)) : null;
  } else if (tab === "statements") {
    const rows = A(data.statements).filter(x => x && typeof x === "object");
    body = rows.length ? rows.map((x, i) => card([
      S(x.heat) ? h("span", {
        key: "t", style: { display: "inline-block", fontFamily: F_BODY, fontSize: 10.5, padding: "2px 9px", borderRadius: 99, background: "rgba(31,29,26,.05)", color: TALLY_DIM, marginBottom: 9 }
      }, S(x.heat)) : null,
      h("div", { key: "x", style: { fontFamily: F_DISPLAY, fontSize: 16.5, lineHeight: 1.65, color: TALLY_INK, wordBreak: "break-word" } }, S(x.text)),
      peekBtn("定论", S(x.text), "")
    ], "s" + i)) : null;
  } else if (tab === "treasures") {
    const rows = A(data.treasures).filter(x => x && typeof x === "object");
    body = rows.length ? rows.map((x, i) => card([
      h("div", { key: "k", style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 } },
        S(x.kind) ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, padding: "2px 9px", borderRadius: 99, background: "rgba(31,29,26,.05)", color: TALLY_DIM } }, S(x.kind)) : h("span"),
        h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: ".17em", color: TALLY_DIM } }, "LOT " + String(i + 1).padStart(2, "0"))),
      h("div", { key: "x", style: { fontFamily: F_DISPLAY, fontSize: 16, lineHeight: 1.5, color: TALLY_INK, wordBreak: "break-word" } }, S(x.title)),
      S(x.worth) ? h("div", { key: "w", style: { fontFamily: F_BODY, fontSize: 13, color: TALLY_DIM, marginTop: 7, wordBreak: "break-word" } }, S(x.worth)) : null,
      peekBtn("估价", S(x.title), S(x.worth))
    ], "tr" + i)) : null;
  } else {
    const rows = A(data.appraisals).filter(x => x && typeof x === "object");
    body = rows.length ? rows.map((x, i) => card([
      h("div", { key: "q", style: { fontFamily: F_DISPLAY, fontSize: 15.5, lineHeight: 1.55, color: TALLY_INK, wordBreak: "break-word" } }, S(x.q)),
      S(x.a) ? h("div", { key: "a", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.85, color: TALLY_DIM, marginTop: 9, wordBreak: "break-word" } }, S(x.a)) : null,
      peekBtn("自问", S(x.q), S(x.a))
    ], "a" + i)) : null;
  }

  return h("div", { className: "h-full flex flex-col", style: { background: TALLY_BG } },
    h("div", { className: "shrink-0 px-4 pb-1 flex items-center gap-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 }, "aria-label": "返回" }, h(IArrow, { size: 19, color: TALLY_INK })),
      h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: "'Archivo',sans-serif", fontSize: 11.5, letterSpacing: ".24em", color: TALLY_INK } }, "TALLY"),
      h("div", { style: { width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" } },
        onRefresh ? h("button", { onClick: onRefresh, disabled: refreshing, className: "active:opacity-50 disabled:opacity-40", "aria-label": "重新推演", style: { width: 40, height: 40 } }, h(IRefresh, { size: 17, color: TALLY_INK })) : null)),
    h("div", { className: "shrink-0 px-5 pb-3" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: TALLY_DIM, lineHeight: 1.7 } },
        "这本账不记钱。记的是他和你之间还没结清的东西。")),
    // 五栏切换：横滑，别挤成一行小字
    h("div", {
      className: "shrink-0 flex gap-2 px-5 pb-3 overflow-x-auto",
      style: { scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }
    }, TALLY_TABS.map(x => h("button", {
      key: x.k, onClick: () => { setTab(x.k); setOpen(null); },
      className: "active:opacity-60",
      style: {
        flexShrink: 0, fontFamily: F_BODY, fontSize: 12.5, padding: "7px 14px", borderRadius: 99,
        background: tab === x.k ? TALLY_INK : "rgba(31,29,26,.05)",
        color: tab === x.k ? "#fff" : TALLY_DIM,
        border: "1px solid " + (tab === x.k ? TALLY_INK : "transparent")
      }
    }, x.zh + (count(x.k) ? " " + count(x.k) : "")))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
      body || h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: TALLY_DIM, textAlign: "center", padding: "60px 20px", lineHeight: 1.9 } },
        "这一栏还是空的。")));
}

// ─────────────────────────────────────────────────────────────
// 时间线视图
// ─────────────────────────────────────────────────────────────
// 每条左边是时刻，右边是内容，中间一条竖轴把一天串起来。
// 新增的（上次翻完之后才出现的）左侧有一个实心点，顶上可以切「只看新增」。
function TimelineView({ rows, char, t, onBack, onOpenApp, onPeek, newIds, newCount, onMarkRead, kept, onToggleKeep }) {
  // mode: all / new / keep —— 「我收着的」是【她自己】留的，不喂给聊天。
  // 转发＝摆到他面前；收着＝我自己留一份。两件事，两个按钮。
  const [mode, setMode] = useState("all");
  const [sheet, setSheet] = useState(null);
  const list = Array.isArray(rows) ? rows : [];
  const isNew = r => !!(newIds && newIds[r.id]);
  const isKept = r => !!(kept && kept[r.id]);
  const keptCount = list.filter(isKept).length;
  const onlyNew = mode === "new";
  const shown = mode === "new" ? list.filter(isNew) : mode === "keep" ? list.filter(isKept) : list;
  const now = Date.now();
  // 按天切段
  const groups = [];
  shown.forEach(r => {
    // 未来那一段要单独标。不然「今天 20:00 还没去」和「今天 14:20 已经发生」
    // 会落进同一个「今天」标题下，中间还夹着「后天」，读起来是乱的。
    const label = (r.ahead ? "接下来 · " : "") + phoneDayLabel(r.ts, now);
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
    h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11.5, color: isNew(r) ? TL_DOT : t.fog } },
      r.ts == null ? "—" : phoneClock(r.ts))),
  h("div", { style: { width: 15, flexShrink: 0, position: "relative", display: "flex", justifyContent: "center" } },
    h("span", { style: { position: "absolute", top: first ? 15 : 0, bottom: last ? "auto" : 0, height: last ? 0 : "auto", width: 1, background: t.line } }),
    h("span", {
      style: {
        position: "absolute", top: 12, width: isNew(r) ? 9 : 6, height: isNew(r) ? 9 : 6, borderRadius: 9,
        background: isNew(r) ? TL_DOT : t.bg, border: "1.5px solid " + (isNew(r) ? TL_DOT : t.line)
      }
    })),
  h("div", { className: "flex-1 min-w-0", style: { paddingBottom: 14, paddingTop: 7 } },
    h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 3 } },
      h(PGlyph, { k: r.app, size: 12, color: t.fog }),
      h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } },
        r.appZh + (r.tag ? " · " + r.tag : "") + (r.gone ? " · 已被顶掉" : "")),
      isKept(r) ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.ink, marginLeft: "auto" } }, "收着") : null),
    r.title && h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, lineHeight: 1.45, wordBreak: "break-word" } }, r.title),
    r.text && h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, lineHeight: 1.65, marginTop: 3, wordBreak: "break-word" } },
      r.text.length > 52 ? r.text.slice(0, 52) + "…" : r.text)));
  return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
    h("div", {
      className: "shrink-0 px-4 pb-2 flex items-center gap-2",
      style: { background: t.bg, paddingTop: safeTop(10) }
    },
    h("button", { onClick: onBack, className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 }, "aria-label": "返回" }, h(IArrow, { size: 19, color: t.ink })),
    h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "时间线"),
    h("div", { style: { width: 40, height: 40 } })),
    // 只看新增
    h("div", { className: "shrink-0 px-5 pb-2 flex items-center justify-between" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } },
        list.length
          ? (() => { const g = list.filter(r => r.gone).length; return "把 " + list.length + " 条痕迹按时间排在一起" + (g ? "，其中 " + g + " 条只在这儿还留着" : ""); })()
          : "还没有翻出任何东西"),
      h("div", { className: "flex items-center", style: { gap: 6 } },
        keptCount > 0 && h("button", {
          onClick: () => setMode(v => v === "keep" ? "all" : "keep"),
          className: "active:opacity-60",
          style: {
            fontFamily: F_BODY, fontSize: 11, padding: "4px 11px", borderRadius: 99,
            background: mode === "keep" ? t.ink : "transparent", color: mode === "keep" ? "#fff" : t.sub,
            border: "1px solid " + (mode === "keep" ? t.ink : t.line)
          }
        }, "我收着的 " + keptCount),
        newCount > 0 && h("button", {
          onClick: () => setMode(v => v === "new" ? "all" : "new"),
          className: "active:opacity-60",
          style: {
            fontFamily: F_BODY, fontSize: 11, padding: "4px 11px", borderRadius: 99,
            background: onlyNew ? TL_DOT : "transparent", color: onlyNew ? "#fff" : TL_DOT,
            border: "1px solid " + (onlyNew ? TL_DOT : "rgba(196,85,63,.4)")
          }
        }, "只看新增 " + newCount))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-8" },
      !shown.length && h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "56px 20px", lineHeight: 1.9 } },
        mode === "new" ? "上次翻完之后，他手机上没有新东西。"
          : mode === "keep" ? "你还没收着什么。点开某一条，右下角有「收着」。"
          : "先在桌面上刷一遍，这里才会有东西串起来。"),
      groups.map((g, gi) => h("div", { key: g.label + gi },
        h("div", {
          style: {
            fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: ".17em",
            color: t.fog, padding: "16px 0 8px 61px"
          }
        }, g.label.toUpperCase()),
        g.rows.map((r, i) => row(r, i === 0, i === g.rows.length - 1 && gi === groups.length - 1))))),
    newCount > 0 && h("div", { className: "shrink-0 px-5", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
      h("button", {
        onClick: onMarkRead, className: "w-full py-3 active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 13, border: "1px solid " + t.line, color: t.sub }
      }, "这 " + newCount + " 条都看过了")),
    sheet && h(Sheet, { onClose: () => setSheet(null), tall: true },
      h(Eyebrow, { style: { marginBottom: 8 } }, sheet.appZh + (sheet.tag ? " · " + sheet.tag : "")),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, lineHeight: 1.5, wordBreak: "break-word" } }, sheet.title),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 5 } },
        sheet.ts == null ? "时间不详（原文写的是「" + sheet.when + "」）" : phoneDayLabel(sheet.ts, now) + " " + phoneClock(sheet.ts)),
      sheet.text && h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.85, color: t.ink, marginTop: 14, wordBreak: "break-word" } }, sheet.text),
      sheet.thought && h("div", {
        style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.75, color: t.sub, marginTop: 12, paddingLeft: 10, borderLeft: "2px solid " + t.line, wordBreak: "break-word" }
      }, sheet.thought),
      // 归档里那些已经被后来的内容顶掉了，app 里点过去是空的——不给按钮，明说
      sheet.gone
        ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 18, lineHeight: 1.75 } },
            "这条已经被后来刷新的内容顶掉了，" + sheet.appZh + "里翻不到了，只剩时间线上这一份。")
        : h("button", {
            onClick: () => { const a = sheet.app; setSheet(null); onOpenApp && onOpenApp(a); },
            className: "w-full mt-6 py-3 active:opacity-60",
            style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 13, border: "1px solid " + t.line, color: t.ink }
          }, "去" + sheet.appZh + "里看"),
      // 转发那一层照旧走 onPeek，绝不因为点开就自动发出去（她 2026-08-29 被吓过一次）
      onPeek && h("button", {
        onClick: () => onPeek({ tier: "quiet", label: sheet.appZh + (sheet.tag ? " · " + sheet.tag : ""), title: sheet.title, text: sheet.text || sheet.thought }),
        className: "w-full mt-2 py-3 active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 13, border: "1px solid " + t.line, color: t.ink }
      }, "转发给 TA · 他会知道你翻了手机"),
      // 收着 ≠ 转发。转发是摆到他面前，收着是【她自己留一份】，
      // 不进他的上下文、不影响任何生成——只给她自己看。
      onToggleKeep && h("button", {
        onClick: () => onToggleKeep(sheet.id),
        className: "w-full mt-2 py-3 active:opacity-60",
        style: {
          fontFamily: F_BODY, fontSize: 12.5, borderRadius: 13,
          border: "1px solid " + (isKept(sheet) ? t.ink : t.line),
          background: isKept(sheet) ? t.ink : "transparent",
          color: isKept(sheet) ? "#fff" : t.sub
        }
      }, isKept(sheet) ? "已经收着了 · 再点取消" : "收着 · 只有你看得到")));
}

// ─────────────────────────────────────────────────────────────
// 锁屏：拿起他手机的第一眼
// ─────────────────────────────────────────────────────────────
// 一叠还没点开的通知横幅，每条只露半句——要看全文得进去。
// 通知就是 delta：上次翻完之后才出现的那些。没有新的就摆最近几条，灰着。
function LockScreen({ char, t, rows, newIds, newCount, onUnlock, onOpenApp, onTimeline }) {
  const now = new Date();
  const wall = strColor(char && (char.id || char.name));
  // 通知说的是【刚发生了什么】，不是日程提醒——所以还没发生的那一段不进锁屏
  const list = (Array.isArray(rows) ? rows : []).filter(r => !r.ahead);
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
    h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: "rgba(30,28,24,.55)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.appZh + (r.tag ? " · " + r.tag : "")),
    h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10, color: "rgba(30,28,24,.45)" } }, r.ts == null ? "" : phoneClock(r.ts))),
  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: "#1e1c18", lineHeight: 1.45, wordBreak: "break-word" } },
    (r.title || r.text || "").slice(0, 22) + ((r.title || r.text || "").length > 22 ? "…" : "")),
  r.text && r.title && h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(30,28,24,.6)", lineHeight: 1.55, marginTop: 2, wordBreak: "break-word" } },
    r.text.slice(0, 26) + (r.text.length > 26 ? "…" : "")));
  return h("div", {
    className: "h-full flex flex-col",
    style: { background: "linear-gradient(168deg," + wall + " 0%, rgba(245,243,238,.94) 62%, #f3f1ec 100%)" }
  },
  h("div", { className: "shrink-0 px-6", style: { paddingTop: safeTop(30) } },
    h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, letterSpacing: ".2em", color: "rgba(30,28,24,.5)" } },
      (now.getMonth() + 1) + "月" + now.getDate() + "日 星期" + dow),
    h("div", { style: { fontFamily: "'Archivo',sans-serif", fontWeight: 300, fontSize: 68, lineHeight: 1.06, color: "#1e1c18", marginTop: 2 } },
      String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0")),
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "rgba(30,28,24,.55)", marginTop: 6 } },
      (char && char.name || "TA") + " 的手机" + (newCount > 0 ? " · " + newCount + " 条新的" : ""))),
  h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pt-5" },
    !pool.length && h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "rgba(30,28,24,.5)", textAlign: "center", padding: "40px 20px", lineHeight: 1.9 } },
      "锁屏上什么都没有。解锁进去刷一遍吧。"),
    pool.map(card),
    newCount > pool.length && h("button", {
      onClick: onTimeline, className: "w-full active:opacity-60",
      style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(30,28,24,.6)", padding: "6px 0 2px" }
    }, "还有 " + (newCount - pool.length) + " 条 · 全部看")),
  h("div", { className: "shrink-0 px-6", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
    h("button", {
      onClick: onUnlock, className: "w-full active:opacity-60",
      style: { fontFamily: F_BODY, fontSize: 12.5, color: "rgba(30,28,24,.62)", padding: "16px 0 10px" }
    }, "解锁 · 进他的桌面")));
}

// 点开某条看细节的通用 sheet 内容（在事件里构造，需显式传 t）
const DetailSheet = (title, body, t, foot) => h("div", null, h(Eyebrow, {
  style: {
    marginBottom: 8
  }
}, title), h("div", {
  style: {
    fontFamily: F_BODY,
    fontSize: 14,
    lineHeight: 1.8,
    color: t.ink,
    whiteSpace: "pre-wrap"
  }
}, body || "（无内容）"), foot || null);
const RecSheet = (it, t, foot) => h("div", null, h(Eyebrow, {
  style: {
    marginBottom: 8
  }
}, it.name), h("div", {
  style: {
    fontFamily: F_BODY,
    fontSize: 14,
    lineHeight: 1.8,
    color: t.ink,
    whiteSpace: "pre-wrap"
  }
}, it.transcript || "（无转录）"), it.thought && h("div", {
  style: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: `1px solid ${t.line}`
  }
}, h(Eyebrow, {
  style: {
    marginBottom: 6
  }
}, "TA 的想法"), h("div", {
  style: {
    fontFamily: F_BODY,
    fontSize: 13,
    lineHeight: 1.7,
    color: t.sub,
    fontStyle: "italic"
  }
}, it.thought)), foot || null);
const WeChatThread = (c, char, t) => h("div", null, h(Eyebrow, {
  style: {
    marginBottom: 12
  }
}, c.name), h("div", {
  className: "space-y-2"
}, (c.messages || []).map((m, i) => {
  const self = m.from === char.name || m.from === "我" || m.from === "本人";
  return h("div", {
    key: i,
    className: "flex " + (self ? "justify-end" : "justify-start")
  }, h("div", {
    style: {
      maxWidth: "76%",
      padding: "8px 12px",
      borderRadius: 14,
      fontFamily: F_BODY,
      fontSize: 13.5,
      lineHeight: 1.5,
      background: self ? "#95d16f" : "#fff",
      color: self ? "#16330a" : t.ink,
      border: self ? "none" : `1px solid ${t.line}`
    }
  }, m.text));
})));

function WeChatView({ d, char, t, setSheet, profile }) {
  const [tab, setTab] = useState("chats");
  const arr = a => Array.isArray(a) ? a : [];
  const actual = arr(d.actualChats), generated = arr(d.chats);
  const meName = profile && profile.name || "Lisa";
  const chatRow = (c, i, real) => h("button", {
    key: (real ? "r" : "g") + i + (c.id || c.name || ""),
    onClick: () => c.messages && c.messages.length && setSheet(WeChatThread(c, char, t)),
    className: "w-full text-left py-3 flex items-center gap-3 active:opacity-60",
    style: { borderTop: `1px solid ${t.line}` }
  }, h(Avatar, { character: { name: c.name, color: strColor(c.name) }, size: 43, radius: c.type === "group" ? 13 : 999 }), h("div", { className: "flex-1 min-w-0" },
    h("div", { className: "flex items-baseline justify-between gap-2" }, h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.name), h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, c.time || "")),
    h("div", { className: "flex items-center gap-1.5", style: { marginTop: 2 } }, real && h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 9, color: t.tint, padding: "1px 5px", borderRadius: 999, background: t.bg2 } }, "真实"), h("span", { style: { minWidth: 0, fontFamily: F_BODY, fontSize: 12.5, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.last || ""))));
  const contactRow = (c, i) => h("button", {
    key: "c" + i + (c.name || ""),
    onClick: () => setSheet(h("div", null, h("div", { className: "flex items-center gap-3 mb-5" }, h(Avatar, { character: { name: c.name, color: strColor(c.name) }, size: 58, radius: 16 }), h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink } }, c.remark || c.name), h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 3 } }, c.name))), h(Eyebrow, { style: { marginBottom: 7 } }, "TA 眼里的这个人"), h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, color: t.sub } }, c.intro || "没有留下更多介绍。"))),
    className: "w-full text-left py-3 flex items-center gap-3 active:opacity-60", style: { borderTop: `1px solid ${t.line}` }
  }, h(Avatar, { character: { name: c.name, color: strColor(c.name) }, size: 42, radius: 12 }), h("div", { className: "min-w-0" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.remark || c.name), h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.intro || c.name)));
  const moments = arr(d.moments), accounts = arr(d.me && d.me.accounts);
  let body;
  if (tab === "chats") body = h("div", null,
    actual.length ? h("div", null, h(Eyebrow, { style: { margin: "4px 0 8px" } }, "手机里已有的聊天 · " + actual.length), actual.map((c, i) => chatRow(c, i, true))) : null,
    h(Eyebrow, { style: { margin: actual.length ? "20px 0 8px" : "4px 0 8px" } }, "其他会话 · " + generated.length), generated.map((c, i) => chatRow(c, i, false)));
  else if (tab === "contacts") {
    const contacts = [{ name: meName, remark: meName, intro: "置顶联系人。你们真实的关系与共同经历，以主聊天和记忆为准。" }, ...arr(d.contacts)];
    body = h("div", null, h(Eyebrow, { style: { margin: "4px 0 8px" } }, "联系人 · " + contacts.length), contacts.map(contactRow));
  } else if (tab === "moments") body = h("div", { className: "space-y-5" }, moments.map((m, i) => h("div", { key: "m" + i, className: "flex gap-3 pb-5", style: { borderBottom: `1px solid ${t.line}` } }, h(Avatar, { character: { name: m.author, color: strColor(m.author) }, size: 40, radius: 11 }), h("div", { className: "flex-1 min-w-0" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.tint } }, m.author), h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.65, color: t.ink, marginTop: 5 } }, m.content), h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 7 } }, m.time || ""), arr(m.likes).length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint, background: t.bg2, padding: "7px 9px", marginTop: 8, borderRadius: "9px 9px 0 0" } }, "♡ " + arr(m.likes).join("、")) : null, arr(m.comments).length ? h("div", { style: { background: t.bg2, padding: "5px 9px 8px", borderRadius: arr(m.likes).length ? "0 0 9px 9px" : 9 } }, arr(m.comments).map((x, j) => h("div", { key: j, style: { fontFamily: F_BODY, fontSize: 11.8, lineHeight: 1.55, color: t.sub } }, h("b", { style: { color: t.tint } }, (x.from || "朋友") + "："), x.text))) : null))));
  else body = h("div", null, h("div", { className: "flex items-center gap-4 py-4" }, h(Avatar, { character: char, size: 68, radius: 17 }), h("div", { className: "min-w-0" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 23, color: t.ink } }, char.remark || char.name), h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.55, color: t.fog, marginTop: 5 } }, d.me && d.me.signature || "还没有写朋友圈签名。"))), h("button", {
    onClick: () => setSheet(h("div", null, h(Eyebrow, { style: { marginBottom: 14 } }, "最近读过的公众号文章"), accounts.map((a, i) => h("div", { key: i, className: "pb-5 mb-5", style: { borderBottom: `1px solid ${t.line}` } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, lineHeight: 1.5, color: t.ink } }, a.title), h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4 } }, [a.source, a.time].filter(Boolean).join(" · ")), h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: t.sub, marginTop: 10 } }, a.summary), h(Eyebrow, { style: { marginTop: 14, marginBottom: 5 } }, char.name + " 看完想了什么"), h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, color: t.ink, fontStyle: "italic" } }, a.thought))))), className: "w-full mt-5 p-4 flex items-center justify-between text-left active:opacity-60", style: { borderRadius: 16, border: `1px solid ${t.line}`, background: t.bg2 }
  }, h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "公众号"), h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3 } }, "最近读过 " + accounts.length + " 篇 · 点开看感想")), h(IChevR, { size: 16, color: t.fog })));
  const tabs = [["chats", "聊天"], ["contacts", "联系人"], ["moments", "朋友圈"], ["me", "我"]];
  return h("div", { style: { animation: "fadeUp .3s ease both", paddingBottom: 64 } }, body, h("div", { className: "grid grid-cols-4", style: { position: "sticky", bottom: -16, zIndex: 5, margin: "24px -24px -16px", padding: "10px 8px calc(10px + env(safe-area-inset-bottom))", background: "rgba(248,247,243,.96)", backdropFilter: "blur(16px)", borderTop: `1px solid ${t.line}` } }, tabs.map(([k, label]) => h("button", { key: k, onClick: () => setTab(k), className: "py-1 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: tab === k ? t.tint : t.fog, fontWeight: tab === k ? 700 : 400 } }, label))));
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

function WeChatViewFull({ d, char, t, profile, onBack, onRefresh, refreshing }) {
  const [tab, setTab] = useState("chats");
  const [thread, setThread] = useState(null);
  const [publicPage, setPublicPage] = useState(false);
  const [article, setArticle] = useState(null);
  const arr = a => Array.isArray(a) ? a : [];
  const actual = arr(d.actualChats), generated = arr(d.chats);
  const chats = [...actual, ...generated];
  const meName = profile && profile.name || "Lisa";
  const selfNames = new Set([char.name, d.me && d.me.wechatName, "我", "本人"].filter(Boolean));
  const person = (name, avatarImage) => ({ name: name || "?", avatarImage, color: strColor(name) });
  const avatarForMessage = (m, c) => m.avatarImage || (selfNames.has(m.from) ? char.avatarImage : m.from === meName ? profile && profile.avatarImage : c.avatarImage);
  const innerHead = (title, sub, back) => h("div", { className: "shrink-0 flex items-center gap-3 px-4 pb-3", style: { paddingTop: safeTop(16), borderBottom: `1px solid ${t.line}`, background: "rgba(248,247,243,.96)" } }, h("button", { onClick: back, className: "active:opacity-50", style: { fontSize: 26, lineHeight: 1, color: t.ink } }, "‹"), h("div", { className: "flex-1 min-w-0 text-center", style: { paddingRight: 24 } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" } }, title), sub && h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog } }, sub)));
  if (thread && thread.type !== "contact") return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#ededed" } }, innerHead(thread.name, thread.type === "group" ? "群聊" : null, () => setThread(null)), h("div", { className: "flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4" }, arr(thread.messages).map((m, i) => {
    const self = selfNames.has(m.from);
    return h("div", { key: i, className: "flex items-start gap-2 " + (self ? "flex-row-reverse" : "") }, h(Avatar, { character: person(m.from, avatarForMessage(m, thread)), size: 37, radius: 7 }), h("div", { style: { maxWidth: "72%" } }, thread.type === "group" && !self && h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "#888", margin: "0 4px 3px" } }, m.from), h("div", { style: { position: "relative", padding: "9px 11px", borderRadius: 5, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.55, color: "#171717", background: self ? "#95ec69" : "#fff", boxShadow: "0 1px 1px rgba(0,0,0,.05)" } }, m.text)));
  })));
  const accounts = arr(d.me && d.me.accounts);
  if (publicPage) return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#f5f5f5" } }, innerHead(article ? "文章" : "公众号", null, () => article ? setArticle(null) : setPublicPage(false)), h("div", { className: "flex-1 min-h-0 overflow-y-auto" }, article ? h("article", { style: { background: "#fff", minHeight: "100%", padding: "24px 22px 48px" } }, h("h1", { style: { fontFamily: F_DISPLAY, fontSize: 24, lineHeight: 1.35, color: "#191919" } }, article.title), h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#8a8a8a", marginTop: 10 } }, [article.source, article.time].filter(Boolean).join(" · ")), h("div", { style: { fontFamily: F_BODY, fontSize: 15, lineHeight: 2, color: "#333", marginTop: 25, whiteSpace: "pre-wrap" } }, article.summary), h("div", { style: { marginTop: 32, padding: 18, borderRadius: 8, background: "#f7f7f7" } }, h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#8a8a8a", marginBottom: 8 } }, char.name + " 读到这里时"), h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, color: "#444" } }, article.thought))) : h("div", null, h("div", { style: { height: 118, background: "linear-gradient(135deg,#234635,#79a185)", padding: "34px 22px", color: "#fff" } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25 } }, "订阅号消息"), h("div", { style: { fontFamily: F_BODY, fontSize: 11, opacity: .8, marginTop: 5 } }, char.name + " 最近打开过的文章")), h("div", { style: { padding: "10px 14px" } }, accounts.map((a, i) => h("button", { key: i, onClick: () => setArticle(a), className: "w-full text-left active:opacity-60", style: { padding: "17px 0", borderBottom: "1px solid #ddd" } }, h("div", { className: "flex gap-13" }, h("div", { className: "flex-1" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, lineHeight: 1.45, color: "#222" } }, a.title), h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#999", marginTop: 8 } }, [a.source, a.time].filter(Boolean).join(" · "))), h("div", { style: { width: 72, height: 58, borderRadius: 5, background: `linear-gradient(135deg,${strColor(a.source)},#ddd)` } }))))))));
  const chatRow = (c, i) => h("button", { key: c.id || i, onClick: () => setThread(c), className: "w-full text-left flex items-center gap-3 active:opacity-60", style: { minHeight: 67, borderBottom: "1px solid #e5e5e5", background: "#fff", padding: "8px 14px" } }, h(Avatar, { character: person(c.name, c.avatarImage), size: 47, radius: c.type === "group" ? 8 : 7 }), h("div", { className: "flex-1 min-w-0" }, h("div", { className: "flex justify-between gap-2" }, h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#191919" } }, c.name), h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#aaa" } }, c.time || "")), h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#999", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.last || "")));
  const userContact = d.userContact || { name: meName, remark: meName, intro: "TA 把你放在最重要的位置，但这次刷新还没写下具体的话。" };
  const contacts = [{ ...userContact, name: meName, avatarImage: profile && profile.avatarImage }, ...arr(d.contacts)];
  const contactRow = (c, i) => h("button", { key: i, onClick: () => setThread({ ...c, type: "contact" }), className: "w-full flex items-center gap-3 text-left active:opacity-60", style: { minHeight: 64, padding: "8px 14px", background: "#fff", borderBottom: "1px solid #e7e7e7" } }, h(Avatar, { character: person(c.name, c.avatarImage), size: 43, radius: 7 }), h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: "#1c1c1c" } }, c.remark || c.name), h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#999", marginTop: 3 } }, c.intro)));
  const searchBox = h("div", { className: "flex-1 flex items-center justify-center gap-2", style: { height: 39, borderRadius: 8, background: "#fff", border: "1px solid #e5e5e5", color: "#9a9a9a", boxShadow: "0 1px 1px rgba(0,0,0,.025)" } },
    h("svg", { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" }, h("circle", { cx: 10.5, cy: 10.5, r: 6.5 }), h("path", { d: "m16 16 4 4" })),
    h("span", { style: { fontFamily: F_BODY, fontSize: 13.5 } }, "搜索"));
  const searchHead = h("div", { className: "shrink-0 flex items-center gap-2 px-3 pb-2", style: { paddingTop: safeTop(9), background: "#f5f5f5", borderBottom: "1px solid #e2e2e2" } },
    h("button", { onClick: onBack, className: "shrink-0 active:opacity-50", style: { width: 34, height: 42, fontSize: 29, lineHeight: 1, color: "#222" }, "aria-label": "返回" }, "‹"),
    searchBox,
    h("button", { onClick: onRefresh, disabled: refreshing, className: "shrink-0 active:opacity-50 disabled:opacity-35", style: { width: 34, height: 42, display: "flex", alignItems: "center", justifyContent: "center" }, "aria-label": "刷新微信" }, h(IRefresh, { size: 18, color: "#333" })));
  const contactsHead = h("div", { className: "shrink-0", style: { paddingTop: safeTop(10), background: "#f5f5f5", borderBottom: "1px solid #e2e2e2" } },
    h("div", { className: "flex items-center px-3", style: { height: 43 } }, h("button", { onClick: onBack, className: "active:opacity-50", style: { width: 34, fontSize: 29, lineHeight: 1 }, "aria-label": "返回" }, "‹"), h("div", { className: "flex-1 text-center", style: { paddingRight: 34, fontFamily: F_DISPLAY, fontSize: 18, fontWeight: 700 } }, "通讯录")),
    h("div", { className: "px-3 pb-3" }, searchBox));
  const plainHead = h("div", { className: "shrink-0 flex items-center px-3 pb-2", style: { paddingTop: safeTop(12), minHeight: 54, background: "#f5f5f5", borderBottom: "1px solid #e2e2e2" } },
    h("button", { onClick: onBack, className: "active:opacity-50", style: { width: 34, fontSize: 29, lineHeight: 1 }, "aria-label": "返回" }, "‹"),
    h("div", { className: "flex-1 text-center", style: { paddingRight: 34, fontFamily: F_DISPLAY, fontSize: 18, fontWeight: 700 } }, tab === "moments" ? "朋友圈" : "我"));
  const topBar = tab === "chats" ? searchHead : tab === "contacts" ? contactsHead : plainHead;
  let body;
  if (thread && thread.type === "contact") body = null;
  if (tab === "chats") body = h("div", null, chats.map(chatRow));
  else if (tab === "contacts") body = h("div", null, h("div", { style: { padding: "7px 14px", fontFamily: F_BODY, fontSize: 11, color: "#888", background: "#f4f4f4" } }, "联系人 · " + contacts.length), contacts.map(contactRow));
  else if (tab === "moments") {
    const momentCard = (m, i) => h("div", { key: i, className: "flex gap-3", style: { padding: "15px 14px", borderBottom: "1px solid #eee" } },
      h(Avatar, { character: person(m.author), size: 40, radius: 6 }),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: "#526786" } }, m.author),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.7, color: "#222", marginTop: 5 } }, m.content),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#999", marginTop: 7 } }, m.time),
        h("div", { style: { background: "#f3f3f3", borderRadius: 4, marginTop: 8, padding: "7px 9px" } },
          arr(m.likes).length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#526786", paddingBottom: arr(m.comments).length ? 5 : 0, borderBottom: arr(m.comments).length ? "1px solid #ddd" : "none" } }, "♡ " + arr(m.likes).join("、")) : null,
          arr(m.comments).map((x, j) => h("div", { key: j, style: { fontFamily: F_BODY, fontSize: 11.8, lineHeight: 1.55, color: "#333", marginTop: 4 } }, h("b", { style: { color: "#526786" } }, x.from + "："), x.text)))));
    body = h("div", { style: { background: "#fff" } },
      h("div", { style: { height: 140, background: "linear-gradient(135deg,#4d6655,#c6c2ad)", position: "relative", marginBottom: 34 } }, h("div", { style: { position: "absolute", right: 18, bottom: -28, display: "flex", alignItems: "center", gap: 10 } }, h("span", { style: { color: "#fff", fontFamily: F_DISPLAY, fontSize: 16, textShadow: "0 1px 3px #000" } }, d.me && d.me.wechatName || char.name), h(Avatar, { character: char, size: 60, radius: 7 }))),
      arr(d.moments).map(momentCard));
  }
  else body = h("div", { style: { background: "#f5f5f5", minHeight: "100%", paddingTop: 14 } }, h("div", { className: "flex items-center gap-4", style: { background: "#fff", padding: "22px 18px" } }, h(Avatar, { character: char, size: 67, radius: 8 }), h("div", { className: "flex-1 min-w-0" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: "#1b1b1b" } }, d.me && d.me.wechatName || char.name), h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#888", marginTop: 6 } }, "微信号：" + (d.me && d.me.wechatId || "wx_" + String(char.id || "user").slice(0, 8))), h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#777", marginTop: 5 } }, d.me && d.me.signature || "还没有写个性签名"))), h("button", { onClick: () => setPublicPage(true), className: "w-full flex items-center gap-3 text-left active:opacity-60", style: { marginTop: 10, background: "#fff", padding: "16px 18px" } }, h("div", { style: { width: 34, height: 34, borderRadius: 7, background: "#07c160", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 18 } }, "文"), h("div", { className: "flex-1" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: "#222" } }, "公众号"), h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#999", marginTop: 3 } }, "最近读过 " + accounts.length + " 篇文章")), h("span", { style: { color: "#aaa", fontSize: 22 } }, "›")));
  if (thread && thread.type === "contact") return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#f5f5f5" } }, innerHead(thread.remark || thread.name, null, () => setThread(null)), h("div", { className: "flex-1 overflow-y-auto", style: { padding: "28px 20px" } }, h("div", { className: "flex items-center gap-4" }, h(Avatar, { character: person(thread.name, thread.avatarImage), size: 68, radius: 9 }), h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: "#222" } }, thread.remark || thread.name), thread.remark && thread.remark !== thread.name ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#999", marginTop: 5 } }, "昵称：" + thread.name) : null)), h("div", { style: { background: "#fff", borderRadius: 8, padding: "18px", marginTop: 26 } }, h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#999", marginBottom: 9 } }, char.name + " 对这个人的备注与真实感想"), h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.85, color: "#333", whiteSpace: "pre-wrap" } }, thread.intro))));
  const navs = [["chats", "聊天"], ["contacts", "联系人"], ["moments", "朋友圈"], ["me", "我"]];
  return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#f5f5f5" } }, topBar, h("div", { className: "flex-1 min-h-0 overflow-y-auto" }, body), h("div", { className: "shrink-0 grid grid-cols-4", style: { minHeight: 61, paddingBottom: "env(safe-area-inset-bottom)", background: "rgba(250,250,250,.98)", borderTop: "1px solid #ddd" } }, navs.map(([k, label]) => h("button", { key: k, onClick: () => setTab(k), className: "flex flex-col items-center justify-center gap-0.5 active:opacity-60", style: { color: tab === k ? "#07c160" : "#777" } }, h(WechatNavIcon, { kind: k, active: tab === k }), h("span", { style: { fontFamily: F_BODY, fontSize: 10.5 } }, label)))));
}

function AlbumNavIcon({ kind, active }) {
  const stroke = active ? "#0a84ff" : "#8e8e93";
  const p = { fill: "none", stroke, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (kind === "library") return h("svg", { width: 23, height: 23, viewBox: "0 0 24 24", "aria-hidden": true },
    h("rect", { ...p, x: 3.5, y: 3.5, width: 6.5, height: 6.5, rx: 1.2 }), h("rect", { ...p, x: 14, y: 3.5, width: 6.5, height: 6.5, rx: 1.2 }),
    h("rect", { ...p, x: 3.5, y: 14, width: 6.5, height: 6.5, rx: 1.2 }), h("rect", { ...p, x: 14, y: 14, width: 6.5, height: 6.5, rx: 1.2 }));
  if (kind === "collections") return h("svg", { width: 23, height: 23, viewBox: "0 0 24 24", "aria-hidden": true },
    h("rect", { ...p, x: 4, y: 6, width: 13, height: 15, rx: 2.3 }), h("path", { ...p, d: "M8 3h10a2 2 0 0 1 2 2v12" }));
  return h("svg", { width: 23, height: 23, viewBox: "0 0 24 24", "aria-hidden": true }, h("path", { ...p, d: "M20.8 4.7a5.4 5.4 0 0 0-7.7 0L12 5.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.7Z" }));
}

// 相册：iPhone 风图库 / 精选集 / 收藏夹。
// 收藏仍独立存在 x_phoneKeep，刷新推演只换本轮相册，不覆盖 Lisa 留下的收藏。
function AlbumView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [keep, setKeep] = useState(() => loadJSON("x_phoneKeep", {}));
  const [tab, setTab] = useState("collections");
  const [opened, setOpened] = useState(null);
  const [photo, setPhoto] = useState(null);
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
    { key: "memory", label: "回忆" },
    { key: "favorite", label: "个人收藏" },
    { key: "saved", label: "最近保存" },
    { key: "private", label: "私密" },
    { key: "deleted", label: "最近删除" }
  ];
  const canon = v => ({ "回忆": "memory", "个人收藏": "favorite", "最近保存": "saved", "私密": "private", "最近删除": "deleted" }[v] || (["memory", "favorite", "saved", "private", "deleted"].includes(v) ? v : ""));
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
  // id 优先；没有 id 的旧数据用内容指纹。不要把本轮数组下标写进收藏指纹，
  // 否则同一张照片在下次刷新排序变化后会被误当成另一张。
  const sig = p => p.id || (p.caption || "") + "|" + (p.date || p.time || "") + "|" + (p.desc || "");
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
  // 零 API 的程序化缩略图：按照片内容稳定生成不同色光、景深与构图；不是灰色占位，
  // 也不会为 25 张照片额外烧生图额度。若将来数据带 imageRef/imageUrl，会优先显示真图。
  const art = (it, radius) => {
    const seed = phoneStableHash((it.caption || "") + (it.desc || ""));
    const hue = seed % 360, hue2 = (hue + 45 + seed % 70) % 360;
    // imageRef 可能是本机保险箱键，不是浏览器可直接加载的网址；这里只接真正 URL。
    const img = it.imageUrl || it.imgUrl;
    return h("div", { style: { position: "absolute", inset: 0, overflow: "hidden", borderRadius: radius || 0,
      background: img ? "#ddd" : `linear-gradient(${110 + seed % 80}deg,hsl(${hue} 42% 75%),hsl(${hue2} 48% 37%))` } },
      img ? h("img", { src: img, alt: it.caption || "照片", style: { width: "100%", height: "100%", objectFit: "cover" } }) : h(React.Fragment, null,
        h("span", { style: { position: "absolute", width: "72%", height: "72%", borderRadius: "50%", left: `${-12 + seed % 35}%`, top: `${-8 + (seed >> 3) % 35}%`, background: "rgba(255,255,255,.28)", filter: "blur(10px)" } }),
        h("span", { style: { position: "absolute", width: "46%", height: "70%", borderRadius: "46% 54% 30% 70%", right: `${-8 + (seed >> 5) % 20}%`, bottom: "-12%", background: "rgba(18,18,24,.28)", transform: `rotate(${seed % 28 - 14}deg)` } }),
        h("span", { style: { position: "absolute", left: 9, right: 9, bottom: 8, color: "rgba(255,255,255,.92)", fontFamily: F_BODY, fontSize: 9.5, lineHeight: 1.25, textShadow: "0 1px 4px rgba(0,0,0,.45)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } }, it.caption || "照片")));
  };
  const tile = (it, i, rounded) => h("button", { key: sig(it) + ":" + i, onClick: () => openPhoto(it), className: "active:opacity-70", style: { position: "relative", aspectRatio: "1 / 1", overflow: "hidden", borderRadius: rounded ? 14 : 0, minWidth: 0 } }, art(it, rounded ? 14 : 0),
    isSaved(it) ? h("span", { style: { position: "absolute", top: 6, right: 6, width: 23, height: 23, borderRadius: 99, background: "rgba(255,255,255,.9)", display: "flex", alignItems: "center", justifyContent: "center" } }, h(IHeart, { size: 13, color: "#ff375f", filled: true })) : null,
    it.category === "private" ? h("span", { style: { position: "absolute", left: 6, bottom: 6, borderRadius: 7, padding: "2px 5px", color: "#fff", background: "rgba(0,0,0,.5)", fontSize: 9 } }, "锁") : it.category === "deleted" ? h("span", { style: { position: "absolute", left: 6, bottom: 6, borderRadius: 7, padding: "2px 5px", color: "#fff", background: "rgba(0,0,0,.5)", fontSize: 9 } }, "已删除") : null);
  const grid = (list, rounded, cols) => h("div", { className: `grid ${cols === 2 ? "grid-cols-2 gap-2" : "grid-cols-3 gap-0.5"}` }, list.map((x, i) => tile(x, i, rounded)));
  const chrome = (title, sub, back) => h("div", { className: "shrink-0 flex items-center", style: { padding: `${safeTop(10)} 13px 8px`, minHeight: 56, background: "rgba(255,255,255,.97)", borderBottom: "1px solid #e5e5ea" } },
    h("button", { onClick: back || onBack, "aria-label": "返回", className: "active:opacity-50", style: { width: 36, fontSize: 29, lineHeight: 1, color: "#111" } }, "‹"),
    h("div", { className: "flex-1 min-w-0 text-center" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, fontWeight: 700, lineHeight: 1.15, color: "#111" } }, title), sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "#8e8e93", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, sub) : null),
    h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "刷新相册", className: "active:opacity-50 disabled:opacity-35", style: { width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" } }, h(IRefresh, { size: 18, color: "#333" })));
  // 高度以主聊天输入栏为标尺：只吃 0.4 条底部安全区，不再 +4px、也不用 minHeight 垫高
  // （.claude/rules/mobile-ui-layout.md §2）
  const nav = h("div", { className: "shrink-0 grid grid-cols-3", style: { padding: "5px 20px", paddingBottom: COMPOSER_PAD_BOTTOM, background: "rgba(250,250,252,.97)", borderTop: "1px solid #e5e5ea" } }, [["library", "图库"], ["collections", "精选集"], ["saved", "收藏夹"]].map(([k, label]) => h("button", { key: k, onClick: () => { setTab(k); setOpened(null); }, className: "flex flex-col items-center justify-center active:opacity-60", style: { color: tab === k ? "#0a84ff" : "#8e8e93", fontFamily: F_BODY, fontSize: 10.5 } }, h(AlbumNavIcon, { kind: k, active: tab === k }), h("span", { style: { marginTop: 2 } }, label))));
  if (photo) return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#fff" } }, chrome("照片", photo.date || photo.time || "日期未记", closePhoto), h("div", { className: "flex-1 overflow-y-auto", style: { padding: "4px 20px 30px" } },
    h("div", { style: { position: "relative", width: "100%", aspectRatio: "1 / 1.12", borderRadius: 20, overflow: "hidden", boxShadow: "0 14px 32px rgba(0,0,0,.12)" } }, art(photo, 20)),
    h("div", { className: "flex items-start justify-between gap-4", style: { padding: "22px 3px 14px" } }, h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 23, color: "#111" } }, photo.caption || "照片"), h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.75, color: "#666", marginTop: 8, whiteSpace: "pre-wrap" } }, photo.desc || "没有留下介绍。")), h("button", { onClick: () => toggle(photo), className: "active:scale-90", style: { flex: "0 0 auto", width: 42, height: 42, borderRadius: 99, background: "#f2f2f7", display: "flex", alignItems: "center", justifyContent: "center" } }, h(IHeart, { size: 20, color: isSaved(photo) ? "#ff375f" : "#777", filled: isSaved(photo) }))),
    h("div", { style: { marginTop: 8, borderRadius: 17, background: "#f2f2f7", padding: "17px 18px" } }, h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".16em", color: "#8e8e93", marginBottom: 9 } }, char.name + " 对这张照片的想法"), h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.85, color: "#222", whiteSpace: "pre-wrap" } }, photo.thought || "TA 没有为这张照片留下想法。")),
    onPeek ? (function () {
      // 私密和最近删除是他藏起来的；回忆/收藏/最近保存只是他没主动提起
      const hid = photo.category === "private" || photo.category === "deleted";
      return h("button", {
        onClick: () => onPeek({ tier: hid ? "hidden" : "quiet", label: photo.category === "deleted" ? "相册·最近删除" : photo.category === "private" ? "相册·私密" : "相册", title: photo.caption || "一张照片", text: [photo.desc, photo.thought].filter(Boolean).join("｜") }),
        className: "w-full active:opacity-60",
        style: { marginTop: 10, padding: "13px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid " + (hid ? "rgba(200,80,70,.45)" : "#d9d9de"), color: hid ? "#b6473c" : "#333" }
      }, hid ? "摆到 TA 面前 · 这是他藏起来的" : "转发给 TA · 他会知道你翻了手机");
    })() : null));
  if (opened) {
    const meta = albums.find(a => a.key === opened);
    const list = items.filter(p => p.category === opened);
    return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#fff" } }, chrome(meta ? meta.label : "相簿", list.length + " 张", () => setOpened(null)), h("div", { ref: scrollRef, className: "flex-1 overflow-y-auto", style: { padding: "8px 20px 28px" } }, grid(list, true, 3)), nav);
  }
  const library = h("div", { style: { paddingTop: 14, paddingBottom: 26 } }, (() => {
    const groups = [];
    items.forEach(p => { const raw = String(p.date || p.time || "日期未记"); const m = raw.match(/(\d{4})[-\/.年](\d{1,2})/); const label = m ? (m[1] + "年" + Number(m[2]) + "月") : "日期未记"; let g = groups.find(x => x.label === label); if (!g) { g = { label, list: [] }; groups.push(g); } g.list.push(p); });
    return groups.map((g, i) => h("section", { key: g.label + i, style: { marginBottom: 22 } }, h("div", { className: "flex justify-between", style: { padding: "0 20px 10px", fontFamily: F_DISPLAY, fontSize: 16, color: "#444" } }, h("span", null, g.label), h("span", { style: { color: "#999", fontFamily: F_BODY, fontSize: 12 } }, g.list.length)), grid(g.list, false, 3)));
  })());
  const memoryItems = items.filter(p => p.category === "memory");
  const fixedAlbums = albums.filter(a => a.key !== "memory");
  const memoryCard = p => h("button", { key: sig(p), onClick: () => openPhoto(p), className: "shrink-0 text-left active:opacity-70", style: { width: "72%", scrollSnapAlign: "start" } },
    h("div", { style: { position: "relative", height: 232, borderRadius: 22, overflow: "hidden", background: "#ddd", boxShadow: "0 12px 26px rgba(0,0,0,.10)" } },
      art(p, 22),
      h("div", { style: { position: "absolute", inset: "42% 0 0", background: "linear-gradient(transparent,rgba(0,0,0,.72))" } }),
      h("div", { style: { position: "absolute", left: 16, right: 16, bottom: 15, color: "#fff" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, lineHeight: 1.25 } }, p.caption || "一段回忆"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, marginTop: 5, opacity: .84 } }, p.date || p.time || "日期未记"))));
  const albumCard = a => {
    const list = items.filter(p => p.category === a.key);
    const cover = list[0];
    return h("button", { key: a.key, onClick: () => setOpened(a.key), className: "shrink-0 text-left active:opacity-65", style: { width: 145, scrollSnapAlign: "start" } },
      h("div", { style: { position: "relative", width: 145, height: 145, borderRadius: 18, overflow: "hidden", background: "#eee" } }, cover ? art(cover, 18) : null),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: "#111", marginTop: 9 } }, a.label),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#8e8e93", marginTop: 3 } }, list.length));
  };
  const collections = h("div", { style: { padding: "18px 0 30px" } },
    h("section", null,
      h("div", { style: { padding: "0 20px 12px", fontFamily: F_DISPLAY, fontSize: 23, color: "#111" } }, "回忆"),
      h("div", { className: "flex overflow-x-auto", style: { gap: 12, padding: "0 20px 8px", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" } }, memoryItems.map(memoryCard)),
      memoryItems.length ? null : h("div", { style: { margin: "0 20px", padding: "40px 18px", borderRadius: 20, background: "#f2f2f7", color: "#8e8e93", textAlign: "center", fontFamily: F_BODY, fontSize: 12 } }, "刷新相册后，这里会出现 TA 珍藏的回忆。")),
    h("section", { style: { marginTop: 30 } }, h("div", { style: { padding: "0 20px 12px", fontFamily: F_DISPLAY, fontSize: 23, color: "#111" } }, "相簿"),
      h("div", { className: "flex overflow-x-auto", style: { gap: 13, padding: "0 20px 8px", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" } }, fixedAlbums.map(albumCard))));
  const favorites = h("div", { style: { padding: "4px 20px 30px" } }, saved.length ? grid(saved, true, 3) : h("div", { style: { textAlign: "center", padding: "70px 18px", color: "#8e8e93", fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8 } }, "还没有收藏照片。\n点开一张照片，再点爱心就会一直留在这里。"));
  const title = tab === "library" ? "图库" : tab === "saved" ? "收藏夹" : "精选集";
  const sub = tab === "library" && items.length ? ((items[items.length - 1].date || items[items.length - 1].time || "") + " – " + (items[0].date || items[0].time || "")) : tab === "collections" ? "回忆与四本相簿 · 共 " + items.length + " 张" : saved.length + " 张 · 刷新也不会丢";
  return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#fff", animation: "fadeUp .3s ease both" } }, chrome(title, sub, onBack), h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto" }, tab === "library" ? library : tab === "saved" ? favorites : collections), nav);
}

// 各 app 详情内容
// ============================================================
// 阅读 —— 五个书架、三十本书（她 2026-08-29 给了参考稿）
// 书架名不是分类标签，是【他自己给这堆书起的名字】：
// 「导师以为我在看的论文」「凌晨两点的关东煮哲学」「怎么对付某个麻烦精」——
// 一看名字就知道是谁的书架。点开一本能看到他读到哪、划了哪句、写了什么批注。
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
function ReadingView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [tab, setTab] = useState("shelf");
  const [book, setBook] = useState(null);
  const scrollRef = useRef(null);
  const returnScroll = useRef({ top: 0, pending: false });
  const shelves = (Array.isArray(d && d.shelves) ? d.shelves : []).filter(x => x && typeof x === "object");
  const total = shelves.reduce((n, sh) => n + (Array.isArray(sh.books) ? sh.books.length : 0), 0);
  const marked = shelves.reduce((n, sh) => n + (Array.isArray(sh.books) ? sh.books.filter(b => b && String(b.quote || "").trim()).length : 0), 0);
  const archive = (d && typeof d.archive === "object" && d.archive) || {};
  // 详情返回要回到原来的位置（.claude/rules/mobile-ui-layout.md §3）
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
  const chrome = h("div", {
    className: "shrink-0 flex items-center px-4 pb-2",
    style: { paddingTop: safeTop(10), minHeight: 52, background: READ_BG }
  }, h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: READ_INK })),
  h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: READ_INK } }, tab === "shelf" ? "书架" : "阅读档案"),
  h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演书架", className: "active:opacity-50 disabled:opacity-35 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: READ_INK })));
  // 左边那一列活页装订孔
  const rings = h("div", {
    "aria-hidden": "true",
    style: { position: "absolute", left: 5, top: 18, bottom: 14, width: 13, display: "flex", flexDirection: "column", justifyContent: "space-around", pointerEvents: "none" }
  }, [0, 1, 2, 3, 4, 5, 6].map(i => h("span", { key: i, style: { width: 10, height: 10, borderRadius: 99, border: "1.5px solid rgba(236,230,216,.17)" } })));
  // 书脊：深底上一律浅色书脊配深字——保证每一架都看得清，也不会有哪一架糊进背景
  const spineStyle = (pal, w, ht) => ({
    width: w, height: ht, borderRadius: "3px 8px 8px 3px", position: "relative", overflow: "hidden",
    background: "linear-gradient(152deg," + pal.spine[0] + "," + pal.spine[1] + ")",
    boxShadow: "0 8px 18px rgba(0,0,0,.42)", padding: "15px 12px", flexShrink: 0
  });
  const spineEdge = h("div", { "aria-hidden": "true", style: { position: "absolute", right: 0, top: 0, bottom: 0, width: 8, background: "linear-gradient(90deg,rgba(0,0,0,.10),#fbf8f0 45%,#eee9dd)" } });
  const spine = (b, sh, i, pal) => h("button", {
    key: i, onClick: () => openBook(b, sh, i), className: "active:opacity-70 text-left", style: spineStyle(pal, 106, 146)
  }, spineEdge,
  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, lineHeight: 1.35, color: pal.text, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", paddingRight: 6 } }, b.title || "无题"),
  h("div", { style: { position: "absolute", left: 12, bottom: 13, right: 17, fontFamily: F_BODY, fontSize: 10, color: "rgba(0,0,0,.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, b.author || ""));
  const shelfCard = (sh, si) => {
    const pal = palOf(si);
    const books = Array.isArray(sh.books) ? sh.books : [];
    const no = String(si + 1).padStart(2, "0");
    return h("section", { key: si, style: { position: "relative", marginBottom: 24, paddingLeft: 24 } }, rings,
      h("div", { className: "relative" },
        h("div", { style: { background: pal.shelf, borderRadius: "13px 13px 0 0", padding: "13px 15px 28px", marginRight: 32, borderTop: "2px solid " + pal.accent } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18.5, lineHeight: 1.28, color: READ_INK } },
            h("span", { style: { fontFamily: "'Archivo',sans-serif", fontWeight: 600, marginRight: 9, color: pal.accent } }, no), sh.name || "没起名的一架"),
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, color: READ_DIM, marginTop: 5 } }, "/ " + (sh.slug || "shelf"))),
        h("div", { style: { position: "absolute", right: 0, top: 28, background: pal.shelf, borderRadius: "8px 8px 0 0", padding: "6px 10px", fontFamily: "'Archivo',sans-serif", fontSize: 10, letterSpacing: ".12em", color: pal.accent } }, "NO. " + no),
        h("div", {
          className: "flex gap-3 overflow-x-auto",
          style: { marginTop: -16, padding: "13px 13px 15px", borderRadius: 13, background: pal.rail, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }
        }, books.length ? books.map((b, i) => spine(b, sh, i, pal))
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: READ_DIM, padding: "48px 8px" } }, "这一架还是空的"))));
  };
  const shelfPage = h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "2px 16px 20px", background: READ_BG } },
    h("div", { className: "flex items-center gap-3", style: { padding: "8px 24px 16px" } },
      h("div", { style: { flex: 1, height: 1, background: READ_LINE } }),
      h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: READ_DIM } }, "共 " + total + " 本书"),
      h("div", { style: { flex: 1, height: 1, background: READ_LINE } })),
    shelves.length ? shelves.map(shelfCard) : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: READ_DIM } }, "书架还是空的，点右上角让他把书摆出来"));
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
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 10.5, lineHeight: 1.3, color: pal.text, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", paddingRight: 4 } }, (b && b.title) || "—")),
    h("div", { className: "flex-1 min-w-0" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: READ_DIM } }, label),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, lineHeight: 1.35, color: READ_INK, marginTop: 5 } }, (b && b.title) || "—"),
      (b && b.author) ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: READ_DIM, marginTop: 4 } }, b.author) : null));
  const statCell = (n, label) => h("div", { className: "flex-1 text-center" },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: READ_INK } }, n),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: READ_DIM, marginTop: 3 } }, label));
  const minePage = h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 18px 22px", background: READ_BG } },
    (archive.name || archive.uid) ? h("div", { className: "flex items-baseline", style: { gap: 9, padding: "6px 4px 12px" } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: READ_INK } }, archive.name || ""),
      archive.uid ? h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, color: READ_DIM } }, "书友号 " + archive.uid) : null) : null,
    h("div", { style: { background: READ_CARD, borderRadius: 18, padding: "22px 20px" } },
      h("div", { className: "flex items-center gap-5" },
        h("div", { style: { position: "relative", width: 108, height: 108, flexShrink: 0 } }, goalRing(pct, 108),
          h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: READ_INK, lineHeight: 1 } }, Math.round(Math.min(1, pct) * 100) + "%"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: READ_DIM, marginTop: 4 } }, "本周目标"))),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: READ_DIM } }, "这周读了"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25, color: READ_INK, marginTop: 4 } }, archive.weekTime || readFmtMin(doneMin)),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: READ_DIM, marginTop: 6 } },
            pct >= 1 ? "已经超过他给自己定的 " + readFmtMin(goalMin) : "离 " + readFmtMin(goalMin) + " 还差 " + readFmtMin(goalMin - doneMin)))),
      h("div", { className: "flex", style: { marginTop: 20, paddingTop: 16, borderTop: "1px solid " + READ_LINE } },
        statCell(total, "本书"), statCell(shelves.length, "个书架"), statCell(marked, "处划线"))),
    h("div", { style: { background: READ_CARD, borderRadius: 18, padding: "20px", marginTop: 14 } }, miniBook(fav, palOf(0), "最爱的一本")),
    h("div", { style: { background: READ_CARD, borderRadius: 18, padding: "20px", marginTop: 12 } }, miniBook(plan, palOf(2), "打算下一本读")),
    onPeek ? h("button", {
      onClick: () => onPeek({ tier: "quiet", label: "阅读档案", title: "他最近在读的", text: [fav.title ? "最爱《" + fav.title + "》" : "", archive.weekTime ? "这周读了 " + archive.weekTime : "", plan.title ? "打算读《" + plan.title + "》" : ""].filter(Boolean).join("｜") }),
      className: "w-full active:opacity-60",
      style: { marginTop: 18, padding: "13px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid " + READ_LINE, color: READ_INK }
    }, "转发给 TA · 他会知道你翻了手机") : null);
  // 内页底栏：高度以主聊天输入栏为标尺（.claude/rules/mobile-ui-layout.md §2）——
  // 只吃 0.4 条底部安全区，不许再 + Npx，也不给 minHeight 垫高
  const nav = h("div", {
    className: "shrink-0 grid grid-cols-2",
    style: { padding: "5px 30px", paddingBottom: COMPOSER_PAD_BOTTOM, background: READ_CARD, borderTop: "1px solid " + READ_LINE }
  }, [["shelf", "书架"], ["mine", "我的"]].map(([k, label]) => h("button", {
    key: k, onClick: () => { setTab(k); setBook(null); },
    className: "flex flex-col items-center justify-center active:opacity-60",
    style: { fontFamily: F_BODY, fontSize: 10.5, color: tab === k ? "#9dc49a" : READ_DIM, paddingTop: 2, paddingBottom: 2 }
  }, h("div", { style: { width: 30, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: tab === k ? "rgba(157,196,154,.18)" : "transparent" } },
    h(PGlyph, { k: k === "shelf" ? "reading" : "me", size: 14, color: tab === k ? "#9dc49a" : READ_DIM })),
  h("span", { style: { marginTop: 2 } }, label))));
  // 一本书的详情：书签 + 书名作者 + 读到 + 划的那句 + 批注
  const detail = book ? h("div", {
    className: "absolute inset-0 flex flex-col justify-center px-4",
    style: { background: "rgba(6,6,4,.62)", zIndex: 30 }, onClick: closeBook
  }, h("div", {
    onClick: e => e.stopPropagation(),
    style: { background: READ_CARD, borderRadius: 16, maxHeight: "82%", overflowY: "auto", boxShadow: "0 22px 50px rgba(0,0,0,.55)" }
  }, h("div", { className: "relative flex items-center justify-between px-4", style: { minHeight: 60, borderBottom: "1px solid " + READ_LINE } },
    h("button", { onClick: closeBook, "aria-label": "关闭", className: "active:opacity-60 flex items-center justify-center", style: { width: 34, height: 34, borderRadius: 99, border: "1px solid " + READ_LINE, fontSize: 15, color: READ_DIM } }, "✕"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: READ_DIM, textAlign: "right" } }, (book._shelf || "书架") + " · Vol." + String(book._no).padStart(2, "0")),
    h("div", { "aria-hidden": "true", style: { position: "absolute", left: "50%", top: -11, marginLeft: -16, width: 32, height: 40, background: "#2a2720", clipPath: "polygon(0 0,100% 0,100% 100%,50% 76%,0 100%)" } })),
  h("div", { style: { padding: "22px 22px 26px" } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 26, lineHeight: 1.25, color: READ_INK } }, book.title || "无题"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: READ_DIM, marginTop: 7 } }, book.author || ""),
    book.readAt ? h("div", { style: { marginTop: 20, borderLeft: "3px solid #9dc49a", background: "rgba(157,196,154,.09)", padding: "13px 15px", borderRadius: "0 8px 8px 0" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: READ_DIM } }, "读到"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: READ_INK, marginTop: 6 } }, book.readAt)) : null,
    book.quote ? h("div", { style: { marginTop: 11, borderLeft: "3px solid #d3bd91", background: "rgba(211,189,145,.09)", padding: "13px 15px", borderRadius: "0 8px 8px 0" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: READ_DIM } }, "他划的一句"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.85, color: READ_INK, marginTop: 6 } }, book.quote)) : null,
    book.note ? h("div", { style: { marginTop: 11, borderLeft: "3px solid #d3a2b0", background: "rgba(211,162,176,.09)", padding: "13px 15px", borderRadius: "0 8px 8px 0" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: READ_DIM } }, "批注"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 15, lineHeight: 1.95, color: READ_INK, marginTop: 6, whiteSpace: "pre-wrap" } }, book.note)) : null,
    onPeek ? h("button", {
      onClick: () => onPeek({ tier: "quiet", label: "他读的书", title: "《" + (book.title || "") + "》" + (book.readAt ? " · " + book.readAt : ""), text: [book.quote ? "他划了：" + book.quote : "", book.note].filter(Boolean).join("｜") }),
      className: "w-full active:opacity-60",
      style: { marginTop: 20, padding: "13px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid " + READ_LINE, color: READ_INK }
    }, "转发给 TA · 他会知道你翻了手机") : null))) : null;
  return h("div", { className: "h-full min-h-0 flex flex-col relative", style: { background: READ_BG } },
    chrome, tab === "shelf" ? shelfPage : minePage, nav, detail);
}
// ============================================================
// 购物 —— 一整个网购 App（她 2026-08-29 给了参考稿）
// 原来的「购物」是一串商品清单、「订单」是外卖打车流水，两个喂同一份上下文必然复读。
// 合成一个：账户 / 在途 / 购物车 / 想买 / 订单 / 习惯 / 店铺 / 券 / 浏览 / 地址 / 往来 / 月结。
// 真正值钱的是三栏：想买清单的「为什么想买」、订单的「下单理由」、往来的「一句备注」，
// 以及那条不是自己家的收货地址。
// ============================================================
const SHOP_ORANGE = "#ff6a2b";
const SHOP_BG = "#f1f1f6";
const SHOP_CARD = "#ffffff";
const SHOP_INK = "#1b1b1f";
const SHOP_DIM = "#9a9aa4";
// 想买清单的封面色。原来第二档统一渐变到 #f2f2f6（近白），浅色那几档（米、蓝）
// 走到一半就洗白了，看着像色块没铺满（她 2026-08-29 报「第四个框颜色没盖住」）。
// 改成同色系深→浅两档，整块封面都还是那个颜色。
const WISH_COVERS = [
  ["#c6c6d0", "#e3e3ea"],
  ["#ffb094", "#ffd3bd"],
  ["#e2d0a8", "#f0e5cd"],
  ["#b9cddf", "#d9e6f0"],
  ["#d2bcd0", "#e9dae7"]
];
const shopMoney = n => "¥" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shopInt = n => Number(n || 0).toLocaleString("en-US");
function ShoppingView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [tab, setTab] = useState("home");
  const [sheet, setSheet] = useState(null);
  const scrollRef = useRef(null);
  // 换页回到顶部；同一页内来回开详情不动位置
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab]);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const acc = (data.account && typeof data.account === "object") ? data.account : {};
  const habit = (data.habit && typeof data.habit === "object") ? data.habit : {};
  const initial = String(char.name || "?").trim().slice(0, 1);
  const card = (kids, extra) => h("div", { style: Object.assign({ background: SHOP_CARD, borderRadius: 18, padding: "18px 18px", marginBottom: 14 }, extra || {}) }, kids);
  const secTitle = (title, right) => h("div", { className: "flex items-baseline justify-between", style: { padding: "6px 4px 12px" } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: SHOP_INK } }, title),
    right ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: SHOP_DIM } }, right) : null);
  const tag = (txt, i) => h("span", { key: i, style: { fontFamily: F_BODY, fontSize: 10.5, color: SHOP_DIM, background: "#f4f4f7", borderRadius: 7, padding: "3px 9px" } }, txt);
  const peekBtn = (tier, label, title, text) => onPeek ? h("button", {
    onClick: e => { e.stopPropagation(); onPeek({ tier, label, title, text }); },
    className: "active:opacity-60",
    style: {
      marginTop: 12, width: "100%", padding: "10px 0", borderRadius: 11, fontFamily: F_BODY, fontSize: 12,
      border: "1px solid " + (tier === "hidden" ? "rgba(200,80,70,.4)" : "#e4e4ea"), color: tier === "hidden" ? "#b6473c" : "#55555e"
    }
  }, tier === "hidden" ? "摆到 TA 面前 · 这是他藏起来的" : "转发给 TA · 他会知道你翻了手机") : null;
  const thumb = (txt, bg, fg) => h("div", {
    "aria-hidden": "true",
    style: { width: 56, height: 56, borderRadius: 15, flexShrink: 0, background: bg || "#f2f2f6", color: fg || "#8a8a94", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 21 }
  }, String(txt || "?").trim().slice(0, 1));
  // ── 账户卡 ──
  const accountCard = card([
    h("div", { key: "top", className: "flex items-center gap-4" },
      h("div", { style: { width: 76, height: 76, borderRadius: 22, flexShrink: 0, background: "linear-gradient(150deg,#ff8a4c," + SHOP_ORANGE + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 30, boxShadow: "0 10px 22px rgba(255,106,43,.32)" } }, initial),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { className: "flex items-center gap-2 flex-wrap" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, color: SHOP_INK } }, acc.name || char.name),
          acc.member ? h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: SHOP_ORANGE, background: "rgba(255,106,43,.10)", borderRadius: 999, padding: "4px 11px" } }, acc.member) : null),
        acc.uid ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: SHOP_DIM, marginTop: 5 } }, "会员号 " + acc.uid) : null,
        acc.style ? h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: "#77777f", marginTop: 6, lineHeight: 1.5 } }, acc.style) : null)),
    h("div", { key: "nums", className: "flex", style: { marginTop: 18, paddingTop: 16, borderTop: "1px solid #efeff3" } },
      [[acc.monthSpend != null ? Number(acc.monthSpend).toFixed(2) : "--", "本月消费"],
       [acc.monthOrders != null ? shopInt(acc.monthOrders) : "--", "本月订单"],
       [acc.points != null ? shopInt(acc.points) : "--", "积分"]].map(([n, l], i) => h("div", { key: i, className: "flex-1 text-center" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: SHOP_INK } }, n),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: SHOP_DIM, marginTop: 4 } }, l)))),
    acc.persona ? h("div", { key: "p", style: { marginTop: 16, background: "#f5f5f8", borderRadius: 13, padding: "13px 15px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.65, color: "#4b4b53" } }, acc.persona) : null
  ]);
  // ── 在途包裹（时间轴） ──
  const shipping = A(data.shipping);
  const shipSec = shipping.length ? h("section", { key: "ship" }, secTitle("在途包裹", shipping.length + " 件"),
    h("div", { style: { position: "relative", paddingLeft: 22 } },
      h("div", { "aria-hidden": "true", style: { position: "absolute", left: 6, top: 12, bottom: 26, width: 2, background: "rgba(255,106,43,.28)" } }),
      shipping.map((it, i) => h("div", { key: i, style: { position: "relative", marginBottom: 12 } },
        h("span", { "aria-hidden": "true", style: { position: "absolute", left: -22, top: 16, width: 13, height: 13, borderRadius: 99, background: SHOP_ORANGE, border: "3px solid " + SHOP_BG } }),
        card([
          h("div", { key: "a", className: "flex items-baseline justify-between gap-3" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: SHOP_ORANGE } }, it.status || "运输中"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: SHOP_DIM } }, it.eta || "")),
          it.shop ? h("div", { key: "b", style: { fontFamily: F_BODY, fontSize: 12.5, color: SHOP_DIM, marginTop: 9 } }, it.shop) : null,
          h("div", { key: "c", style: { fontFamily: F_DISPLAY, fontSize: 16, lineHeight: 1.45, color: SHOP_INK, marginTop: 5 } }, it.title || ""),
          h("div", { key: "d", style: { height: 4, borderRadius: 4, background: "#eeeef2", marginTop: 14, overflow: "hidden" } },
            h("div", { style: { width: Math.max(0, Math.min(100, Number(it.progress) || 0)) + "%", height: "100%", borderRadius: 4, background: SHOP_ORANGE } })),
          h("div", { key: "e", className: "flex items-baseline justify-between", style: { marginTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: SHOP_DIM } }, [it.carrier, it.tail ? "尾号 " + it.tail : ""].filter(Boolean).join(" · ")),
            it.amount != null ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: SHOP_ORANGE } }, shopMoney(it.amount)) : null)
        ], { marginBottom: 0 }))))) : null;
  // ── 购物车 ──
  const cart = A(data.cart);
  const cartSec = cart.length ? h("section", { key: "cart" }, secTitle("购物车", cart.length + " 件待结算"),
    card(cart.map((it, i) => h("div", { key: i, className: "flex gap-3", style: { padding: "14px 0", borderTop: i ? "1px solid #f0f0f4" : "none" } },
      thumb(it.title),
      h("div", { className: "flex-1 min-w-0" },
        it.shop ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: SHOP_DIM } }, it.shop) : null,
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.45, color: SHOP_INK, marginTop: 3 } }, it.title || ""),
        it.spec ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: SHOP_DIM, marginTop: 4 } }, it.spec) : null,
        h("div", { className: "flex items-center gap-2 flex-wrap", style: { marginTop: 8 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: SHOP_ORANGE } }, shopMoney(it.price)),
          Number(it.was) > Number(it.price) ? h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: "#b9b9c2", textDecoration: "line-through" } }, shopMoney(it.was)) : null,
          it.promo ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: SHOP_ORANGE, background: "rgba(255,106,43,.10)", borderRadius: 7, padding: "3px 8px" } }, it.promo) : null,
          h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: SHOP_DIM, marginLeft: "auto" } }, "×" + (it.qty || 1)))))))) : null;
  // ── 想买清单（两列卡片；why 是这一格的命） ──
  const wish = A(data.wish);
  const wishSec = wish.length ? h("section", { key: "wish" }, secTitle("想买清单", "种草 " + wish.length),
    h("div", { className: "grid grid-cols-2 gap-3", style: { marginBottom: 14 } }, wish.map((it, i) => h("button", {
      key: i, className: "text-left active:opacity-70",
      // ⚠️点开是看，不是发。转发一律要走详情里那颗单独的按钮——
      // 列表项直接触发转发是不可逆动作，手一滑就发出去了（她 2026-08-29 中招）。
      onClick: () => setSheet({ kind: "wish", it: it }),
      style: { background: SHOP_CARD, borderRadius: 16, overflow: "hidden" }
    }, h("div", { style: { height: 96, background: "linear-gradient(150deg," + WISH_COVERS[i % WISH_COVERS.length][0] + "," + WISH_COVERS[i % WISH_COVERS.length][1] + ")", display: "flex", alignItems: "center", justifyContent: "center" } },
      h("div", { style: { width: 46, height: 46, borderRadius: 13, background: "rgba(255,255,255,.62)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 19, color: "#5d5d66" } }, String(it.title || "?").trim().slice(0, 1))),
    h("div", { style: { padding: "12px 13px 15px" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, lineHeight: 1.4, color: SHOP_INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, it.title || ""),
      it.shop ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: SHOP_DIM, marginTop: 6 } }, it.shop) : null,
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: SHOP_ORANGE, marginTop: 7 } }, shopMoney(it.price)),
      it.why ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: "#84848d", marginTop: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, it.why) : null))))) : null;
  // ── 我的订单 ──
  const orders = A(data.orders);
  const orderSec = orders.length ? h("section", { key: "ord" }, secTitle("我的订单", orders.length + " 单"),
    orders.map((o, i) => card([
      h("div", { key: "h", className: "flex items-baseline justify-between gap-3" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: SHOP_INK } }, o.shop || ""),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: o.status === "已取消" ? SHOP_DIM : "#3fa363" } }, o.status || "")),
      o.time ? h("div", { key: "t", style: { fontFamily: F_BODY, fontSize: 12, color: SHOP_DIM, marginTop: 5 } }, o.time) : null,
      o.title ? h("div", { key: "n", style: { fontFamily: F_DISPLAY, fontSize: 16.5, lineHeight: 1.45, color: SHOP_INK, marginTop: 10 } }, o.title) : null,
      A(o.items).length ? h("div", { key: "it", style: { background: "#f5f5f8", borderRadius: 13, padding: "13px 14px", marginTop: 12 } },
        A(o.items).map((x, j) => h("div", { key: j, className: "flex items-start gap-3", style: { padding: j ? "10px 0 0" : "0", borderTop: j ? "1px solid #e9e9ee" : "none", marginTop: j ? 10 : 0 } },
          h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6, color: "#4b4b53" } }, (x.name || "") + (x.spec ? " · " + x.spec : "")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: SHOP_DIM, flexShrink: 0 } }, "×" + (x.qty || 1)),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#4b4b53", flexShrink: 0, minWidth: 54, textAlign: "right" } }, shopMoney(x.price))))) : null,
      h("div", { key: "p", className: "flex items-baseline justify-between", style: { marginTop: 13 } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: SHOP_DIM } }, "运费 " + shopMoney(o.ship)),
        h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: SHOP_ORANGE } }, "实付 ", h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15 } }, shopMoney(o.paid)))),
      A(o.tags).length ? h("div", { key: "g", className: "flex gap-2 flex-wrap", style: { marginTop: 12 } }, A(o.tags).map(tag)) : null,
      o.review ? h("div", { key: "r", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, color: "#7d7d86", marginTop: 13 } }, o.review) : null,
      o.reason ? h("div", { key: "w", style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, color: "#4b4b53", marginTop: 9 } }, o.reason) : null,
      o.addr ? h("div", { key: "a", style: { fontFamily: F_BODY, fontSize: 11.5, color: "#b3b3bb", marginTop: 11 } }, o.addr) : null,
      h("div", { key: "pk" }, peekBtn("quiet", "他的订单", o.title || o.shop, [o.reason, o.review, o.addr].filter(Boolean).join("｜")))
    ], { key: i }))) : null;
  // ── 购物习惯 ──
  const habitRows = [["预算", habit.budget], ["常买", habit.buys], ["不买", habit.avoids], ["习惯", habit.how]].filter(x => x[1]);
  const habitSec = habitRows.length ? h("section", { key: "hb" }, secTitle("购物习惯"),
    card(habitRows.map(([k, v], i) => h("div", { key: i, className: "flex gap-5", style: { padding: "14px 0", borderTop: i ? "1px solid #f0f0f4" : "none" } },
      h("span", { style: { width: 34, flexShrink: 0, fontFamily: F_BODY, fontSize: 12.5, color: SHOP_DIM } }, k),
      h("span", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 15.5, lineHeight: 1.6, color: SHOP_INK } }, v)))),
    peekBtn("quiet", "购物习惯", "他买东西的样子", habitRows.map(([k, v]) => k + "：" + v).join("｜"))) : null;
  // ── 常逛店铺 ──
  const shops = A(data.shops);
  const shopSec = shops.length ? h("section", { key: "sh" }, secTitle("常逛店铺"),
    card(shops.map((sp, i) => h("div", { key: i, className: "flex gap-3", style: { padding: "13px 0", borderTop: i ? "1px solid #f0f0f4" : "none" } },
      thumb(sp.name),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: SHOP_INK } }, sp.name || ""),
        sp.cat ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: SHOP_DIM, marginTop: 3 } }, sp.cat) : null,
        sp.why ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.65, color: "#84848d", marginTop: 6 } }, sp.why) : null))))) : null;
  // ── 优惠券 ──
  const coupons = A(data.coupons);
  const couponSec = coupons.length ? h("section", { key: "cp" }, secTitle("优惠券"),
    card(coupons.map((c, i) => h("div", { key: i, className: "flex items-stretch", style: { background: "rgba(255,106,43,.07)", borderRadius: 13, overflow: "hidden", marginTop: i ? 11 : 0 } },
      h("div", { style: { width: 118, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "18px 6px", borderRight: "1px dashed rgba(255,106,43,.36)", fontFamily: F_DISPLAY, fontSize: 16, color: SHOP_ORANGE, textAlign: "center", lineHeight: 1.3 } }, c.rule || ""),
      h("div", { style: { flex: 1, minWidth: 0, padding: "14px 15px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: SHOP_INK } }, c.name || ""),
        c.scope ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: SHOP_DIM, marginTop: 5 } }, c.scope) : null,
        c.until ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: SHOP_DIM, marginTop: 5 } }, "至 " + c.until) : null))))) : null;
  // ── 最近浏览 ──
  const viewed = A(data.viewed);
  const viewSec = viewed.length ? h("section", { key: "vw" }, secTitle("最近浏览"),
    card(viewed.map((v, i) => h("div", { key: i, className: "flex items-start gap-3", style: { padding: "13px 0", borderTop: i ? "1px solid #f0f0f4" : "none" } },
      h("div", { className: "flex-1 min-w-0" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, lineHeight: 1.45, color: SHOP_INK } }, v.title || ""),
        v.shop ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: SHOP_DIM, marginTop: 5 } }, v.shop) : null),
      h("div", { style: { flexShrink: 0, textAlign: "right" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: SHOP_ORANGE } }, shopMoney(v.price)),
        v.time ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: SHOP_DIM, marginTop: 4 } }, v.time) : null)))))  : null;
  // ── 收货地址（不是自己家的那条走 hidden） ──
  const addrs = A(data.addrs);
  const addrSec = addrs.length ? h("section", { key: "ad" }, secTitle("收货地址"),
    card(addrs.map((a, i) => h("div", { key: i, style: { padding: "14px 0", borderTop: i ? "1px solid #f0f0f4" : "none" } },
      h("div", { className: "flex items-center gap-2" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: SHOP_INK } }, a.label || ""),
        a.isDefault ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#3d7dd8", background: "rgba(61,125,216,.10)", borderRadius: 6, padding: "3px 8px" } }, "默认") : null,
        a.tail ? h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: SHOP_DIM, marginLeft: "auto" } }, a.tail) : null),
      a.detail ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, color: "#84848d", marginTop: 7 } }, a.detail) : null,
      !a.isDefault ? h("div", null, peekBtn("hidden", "收货地址", a.label, a.detail)) : null)))) : null;
  // ── 相关往来 ──
  const gifts = A(data.gifts);
  const giftSec = gifts.length ? h("section", { key: "gf" }, secTitle("相关往来"),
    card(gifts.map((g, i) => h("div", { key: i, style: { padding: "15px 0", borderTop: i ? "1px solid #f0f0f4" : "none" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: SHOP_DIM } }, g.who || ""),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, lineHeight: 1.45, color: SHOP_INK, marginTop: 6 } }, g.title || ""),
      g.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, color: "#84848d", marginTop: 7 } }, g.note) : null,
      h("div", null, peekBtn("quiet", "他给谁买的东西", (g.who || "") + " · " + (g.title || ""), g.note))))))  : null;
  // ── 本月概况 ──
  const monthSec = (data.monthNote || data.tail) ? h("section", { key: "mn" }, secTitle("本月购物概况"),
    data.monthNote ? card(h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.95, color: "#3f3f47" } }, data.monthNote)) : null,
    data.tail ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, color: "#a6a6ae", textAlign: "center", padding: "6px 14px 4px" } }, data.tail) : null) : null;
  // ── 分页：照真购物 App 的样子分四页，别一屏拉到底 ──
  const PAGES = [
    { key: "home",  zh: "首页",   glyph: "shopping", secs: [accountCard, shipSec, wishSec] },
    { key: "cart",  zh: "购物车", glyph: "cart",     secs: [cartSec, couponSec, viewSec], badge: cart.length },
    { key: "order", zh: "订单",   glyph: "orders",   secs: [orderSec], badge: orders.length },
    { key: "mine",  zh: "我的",   glyph: "me",       secs: [habitSec, shopSec, addrSec, giftSec, monthSec] }
  ];
  const page = PAGES.find(x => x.key === tab) || PAGES[0];
  const body = page.secs.filter(Boolean);
  const emptyWord = { home: "还没有购物记录，点右上角刷一次", cart: "购物车是空的", order: "还没有订单", mine: "还没有这个人的购物档案" }[page.key];
  const nav = h("div", {
    className: "shrink-0 grid grid-cols-4",
    style: { padding: "5px 12px", paddingBottom: COMPOSER_PAD_BOTTOM, background: "rgba(255,255,255,.96)", borderTop: "1px solid #e8e8ee" }
  }, PAGES.map(pg => h("button", {
    key: pg.key, onClick: () => { setTab(pg.key); setSheet(null); },
    className: "flex flex-col items-center justify-center active:opacity-60",
    style: { fontFamily: F_BODY, fontSize: 10.5, color: tab === pg.key ? SHOP_ORANGE : SHOP_DIM, paddingTop: 2, paddingBottom: 2 }
  }, h("div", { style: { position: "relative", width: 30, height: 20, display: "flex", alignItems: "center", justifyContent: "center" } },
    h(PGlyph, { k: pg.glyph, size: 16, color: tab === pg.key ? SHOP_ORANGE : SHOP_DIM }),
    pg.badge ? h("span", {
      style: { position: "absolute", top: -3, right: -1, minWidth: 15, height: 15, borderRadius: 99, background: SHOP_ORANGE, color: "#fff", fontFamily: F_BODY, fontSize: 9.5, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }
    }, pg.badge > 99 ? "99+" : pg.badge) : null),
  h("span", { style: { marginTop: 2 } }, pg.zh))));
  const chrome = h("div", { className: "shrink-0 flex items-center justify-between px-4 pb-2", style: { paddingTop: safeTop(10), background: "transparent" } },
    h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-60 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: SHOP_INK })),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: SHOP_INK } }, page.zh),
    h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-60 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40, marginRight: -8 } }, h(IRefresh, { size: 18, color: SHOP_INK })));
  // ── 详情弹层：看全文的地方，也是唯一能转发的地方 ──
  const sheetNode = sheet && sheet.kind === "wish" ? (function () {
    const it = sheet.it || {};
    return h("div", {
      className: "absolute inset-0 flex flex-col justify-end", style: { background: "rgba(20,18,16,.42)", zIndex: 30 },
      onClick: () => setSheet(null)
    }, h("div", {
      onClick: e => e.stopPropagation(),
      style: { background: SHOP_CARD, borderRadius: "20px 20px 0 0", maxHeight: "84%", overflowY: "auto", padding: "20px 20px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 20px)" }
    }, h("div", { className: "flex items-start justify-between gap-3" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: SHOP_DIM } }, "想买清单"),
      h("button", { onClick: () => setSheet(null), "aria-label": "关闭", className: "active:opacity-60", style: { fontSize: 15, color: SHOP_DIM, padding: "0 4px" } }, "✕")),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, lineHeight: 1.4, color: SHOP_INK, marginTop: 10 } }, it.title || ""),
    it.shop ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: SHOP_DIM, marginTop: 7 } }, it.shop) : null,
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: SHOP_ORANGE, marginTop: 10 } }, shopMoney(it.price)),
    it.why ? h("div", { style: { background: "#f5f5f8", borderRadius: 13, padding: "14px 15px", marginTop: 16 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: SHOP_DIM } }, "他为什么想买"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.9, color: "#3f3f47", marginTop: 7, whiteSpace: "pre-wrap" } }, it.why)) : null,
    peekBtn("quiet", "想买清单", it.title, [it.shop, it.price != null ? shopMoney(it.price) : "", it.why].filter(Boolean).join("｜"))));
  })() : null;
  return h("div", {
    className: "h-full min-h-0 flex flex-col relative",
    style: { background: "linear-gradient(178deg,#ffe6d8 0%,#eeeaf4 22%," + SHOP_BG + " 46%," + SHOP_BG + " 100%)" }
  }, chrome,
  h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 16px 24px" } },
    body.length ? body : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: SHOP_DIM } }, emptyWord)),
  nav, sheetNode);
}
// ============================================================
// 外卖 —— 他怎么把自己喂饱（她 2026-08-29 点名先搭个框）
// 备注那一栏比吃什么更暴露人：「不要香菜」「放门口就行」
// 「麻烦轻一点敲门，家里有人在睡」——这三条是三个不同的人。
// 三页：点餐（在送 + 常点的店）· 订单 · 我的（口味 / 地址 / 月结）
// ============================================================
const TAKE_AMBER = "#f5a623";
const TAKE_BG = "#f4f2ee";
const TAKE_INK = "#231f1a";
const TAKE_DIM = "#9c968c";
function TakeoutView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [tab, setTab] = useState("home");
  const [open, setOpen] = useState(null);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab]);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const acc = (data.account && typeof data.account === "object") ? data.account : {};
  const taste = (data.taste && typeof data.taste === "object") ? data.taste : {};
  const today = (data.today && typeof data.today === "object") ? data.today : {};
  const live = A(data.live), orders = A(data.orders), shops = A(data.shops), addrs = A(data.addrs);
  const week = A(data.week), coupons = A(data.coupons), wish = A(data.wish), together = A(data.together);
  const TAKE_COVERS = [["#7fd0a4", "#b9e6cd"], ["#f79a92", "#fbc7c2"], ["#f7b96a", "#fbd9ab"], ["#8fbdf0", "#c2d9f6"], ["#d4a9e8", "#e8cff4"], ["#f2d071", "#f9e7ae"]];
  const cov = n => TAKE_COVERS[(Number(n) || 0) % TAKE_COVERS.length];
  const card = (kids, extra) => h("div", { style: Object.assign({ background: "#fff", borderRadius: 18, padding: "17px 17px", marginBottom: 13 }, extra || {}) }, kids);
  // 小节标题：左边一根黄竖条（照参考稿）
  const secTitle = (title, right) => h("div", { className: "flex items-center justify-between", style: { padding: "8px 2px 12px" } },
    h("div", { className: "flex items-center", style: { gap: 8 } },
      h("span", { "aria-hidden": "true", style: { width: 4, height: 18, borderRadius: 3, background: TAKE_AMBER } }),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: TAKE_INK } }, title)),
    right ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: TAKE_DIM } }, right) : null);
  const peekBtn = (tier, label, title, text) => onPeek ? h("button", {
    onClick: e => { e.stopPropagation(); onPeek({ tier, label, title, text }); },
    className: "w-full active:opacity-60",
    style: { marginTop: 12, padding: "10px 0", borderRadius: 11, fontFamily: F_BODY, fontSize: 12,
      border: "1px solid " + (tier === "hidden" ? "rgba(200,80,70,.4)" : "#e9e4da"), color: tier === "hidden" ? "#b6473c" : "#5b564e" }
  }, tier === "hidden" ? "摆到 TA 面前 · 这是他藏起来的" : "转发给 TA · 他会知道你翻了手机") : null;
  const noteLine = txt => h("div", { className: "flex", style: { gap: 7, marginTop: 11 } },
    h("span", { style: { flexShrink: 0, fontFamily: F_DISPLAY, fontSize: 12.5, color: "#e8863a" } }, "备注 ·"),
    h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: "#8a7a5e" } }, txt));
  const initial = x => String(x || "?").trim().slice(0, 1);
  // ── 账户条 ──
  const accCard = card([
    h("div", { key: "a", className: "flex items-center", style: { gap: 13 } },
      h("div", { style: { width: 48, height: 48, borderRadius: 15, flexShrink: 0, background: "linear-gradient(150deg,#ffd167," + TAKE_AMBER + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" } }, h(PGlyph, { k: "takeout", size: 23, color: "#fff" })),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { className: "flex items-center flex-wrap", style: { gap: 7 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: TAKE_INK } }, acc.name || char.remark || char.name),
          acc.member ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: "#a8791f", background: "rgba(245,166,35,.16)", borderRadius: 999, padding: "3px 10px" } }, acc.member) : null),
        acc.uid ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: TAKE_DIM, marginTop: 5 } }, "账号 " + acc.uid) : null)),
    (acc.monthOrders != null || acc.monthSpend != null) ? h("div", { key: "n", className: "flex", style: { marginTop: 15, paddingTop: 13, borderTop: "1px solid #f3f1ec" } },
      [[acc.monthOrders != null ? acc.monthOrders : "--", "本月单数"], [acc.monthSpend != null ? fmtMoney(acc.monthSpend) : "--", "本月吃掉"]].map(([n, l], i) =>
        h("div", { key: i, className: "flex-1" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: TAKE_INK } }, n),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: TAKE_DIM, marginTop: 3 } }, l)))) : null,
    acc.persona ? h("div", { key: "p", style: { marginTop: 14, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, color: "#5b564e" } }, acc.persona) : null
  ]);
  // ── 今日推荐（照参考稿的那张大卡）──
  const todayCard = (today.shop || today.main) ? h("div", { key: "td", style: { background: "#fffdf6", borderRadius: 18, overflow: "hidden", marginBottom: 15, boxShadow: "0 8px 20px rgba(120,90,20,.08)" } },
    h("div", { className: "flex items-start", style: { gap: 11, padding: "16px 17px 14px", borderBottom: "1px solid #f4efe2" } },
      h("div", { style: { width: 30, height: 30, borderRadius: 99, flexShrink: 0, background: TAKE_AMBER, display: "flex", alignItems: "center", justifyContent: "center" } },
        h("span", { style: { width: 9, height: 9, borderRadius: 99, background: "#fff" } })),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { className: "flex items-center flex-wrap", style: { gap: 8 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: TAKE_INK } }, today.addrLabel || "家"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: "#8a6414", background: "rgba(245,200,60,.4)", borderRadius: 6, padding: "3px 8px" } }, "送这里")),
        today.addrDetail ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: TAKE_DIM, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, today.addrDetail) : null),
      today.date ? h("div", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 12, color: TAKE_DIM } }, today.date) : null),
    h("div", { style: { padding: "16px 17px 17px" } },
      h("div", { className: "flex items-start", style: { gap: 13 } },
        h("div", { style: { width: 66, height: 66, borderRadius: 14, flexShrink: 0, position: "relative", background: "linear-gradient(150deg,#ffc55e,#f08a2c)", display: "flex", alignItems: "center", justifyContent: "center" } },
          today.meal ? h("span", { style: { position: "absolute", left: -3, top: -8, fontFamily: F_BODY, fontSize: 10.5, color: "#fff", background: "#8a6414", borderRadius: 6, padding: "2px 7px" } }, today.meal) : null,
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 27, color: "#fff" } }, initial(today.shop))),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16.5, lineHeight: 1.4, color: TAKE_INK } }, today.shop || ""),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: TAKE_DIM, marginTop: 6 } },
            [today.rating ? h("span", { key: "r", style: { color: "#e8863a", fontFamily: F_DISPLAY, fontSize: 13 } }, today.rating + "分 ") : null, [today.eta, today.delivery].filter(Boolean).join("  ")]))),
      today.main ? h("div", { className: "flex", style: { gap: 7, marginTop: 13 } },
        h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 13.5, color: TAKE_DIM } }, "主推 ·"),
        h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: 15.5, lineHeight: 1.55, color: TAKE_INK } }, today.main)) : null,
      h("div", { className: "flex items-center justify-between", style: { marginTop: 14 } },
        today.amount != null ? h("span", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: "#f0523a" } }, fmtMoney(today.amount)) : h("span", null),
        today.status ? h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: "#fff", background: "#3fbb6e", borderRadius: 999, padding: "7px 18px" } }, today.status) : null),
      today.note ? noteLine(today.note) : null,
      h("div", null, peekBtn("quiet", "他今天点的", today.shop, [today.main, today.note].filter(Boolean).join("｜"))))) : null;
  // ── 常点商家（横滑）──
  const shopSec = shops.length ? h("section", { key: "sp" }, secTitle("常点商家", "共 " + shops.length + " 家"),
    h("div", { className: "flex overflow-x-auto", style: { gap: 11, paddingBottom: 4, scrollbarWidth: "none", marginBottom: 13 } },
      shops.map((sp, i) => h("div", { key: i, style: { width: 196, flexShrink: 0, background: "#fff", borderRadius: 15, overflow: "hidden" } },
        h("div", { style: { height: 76, position: "relative", background: "linear-gradient(150deg," + cov(sp.cover != null ? sp.cover : i)[0] + "," + cov(sp.cover != null ? sp.cover : i)[1] + ")", display: "flex", alignItems: "center", justifyContent: "center" } },
          h("div", { style: { width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,.82)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 19, color: "#5a5148" } }, initial(sp.name)),
          sp.times ? h("span", { style: { position: "absolute", right: 7, top: 7, fontFamily: F_BODY, fontSize: 10.5, color: "#fff", background: "rgba(0,0,0,.35)", borderRadius: 7, padding: "3px 8px" } }, sp.times) : null),
        h("div", { style: { padding: "11px 12px 13px" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: TAKE_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, sp.name || ""),
          sp.usual ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: TAKE_DIM, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "常点 · " + sp.usual) : null,
          sp.why ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#e8863a", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, sp.why) : null,
          sp.last ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#b8b2a8", marginTop: 6 } }, sp.last) : null))))) : null;
  // ── 进行中（四段进度）──
  const STEPS = ["已下单", "商家接单", "配送中", "待送达"];
  const liveSec = live.length ? h("section", { key: "lv" }, secTitle("进行中的订单", "实时配送"),
    live.map((it, i) => {
      const st = Math.max(0, Math.min(3, Number(it.step) || 0));
      return h("div", { key: i, style: { background: "#fff", borderRadius: 18, overflow: "hidden", marginBottom: 13 } },
        h("div", { className: "flex items-center justify-between", style: { padding: "13px 16px", background: "#fff8e6" } },
          h("div", { className: "flex items-center", style: { gap: 8 } },
            h("span", { style: { width: 9, height: 9, borderRadius: 99, background: "#f0523a" } }),
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: "#f0523a" } }, it.status || "配送中")),
          h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: TAKE_DIM } }, it.eta || "")),
        h("div", { style: { padding: "15px 16px 17px" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: TAKE_INK } }, it.shop || ""),
          it.items ? h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, color: "#6b665e", marginTop: 7 } }, it.items) : null,
          h("div", { className: "flex", style: { marginTop: 15 } }, STEPS.map((sname, j) => h("div", { key: j, className: "flex-1 flex flex-col items-center", style: { gap: 6 } },
            h("span", { style: { width: 11, height: 11, borderRadius: 99, background: j < st ? "#3fbb6e" : j === st ? "#fff" : "#e6e3dd", border: j === st ? "3px solid " + TAKE_AMBER : "none" } }),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: j < st ? "#3fbb6e" : j === st ? "#e8863a" : "#b8b2a8" } }, sname)))),
          h("div", { style: { height: 4, borderRadius: 4, background: "#f0eee9", marginTop: 12, overflow: "hidden" } },
            h("div", { style: { width: ((st + 1) / 4 * 100) + "%", height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#ffd167," + TAKE_AMBER + ")" } })),
          h("div", { className: "flex items-baseline justify-between", style: { marginTop: 13 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: TAKE_DIM } }, it.rider ? "骑手 · " + it.rider : ""),
            it.amount != null ? h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#f0523a" } }, fmtMoney(it.amount)) : null),
          it.note ? noteLine(it.note) : null));
    })) : null;
  // ── 我的订单 ──
  const stars = n => h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: "#f0a92c", letterSpacing: 2 } }, "★".repeat(Math.max(0, Math.min(5, Number(n) || 0))));
  const orderSec = orders.length ? h("section", { key: "od" }, secTitle("我的订单", orders.length + " 单"),
    orders.map((o, i) => card([
      h("div", { key: "h", className: "flex items-start", style: { gap: 11 } },
        h("div", { style: { width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: "linear-gradient(150deg," + cov(i)[0] + "," + cov(i)[1] + ")", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 18, color: "#5a5148" } }, initial(o.shop)),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, lineHeight: 1.4, color: TAKE_INK } }, o.shop || ""),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: TAKE_DIM, marginTop: 4 } }, [o.time, o.meal].filter(Boolean).join(" "))),
        h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 12.5, color: o.status === "已取消" ? TAKE_DIM : "#9a948b" } }, o.status || "")),
      o.main ? h("div", { key: "m", className: "flex", style: { gap: 7, marginTop: 13 } },
        h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 13, color: TAKE_DIM } }, "主菜 ·"),
        h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: 14.5, lineHeight: 1.55, color: TAKE_INK } }, o.main)) : null,
      A(o.items).length ? h("div", { key: "it", style: { background: "#f7f5f1", borderRadius: 12, padding: "12px 13px", marginTop: 12 } },
        A(o.items).map((x, j) => h("div", { key: j, className: "flex items-start", style: { gap: 10, marginTop: j ? 11 : 0 } },
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5, color: "#3f3a34" } }, x.name || ""),
            x.spec ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#a8a29a", marginTop: 3 } }, x.spec) : null),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: TAKE_DIM, flexShrink: 0 } }, "×" + (x.qty || 1)),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: "#3f3a34", flexShrink: 0, minWidth: 52, textAlign: "right" } }, fmtMoney(x.price))))) : null,
      h("div", { key: "f", className: "flex items-baseline justify-between", style: { marginTop: 12 } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#b3ada4" } }, ["包装费 " + fmtMoney(o.pack), "配送费 " + fmtMoney(o.fee)].join("  ")),
        o.amount != null ? h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: TAKE_DIM } }, "实付 ", h("span", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: "#f0523a" } }, fmtMoney(o.amount))) : null),
      (o.stars || o.rating) ? h("div", { key: "r", style: { marginTop: 13, background: "#fffbef", border: "1px solid #f6eccf", borderRadius: 12, padding: "12px 14px" } },
        o.stars ? stars(o.stars) : null,
        o.rating ? h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.8, color: "#5b564e", marginTop: 7 } }, o.rating) : null) : null,
      A(o.tags).length ? h("div", { key: "g", className: "flex flex-wrap", style: { gap: 7, marginTop: 12 } },
        A(o.tags).map((tg, j) => h("span", { key: j, style: { fontFamily: F_BODY, fontSize: 11, color: ["#a8791f", "#3f8a5c", "#c05a6a"][j % 3], background: ["rgba(245,200,60,.16)", "rgba(63,138,92,.10)", "rgba(192,90,106,.10)"][j % 3], border: "1px solid " + ["rgba(245,200,60,.4)", "rgba(63,138,92,.24)", "rgba(192,90,106,.24)"][j % 3], borderRadius: 7, padding: "3px 9px" } }, tg))) : null,
      o.addr ? h("div", { key: "a", style: { fontFamily: F_BODY, fontSize: 11.5, color: "#b3ada4", marginTop: 11 } }, "📍 " + o.addr) : null,
      o.note ? h("div", { key: "n" }, noteLine(o.note)) : null,
      o.reason ? h("div", { key: "w", style: { marginTop: 12, background: "#f6f5f2", borderRadius: 10, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, color: "#5b564e" } }, o.reason) : null,
      h("div", { key: "pk" }, peekBtn("quiet", "他点的外卖", (o.shop || "") + (o.main ? " · " + o.main : ""), [o.note ? "备注：" + o.note : "", o.reason, o.rating, o.addr].filter(Boolean).join("｜")))
    ], { key: i }))) : null;
  // ── 口味偏好（三组彩色药丸）──
  const pills = (list, tone) => h("div", { className: "flex flex-wrap", style: { gap: 8 } }, A(list).map((x, i) => h("span", {
    key: i, style: {
      fontFamily: F_BODY, fontSize: 13, lineHeight: 1.5, borderRadius: 999, padding: "7px 15px",
      color: tone === "warn" ? "#c0453c" : tone === "good" ? "#3f8a5c" : "#8a6414",
      background: tone === "warn" ? "#fdeeec" : tone === "good" ? "#eef7f0" : "#fdf5dd",
      border: "1px solid " + (tone === "warn" ? "#f6d5d1" : tone === "good" ? "#d6ebdd" : "#f2e3b4")
    }
  }, x)));
  const tasteRow = (k, node) => h("div", { className: "flex", style: { gap: 16, padding: "15px 0", borderTop: "1px solid #f3f1ec" } },
    h("span", { style: { width: 34, flexShrink: 0, fontFamily: F_BODY, fontSize: 12.5, color: TAKE_DIM, paddingTop: 6 } }, k),
    h("div", { style: { flex: 1, minWidth: 0 } }, node));
  const hasTaste = A(taste.spicyTags).length || A(taste.avoidTags).length || A(taste.likeTags).length || taste.budget || taste.habit;
  const tasteSec = hasTaste ? h("section", { key: "ts" }, secTitle("口味偏好", "点餐画像"),
    card([
      A(taste.spicyTags).length ? h("div", { key: "s" }, tasteRow("辣度", pills(taste.spicyTags, "amber"))) : null,
      A(taste.avoidTags).length ? h("div", { key: "a" }, tasteRow("忌口", pills(taste.avoidTags, "warn"))) : null,
      A(taste.likeTags).length ? h("div", { key: "l" }, tasteRow("偏好", pills(taste.likeTags, "good"))) : null,
      taste.budget ? h("div", { key: "b" }, tasteRow("预算", h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.7, color: TAKE_INK, paddingTop: 4 } }, taste.budget))) : null,
      taste.habit ? h("div", { key: "h" }, tasteRow("习惯", h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, lineHeight: 1.7, color: TAKE_INK, paddingTop: 4 } }, taste.habit))) : null
    ]),
    peekBtn("quiet", "他的口味", "他吃东西的样子", [A(taste.avoidTags).length ? "忌口：" + A(taste.avoidTags).join("、") : "", taste.habit].filter(Boolean).join("｜"))) : null;
  // ── 本周吃什么（七日横滑）──
  const weekSec = week.length ? h("section", { key: "wk" }, secTitle("本周吃什么", "七日餐次"),
    h("div", { className: "flex overflow-x-auto", style: { gap: 11, paddingBottom: 4, scrollbarWidth: "none", marginBottom: 13 } },
      week.map((dy, i) => h("div", { key: i, style: { width: 178, flexShrink: 0, background: "#fff", borderRadius: 15, padding: "14px 14px 16px" } },
        h("div", { style: { width: 32, height: 32, borderRadius: 10, background: TAKE_AMBER, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 16, marginBottom: 12 } }, dy.day || ""),
        A(dy.meals).map((ml, j) => h("div", { key: j, className: "flex", style: { gap: 7, marginTop: j ? 11 : 0, borderLeft: "3px solid #f2e3b4", paddingLeft: 8 } },
          h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 11.5, color: "#b8a76e" } }, ml.t || ""),
          h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: "#4d4842", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, ml.text || ""))))))) : null;
  // ── 红包卡券 ──
  const couponSec = coupons.length ? h("section", { key: "cp" }, secTitle("红包卡券"),
    card(coupons.map((c, i) => h("div", { key: i, className: "flex items-stretch", style: { borderRadius: 12, overflow: "hidden", border: "1px solid #fbdcd6", marginTop: i ? 11 : 0 } },
      h("div", { style: { width: 108, flexShrink: 0, background: "#f2503f", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 8px", textAlign: "center" } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: c.unit ? 27 : 14, lineHeight: 1.25 } }, c.amount || ""),
        c.unit ? h("span", { style: { fontFamily: F_BODY, fontSize: 12, opacity: .9, marginTop: 2 } }, c.unit) : null),
      h("div", { style: { flex: 1, minWidth: 0, padding: "13px 14px", background: "#fffaf9" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: TAKE_INK } }, c.name || ""),
        c.scope ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, color: TAKE_DIM, marginTop: 5 } }, "适用于 " + c.scope) : null,
        c.until ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#e8863a", marginTop: 5 } }, "有效期至 " + c.until) : null))))) : null;
  // ── 收货地址 ──
  const addrSec = addrs.length ? h("section", { key: "ad" }, secTitle("收货地址"),
    card(addrs.map((a, i) => h("div", { key: i, style: { borderRadius: 12, padding: "13px 14px", marginTop: i ? 10 : 0, background: a.isDefault ? "#fffbef" : "#f7f6f3", border: "1px solid " + (a.isDefault ? "#f4e6bb" : "transparent") } },
      h("div", { className: "flex items-center", style: { gap: 8 } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: TAKE_INK } }, a.label || ""),
        a.isDefault ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#7a5a12", background: TAKE_AMBER, borderRadius: 5, padding: "3px 8px" } }, "默认") : null,
        a.tail ? h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 12.5, color: TAKE_DIM } }, a.tail) : null),
      a.detail ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.75, color: "#8a847b", marginTop: 7 } }, a.detail) : null,
      !a.isDefault ? h("div", null, peekBtn("hidden", "外卖常用地址", a.label, a.detail)) : null)))) : null;
  // ── 想吃清单 ──
  // ⚠️标题独占一行：跟指标名那次一样，中文在窄 flex 里会被压成一条竖字
  const wishSec = wish.length ? h("section", { key: "ws" }, secTitle("想吃清单", "馋着的 " + wish.length + " 样"),
    card(wish.map((w, i) => h("div", { key: i, style: { padding: "14px 0", borderTop: i ? "1px solid #f3f1ec" : "none" } },
      h("div", { className: "flex items-start", style: { gap: 9 } },
        h("span", { style: { width: 7, height: 7, borderRadius: 99, marginTop: 8, flexShrink: 0, background: TAKE_AMBER } }),
        h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: 15.5, lineHeight: 1.6, color: TAKE_INK, wordBreak: "break-word" } }, w.title || "")),
      w.when ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.75, color: "#8a847b", background: "#f6f5f2", borderRadius: 9, padding: "9px 12px", marginTop: 9 } }, w.when) : null)),
    ), peekBtn("quiet", "他想吃的", wish.map(w => w.title).filter(Boolean).slice(0, 3).join("、"), wish.map(w => (w.title || "") + "（" + (w.when || "") + "）").join("｜"))) : null;
  // ── 一起点过 ──
  const togSec = together.length ? h("section", { key: "tg" }, secTitle("一起点过"),
    card(together.map((g, i) => h("div", { key: i, style: { borderLeft: "3px solid " + TAKE_AMBER, background: "#fffdf6", borderRadius: "0 12px 12px 0", padding: "14px 15px", marginTop: i ? 12 : 0 } },
      g.who ? h("span", { style: { display: "inline-block", fontFamily: F_BODY, fontSize: 12, color: "#e8863a", background: "rgba(245,166,35,.14)", borderRadius: 7, padding: "4px 10px" } }, g.who) : null,
      g.items ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, lineHeight: 1.5, color: TAKE_INK, marginTop: 9, wordBreak: "break-word" } }, g.items) : null,
      g.story ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.85, color: "#8a847b", marginTop: 8 } }, g.story) : null,
      h("div", null, peekBtn("quiet", "他和谁一起点的", (g.who || "") + " · " + (g.items || ""), g.story)))))) : null;
  const monthSec = (data.monthNote || data.tail) ? h("section", { key: "mn" }, secTitle("本周点餐概况"),
    data.monthNote ? h("div", { style: { background: "#fff", borderRadius: 16, borderLeft: "5px solid " + TAKE_AMBER, padding: "17px 18px", marginBottom: 13 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.95, color: "#4d4842" } }, data.monthNote)) : null,
    data.tail ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.85, color: "#a8a29a", textAlign: "center", padding: "4px 14px 6px" } }, data.tail) : null) : null;
  const PAGES = [
    { key: "home", zh: "点餐", glyph: "takeout", secs: [accCard, todayCard, shopSec, liveSec], badge: live.length },
    { key: "order", zh: "订单", glyph: "orders", secs: [orderSec], badge: orders.length },
    { key: "taste", zh: "口味", glyph: "health", secs: [tasteSec, weekSec] },
    { key: "mine", zh: "我的", glyph: "me", secs: [addrSec, wishSec, togSec, couponSec, monthSec] }
  ];
  const page = PAGES.find(x => x.key === tab) || PAGES[0];
  const body = page.secs.filter(Boolean);
  const chrome = h("div", { className: "shrink-0 flex items-center justify-between px-4 pb-2", style: { paddingTop: safeTop(10) } },
    h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-60 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: "#7a6428" })),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#6a5a2a" } }, page.zh),
    h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-60 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40, marginRight: -8 } }, h(IRefresh, { size: 18, color: "#7a6428" })));
  const nav = h("div", {
    className: "shrink-0 grid grid-cols-4",
    style: { padding: "5px 12px", paddingBottom: COMPOSER_PAD_BOTTOM, background: "rgba(255,255,255,.97)", borderTop: "1px solid #eae6df" }
  }, PAGES.map(pg => h("button", {
    key: pg.key, onClick: () => { setTab(pg.key); setOpen(null); },
    className: "flex flex-col items-center justify-center active:opacity-60",
    style: { fontFamily: F_BODY, fontSize: 10.5, color: tab === pg.key ? "#e8863a" : TAKE_DIM, paddingTop: 2, paddingBottom: 2 }
  }, h("div", { style: { position: "relative", width: 30, height: 20, display: "flex", alignItems: "center", justifyContent: "center" } },
    h(PGlyph, { k: pg.glyph, size: 16, color: tab === pg.key ? "#e8863a" : TAKE_DIM }),
    pg.badge ? h("span", { style: { position: "absolute", top: -3, right: -1, minWidth: 15, height: 15, borderRadius: 99, background: "#f0523a", color: "#fff", fontFamily: F_BODY, fontSize: 9.5, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" } }, pg.badge > 99 ? "99+" : pg.badge) : null),
  h("span", { style: { marginTop: 2 } }, pg.zh))));
  return h("div", { className: "h-full min-h-0 flex flex-col relative", style: { background: "linear-gradient(178deg,#ffd534 0%,#ffe484 13%,#f7f2e6 30%," + TAKE_BG + " 46%," + TAKE_BG + " 100%)" } },
    chrome,
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 16px 24px" } },
      body.length ? body : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: TAKE_DIM } }, "这一页还是空的，点右上角刷一次")),
    nav);
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
const HEALTH_HUES = [
  { bar: "#b9a7dd", chip: "rgba(185,167,221,.20)", chipInk: "#6a55a0", bar2: "#cfc2e8", ink: "#5b4a8c" },
  { bar: "#8fc79a", chip: "rgba(143,199,154,.20)", chipInk: "#3f7a4d", bar2: "#bfe0c6", ink: "#3f7a4d" },
  { bar: "#8fb8dd", chip: "rgba(143,184,221,.20)", chipInk: "#3d6d96", bar2: "#c2d9ec", ink: "#3d6d96" },
  { bar: "#e59aa8", chip: "rgba(229,154,168,.20)", chipInk: "#a5495c", bar2: "#f2c6ce", ink: "#a5495c" },
  { bar: "#dfbc86", chip: "rgba(223,188,134,.22)", chipInk: "#8a6529", bar2: "#eeddbe", ink: "#8a6529" },
  { bar: "#8ccbc0", chip: "rgba(140,203,192,.20)", chipInk: "#357c70", bar2: "#c1e3dd", ink: "#357c70" }
];
const HEALTH_BG = "#eef0f3";
const HEALTH_INK = "#22252a";
const HEALTH_DIM = "#9aa0a8";
const HEALTH_GROUPS = [
  { key: "body", zh: "体征", glyph: "health" },
  { key: "mind", zh: "心神", glyph: "liked" },
  { key: "intake", zh: "摄入", glyph: "takeout" }
];
function HealthView({ d, char, t, onBack, onRefresh, refreshing, onPeek, vitals }) {
  const [tab, setTab] = useState("body");
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab]);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const cards = A(data.cards).filter(x => x && typeof x === "object");
  const today = (data.today && typeof data.today === "object") ? data.today : {};
  const hueOf = i => HEALTH_HUES[i % HEALTH_HUES.length];
  const peekBtn = (label, title, text) => onPeek ? h("button", {
    onClick: e => { e.stopPropagation(); onPeek({ tier: "quiet", label, title, text }); },
    className: "w-full active:opacity-60",
    style: { marginTop: 12, padding: "10px 0", borderRadius: 11, fontFamily: F_BODY, fontSize: 12, border: "1px solid #e2e5e9", color: "#5c6169" }
  }, "转发给 TA · 他会知道你翻了手机") : null;
  // 一周条：底浅顶深的胶囊，跟参考稿一样
  const weekBars = (arr, hue) => {
    const vals = A(arr).slice(0, 7).map(v => Math.max(0, Math.min(100, Number(v) || 0)));
    if (!vals.length) return null;
    const days = ["一", "二", "三", "四", "五", "六", "日"];
    return h("div", { className: "flex items-end", style: { gap: 6, marginTop: 16 } }, vals.map((v, i) => h("div", {
      key: i, className: "flex-1 flex flex-col items-center", style: { gap: 5 }
    }, h("div", { style: { width: "100%", height: 42, borderRadius: 7, background: hue.chip, position: "relative", overflow: "hidden" } },
      h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, height: Math.round(42 * v / 100), background: hue.bar2 } })),
    h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: HEALTH_DIM } }, days[i] || ""))));
  };
  const statGrid = stats => {
    const rows = A(stats).filter(x => x && (x.k || x.v)).slice(0, 3);
    if (!rows.length) return null;
    return h("div", { className: "grid grid-cols-2", style: { gap: "12px 14px", marginTop: 15, paddingTop: 14, borderTop: "1px solid #eff1f4" } },
      rows.map((x, i) => h("div", { key: i, style: i === 2 ? { gridColumn: "1 / -1" } : null },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.45, color: HEALTH_DIM } }, x.k || ""),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: HEALTH_INK, marginTop: 3 } }, x.v || ""))));
  };
  const metricCard = (c, i, narrow) => {
    const hue = hueOf(i);
    return h("div", { key: i, style: { background: "#fff", borderRadius: 18, overflow: "hidden", marginBottom: 13, flex: narrow ? 1 : "none", minWidth: 0 } },
      h("div", { "aria-hidden": "true", style: { height: 4, background: hue.bar } }),
      h("div", { style: { padding: narrow ? "15px 14px 17px" : "17px 18px 19px" } },
        // ⚠️指标名是模型起的，可能长到「静息与应激心率」七个字。窄卡里如果让它跟
        // 图标和分数挤在同一行，flex 会把它压到 min-content——中文任何位置都能断，
        // min-content 就是一个字宽，于是标题竖成一条（她 2026-08-29 报）。
        // 所以窄卡改成两行：图标＋分数占一行，名字自己独占一整行。
        narrow
          ? h("div", null,
              h("div", { className: "flex items-center justify-between" },
                h("div", { style: { width: 30, height: 30, borderRadius: 10, background: hue.chip, display: "flex", alignItems: "center", justifyContent: "center" } },
                  h("span", { style: { width: 9, height: 9, borderRadius: 99, border: "2px solid " + hue.bar } })),
                c.score != null ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: hue.ink } }, c.score, h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: HEALTH_DIM } }, "分")) : null),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, lineHeight: 1.35, color: HEALTH_INK, marginTop: 9, wordBreak: "break-word" } }, c.name || ""))
          : h("div", { className: "flex items-start justify-between gap-3" },
              h("div", { className: "flex items-start gap-2.5", style: { flex: 1, minWidth: 0 } },
                h("div", { style: { width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: hue.chip, display: "flex", alignItems: "center", justifyContent: "center" } },
                  h("span", { style: { width: 9, height: 9, borderRadius: 99, border: "2px solid " + hue.bar } })),
                h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: 15.5, lineHeight: 1.3, color: HEALTH_INK, wordBreak: "break-word" } }, c.name || "")),
              c.score != null ? h("div", { style: { flexShrink: 0, fontFamily: F_DISPLAY, fontSize: 16, color: hue.ink } }, c.score, h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: HEALTH_DIM } }, "分")) : null),
        h("div", { className: "flex items-end gap-2 flex-wrap", style: { marginTop: 14 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 33, lineHeight: 1.05, color: HEALTH_INK } }, c.value != null ? String(c.value) : "--",
            c.unit ? h("span", { style: { fontFamily: F_BODY, fontSize: 14, color: HEALTH_DIM, marginLeft: 3 } }, c.unit) : null),
          c.tag ? h("span", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.4, color: hue.chipInk, background: hue.chip, borderRadius: 11, padding: "5px 11px", marginBottom: 3 } }, c.tag) : null),
        c.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.85, color: "#4a4f57", marginTop: 13 } }, c.note) : null,
        statGrid(c.stats),
        weekBars(c.week, hue),
        c.quote ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.8, color: "#a9aeb6", marginTop: 15, fontStyle: "italic" } }, "「" + c.quote + "」") : null,
        !narrow ? h("div", null, peekBtn("健康 · " + (c.name || ""), (c.name || "") + " " + (c.value != null ? c.value : "") + (c.unit || ""), [c.tag, c.note, c.quote].filter(Boolean).join("｜"))) : null));
  };
  // 窄卡两两并排（照参考稿），宽卡整行
  const layoutCards = list => {
    const out = [];
    let buf = [];
    let idx = 0;
    list.forEach(c => {
      const i = idx++;
      if (c.wide) {
        if (buf.length) { out.push(h("div", { key: "r" + out.length, className: "flex items-start", style: { gap: 12 } }, buf)); buf = []; }
        out.push(metricCard(c, i, false));
      } else {
        buf.push(metricCard(c, i, true));
        if (buf.length === 2) { out.push(h("div", { key: "r" + out.length, className: "flex items-start", style: { gap: 12 } }, buf)); buf = []; }
      }
    });
    if (buf.length) out.push(h("div", { key: "r" + out.length, className: "flex items-start", style: { gap: 12 } }, buf));
    return out;
  };
  // ── 头卡：叠纸 + 今日综合分环 ──
  const headCard = h("div", { key: "hd", style: { position: "relative", marginBottom: 22 } },
    h("div", { "aria-hidden": "true", style: { position: "absolute", left: 10, right: 22, top: -8, height: 46, borderRadius: 16, background: "rgba(255,255,255,.5)" } }),
    h("div", { "aria-hidden": "true", style: { position: "absolute", left: 4, right: 14, top: -4, height: 46, borderRadius: 16, background: "rgba(255,255,255,.75)" } }),
    h("div", { style: { position: "relative", background: "#fff", borderRadius: 18, padding: "22px 20px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 10px 26px rgba(40,45,55,.07)" } },
      h("div", { className: "flex-1 min-w-0" },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10.5, letterSpacing: ".18em", color: HEALTH_DIM } }, "ARCHIVE · WELLNESS"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 30, color: HEALTH_INK, marginTop: 6 } }, "健康"),
        today.label ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: HEALTH_DIM, marginTop: 6 } }, today.label) : null),
      h("div", { style: { position: "relative", width: 92, height: 92, flexShrink: 0 } },
        (function () {
          const p = Math.max(0, Math.min(100, Number(today.score) || 0)) / 100;
          const r = 39, circ = 2 * Math.PI * r;
          return h("svg", { width: 92, height: 92, viewBox: "0 0 92 92", "aria-hidden": "true" },
            h("circle", { cx: 46, cy: 46, r: r, fill: "none", stroke: "#eceef2", strokeWidth: 6 }),
            h("circle", { cx: 46, cy: 46, r: r, fill: "none", stroke: p >= 0.8 ? "#8fc79a" : p >= 0.5 ? "#dfbc86" : "#e0937d", strokeWidth: 6, strokeLinecap: "round", strokeDasharray: circ, strokeDashoffset: circ * (1 - p), transform: "rotate(-90 46 46)" }));
        })(),
        h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25, color: HEALTH_INK, lineHeight: 1 } }, today.score != null ? today.score : "--"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: HEALTH_DIM, marginTop: 3 } }, "综合")))));
  // ── 这一段时间的综合分（每日轻量快照，不是把整份报告天天累计）──
  // 报告本身代表【今天】，每次照实重写；趋势另存一条一天一个数的线。
  const vt = A(vitals).filter(x => x && x.score != null && isFinite(Number(x.score))).slice(0, 30).reverse();
  const trendSec = vt.length >= 2 ? h("section", { key: "vt", style: { marginTop: 16 } },
    h("div", { className: "flex items-baseline justify-between", style: { marginBottom: 10 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: HEALTH_INK } }, "这些天的综合分"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: HEALTH_DIM } }, vt.length + " 天")),
    h("div", { style: { display: "flex", alignItems: "flex-end", gap: 3, height: 56, padding: "0 2px" } },
      vt.map((x, i) => {
        const v = Math.max(0, Math.min(100, Number(x.score)));
        const last = i === vt.length - 1;
        return h("div", {
          key: x.day || i, title: x.day + " · " + v,
          style: {
            flex: 1, minWidth: 0, height: Math.max(4, Math.round(v * 0.54)) + "px", borderRadius: 3,
            background: last ? HEALTH_INK : "rgba(31,29,26,.16)"
          }
        });
      })),
    h("div", { className: "flex items-center justify-between", style: { marginTop: 6 } },
      h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, color: HEALTH_DIM } }, String(vt[0].day || "").slice(5)),
      h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, color: HEALTH_DIM } }, "今天"))) : null;
  // ── 今日轨迹 ──
  const timeline = A(data.timeline);
  const timelineSec = timeline.length ? h("section", { key: "tl" },
    h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10.5, letterSpacing: ".18em", color: HEALTH_DIM, padding: "4px 4px 4px" } }, "TIMELINE"),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, color: HEALTH_INK, padding: "0 4px 14px" } }, "今日轨迹"),
    timeline.map((it, i) => {
      const hue = hueOf(i);
      return h("div", { key: i, style: { background: "#fff", borderRadius: 14, borderLeft: "4px solid " + hue.bar, padding: "14px 16px", marginBottom: 11 } },
        h("div", { className: "flex items-center gap-2.5" },
          h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12.5, color: HEALTH_DIM } }, it.time || ""),
          it.tag ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: hue.chipInk, background: hue.chip, borderRadius: 8, padding: "3px 9px" } }, it.tag) : null),
        h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.8, color: "#3f444b", marginTop: 8 } }, it.text || ""));
    })) : null;
  // ── 健康洞察 ──
  const insights = A(data.insights);
  const insightSec = insights.length ? h("section", { key: "in", style: { marginTop: 22 } },
    h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10.5, letterSpacing: ".18em", color: HEALTH_DIM, padding: "4px 4px 4px" } }, "INSIGHT"),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, color: HEALTH_INK, padding: "0 4px 14px" } }, "健康洞察"),
    insights.map((it, i) => {
      const hue = hueOf(i + 2);
      return h("div", { key: i, style: { background: hue.chip, borderRadius: 16, padding: "17px 18px", marginBottom: 12 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: hue.chipInk } }, it.title || ""),
        h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.85, color: "#43484f", marginTop: 8 } }, it.text || ""));
    }),
    data.tail ? h("div", null,
      h("div", { "aria-hidden": "true", style: { width: 26, height: 2, borderRadius: 2, background: "#cfd4da", margin: "20px auto 14px" } }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.85, color: "#9aa0a8", textAlign: "center", padding: "0 10px" } }, data.tail)) : null,
    onPeek ? peekBtn("健康洞察", "他今天的身体", insights.map(x => (x.title || "") + "：" + (x.text || "")).join("｜")) : null) : null;
  const byGroup = g => cards.filter(c => (c.group || "body") === g);
  const PAGES = HEALTH_GROUPS.map(g => ({
    key: g.key, zh: g.zh, glyph: g.glyph,
    secs: (g.key === "body" ? [headCard] : []).concat(layoutCards(byGroup(g.key)))
  })).concat([{ key: "track", zh: "轨迹", glyph: "calendar", secs: [trendSec, timelineSec, insightSec].filter(Boolean) }]);
  const page = PAGES.find(x => x.key === tab) || PAGES[0];
  const body = page.secs.filter(Boolean);
  const chrome = h("div", { className: "shrink-0 flex items-center justify-between px-4 pb-2", style: { paddingTop: safeTop(10) } },
    h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-60 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IArrow, { size: 19, color: "#5c6169" })),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: HEALTH_INK } }, page.zh),
    h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-60 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: "#5c6169" })));
  const nav = h("div", {
    className: "shrink-0 grid grid-cols-4",
    style: { padding: "5px 12px", paddingBottom: COMPOSER_PAD_BOTTOM, background: "rgba(255,255,255,.96)", borderTop: "1px solid #e5e8ec" }
  }, PAGES.map(pg => h("button", {
    key: pg.key, onClick: () => setTab(pg.key),
    className: "flex flex-col items-center justify-center active:opacity-60",
    style: { fontFamily: F_BODY, fontSize: 10.5, color: tab === pg.key ? "#5b4a8c" : HEALTH_DIM, paddingTop: 2, paddingBottom: 2 }
  }, h("div", { style: { width: 30, height: 20, display: "flex", alignItems: "center", justifyContent: "center" } },
    h(PGlyph, { k: pg.glyph, size: 16, color: tab === pg.key ? "#5b4a8c" : HEALTH_DIM })),
  h("span", { style: { marginTop: 2 } }, pg.zh))));
  return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "linear-gradient(180deg,#f6f7f9 0%," + HEALTH_BG + " 40%," + HEALTH_BG + " 100%)" } },
    chrome,
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 16px 24px" } },
      body.length ? body : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: HEALTH_DIM } }, "这一页还是空的，点右上角刷一次")),
    nav);
}
// ============================================================
// 视频（仿 bilibili）—— 白天刷的那些（她 2026-08-29 拆成独立 app）
// 这个 app 最好的东西不是他看了什么，是【他发过的弹幕】：
// 短、脱口而出、没措辞，跟他在别处说话的样子可以完全不同。
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
function BiliView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(null);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const me = (data.me && typeof data.me === "object") ? data.me : {};
  const items = A(data.items).filter(x => x && typeof x === "object");
  const tabs = ["全部"].concat(A(data.tabs).filter(x => typeof x === "string").slice(0, 6));
  const cur = tabs[Math.min(tab, tabs.length - 1)] || "全部";
  const shown = cur === "全部" ? items : items.filter(x => x.tab === cur);
  const cover = i => BILI_COVERS[i % BILI_COVERS.length];
  const card = (v, i) => h("button", {
    key: i, onClick: () => setOpen({ v: v, i: i }), className: "text-left active:opacity-75",
    style: { background: "#fff", borderRadius: 10, overflow: "hidden", minWidth: 0 }
  }, h("div", { style: { position: "relative", aspectRatio: "16 / 10", background: "linear-gradient(140deg," + cover(i)[0] + "," + cover(i)[1] + ")" } },
    h("div", { style: { position: "absolute", left: 6, bottom: 6, right: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-end" } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.5)" } }, (v.views != null ? v.views + " 播放" : "")),
      v.duration ? h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "#fff", background: "rgba(0,0,0,.55)", borderRadius: 3, padding: "1px 5px" } }, v.duration) : null),
    A(v.myDanmaku).length ? h("span", { style: { position: "absolute", top: 6, left: 6, fontFamily: F_BODY, fontSize: 9.5, color: "#fff", background: "rgba(251,114,153,.92)", borderRadius: 4, padding: "2px 6px" } }, "发过弹幕") : null),
  h("div", { style: { padding: "8px 9px 11px" } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.45, color: BILI_INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.title || ""),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: BILI_DIM, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
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
        v.duration ? h("span", { style: { position: "absolute", right: 8, bottom: 8, fontFamily: F_BODY, fontSize: 10, color: "#fff", background: "rgba(0,0,0,.55)", borderRadius: 3, padding: "2px 6px" } }, v.duration) : null),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "14px 15px 24px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, lineHeight: 1.45, color: BILI_INK } }, v.title || ""),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: BILI_DIM, marginTop: 8 } },
          [v.views != null ? v.views + " 播放" : "", v.danmaku != null ? v.danmaku + " 弹幕" : "", v.tab].filter(Boolean).join(" · ")),
        h("div", { className: "flex items-center gap-2.5", style: { marginTop: 14, paddingTop: 13, paddingBottom: 13, borderTop: "1px solid #f0f1f2", borderBottom: "1px solid #f0f1f2" } },
          h("div", { style: { width: 34, height: 34, borderRadius: 99, flexShrink: 0, background: "linear-gradient(140deg," + BILI_PINK + "," + BILI_BLUE + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 15 } }, String(v.up || "?").trim().slice(0, 1)),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: BILI_INK } }, v.up || "")),
        v.desc ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.8, color: "#61666d", marginTop: 13 } }, v.desc) : null,
        A(v.myDanmaku).length ? h("div", { style: { marginTop: 18 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: BILI_PINK } }, "他发过的弹幕"),
          A(v.myDanmaku).map((dm, j) => h("div", {
            key: j, style: { fontFamily: F_BODY, fontSize: 13.5, color: BILI_INK, background: "rgba(251,114,153,.08)", border: "1px solid rgba(251,114,153,.24)", borderRadius: 999, padding: "7px 14px", marginTop: 9, display: "inline-block" }
          }, dm))) : null,
        v.thought ? h("div", { style: { marginTop: 18, background: "#f6f7f8", borderRadius: 12, padding: "13px 14px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: BILI_DIM } }, "看完他想的"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.85, color: "#3f4348", marginTop: 6 } }, v.thought)) : null,
        onPeek ? h("button", {
          onClick: () => onPeek({ tier: "quiet", label: "他看的视频", title: v.title, text: [v.up, A(v.myDanmaku).length ? "他发的弹幕：" + A(v.myDanmaku).join(" / ") : "", v.thought].filter(Boolean).join("｜") }),
          className: "w-full active:opacity-60",
          style: { marginTop: 20, padding: "12px 0", borderRadius: 12, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid #e3e5e7", color: "#61666d" }
        }, "转发给 TA · 他会知道你翻了手机") : null));
  })() : null;
  const head = h("div", { className: "shrink-0", style: { background: "#fff", paddingTop: safeTop(8) } },
    h("div", { className: "flex items-center gap-2.5 px-3 pb-2.5" },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 34, height: 34 } }, h(IArrow, { size: 18, color: BILI_INK })),
      h("div", { className: "flex-1 min-w-0 flex items-center", style: { height: 32, borderRadius: 99, background: "#f1f2f3", padding: "0 13px" } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: BILI_DIM } }, "搜索")),
      h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 34, height: 34 } }, h(IRefresh, { size: 17, color: BILI_INK }))),
    // 他自己的账号条：昵称 + 等级 + UID（她 2026-08-29 说找不到，原来只藏在搜索框占位里）
    (me.name || me.uid) ? h("div", { className: "flex items-center px-3 pb-2.5", style: { gap: 10 } },
      h("div", { style: { width: 34, height: 34, borderRadius: 99, flexShrink: 0, background: "linear-gradient(140deg," + BILI_PINK + "," + BILI_BLUE + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 15 } }, String(me.name || char.name || "?").trim().slice(0, 1)),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { className: "flex items-center", style: { gap: 6 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: BILI_INK } }, me.name || char.name),
          me.level ? h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10, color: "#fff", background: BILI_PINK, borderRadius: 5, padding: "2px 6px" } }, "LV" + me.level) : null),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: BILI_DIM, marginTop: 3 } },
          [me.uid ? "UID " + me.uid : "", me.fans != null ? me.fans + " 粉丝" : "", me.coins != null ? me.coins + " 硬币" : ""].filter(Boolean).join(" · ")))) : null,
    h("div", { className: "flex gap-1 px-3 pb-2 overflow-x-auto", style: { scrollbarWidth: "none" } }, tabs.map((tb, i) => h("button", {
      key: i, onClick: () => setTab(i), className: "shrink-0 active:opacity-60",
      style: { fontFamily: F_BODY, fontSize: 13, padding: "6px 12px", borderRadius: 999, color: i === tab ? BILI_PINK : "#61666d", background: i === tab ? "rgba(251,114,153,.10)" : "transparent", fontWeight: i === tab ? 600 : 400 }
    }, tb))));
  return h("div", { className: "h-full min-h-0 flex flex-col relative", style: { background: BILI_BG } }, head,
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "10px 9px 20px" } },
      shown.length ? h("div", { className: "grid grid-cols-2", style: { gap: 9 } }, shown.map(card))
        : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: BILI_DIM } }, "这个分区还没有内容")),
    detail);
}
// ============================================================
// 深夜台 —— 暗色、极简、不解释（她 2026-08-29 起的名，尺度照旧不动）
// ============================================================
function LateNightView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [open, setOpen] = useState(null);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const me = (data.me && typeof data.me === "object") ? data.me : {};
  const items = A(data.items).filter(x => x && typeof x === "object");
  const BG = "#0d0c0e", CARD = "#17151a", INK = "#e8e3e6", DIM = "rgba(232,227,230,.44)", HOT = "#c0566d";
  const row = (v, i) => h("button", {
    key: i, onClick: () => setOpen(v), className: "w-full text-left active:opacity-70",
    style: { display: "flex", gap: 12, padding: "13px 0", borderTop: i ? "1px solid rgba(232,227,230,.08)" : "none" }
  }, h("div", { style: { width: 112, height: 66, borderRadius: 8, flexShrink: 0, position: "relative", overflow: "hidden", background: "linear-gradient(140deg,#2a2129," + ["#3a2630", "#2b2733", "#33272a", "#262b33", "#332a26"][i % 5] + ")" } },
    h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" } },
      h("span", { style: { marginLeft: 3, borderLeft: "13px solid rgba(232,227,230,.5)", borderTop: "8px solid transparent", borderBottom: "8px solid transparent" } })),
    v.duration ? h("span", { style: { position: "absolute", right: 5, bottom: 5, fontFamily: F_BODY, fontSize: 9.5, color: "#fff", background: "rgba(0,0,0,.6)", borderRadius: 3, padding: "1px 5px" } }, v.duration) : null),
  h("div", { style: { flex: 1, minWidth: 0 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, lineHeight: 1.45, color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, v.title || ""),
    h("div", { className: "flex flex-wrap gap-1.5", style: { marginTop: 8 } }, A(v.tags).slice(0, 4).map((tg, j) => h("span", {
      key: j, style: { fontFamily: F_BODY, fontSize: 10, color: DIM, border: "1px solid rgba(232,227,230,.16)", borderRadius: 999, padding: "2px 8px" }
    }, tg))),
    v.views ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: DIM, marginTop: 7 } }, v.views) : null));
  const detail = open ? h("div", {
    className: "absolute inset-0 flex flex-col justify-end", style: { background: "rgba(0,0,0,.6)", zIndex: 30 }, onClick: () => setOpen(null)
  }, h("div", {
    onClick: e => e.stopPropagation(),
    style: { background: CARD, borderRadius: "20px 20px 0 0", maxHeight: "82%", overflowY: "auto", padding: "20px 20px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 20px)" }
  }, h("div", { className: "flex items-start justify-between gap-3" },
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: DIM } }, open.duration || ""),
    h("button", { onClick: () => setOpen(null), "aria-label": "关闭", className: "active:opacity-60", style: { fontSize: 15, color: DIM, padding: "0 4px" } }, "✕")),
  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, lineHeight: 1.45, color: INK, marginTop: 10 } }, open.title || ""),
  h("div", { className: "flex flex-wrap gap-1.5", style: { marginTop: 12 } }, A(open.tags).map((tg, j) => h("span", {
    key: j, style: { fontFamily: F_BODY, fontSize: 11, color: HOT, border: "1px solid rgba(192,86,109,.4)", borderRadius: 999, padding: "3px 10px" }
  }, tg))),
  open.thought ? h("div", { style: { marginTop: 18, borderLeft: "2px solid " + HOT, paddingLeft: 13, fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.95, color: "rgba(232,227,230,.86)" } }, open.thought) : null,
  onPeek ? h("button", {
    onClick: () => onPeek({ tier: "hidden", label: "深夜台", title: open.title, text: [A(open.tags).join(" / "), open.thought].filter(Boolean).join("｜") }),
    className: "w-full active:opacity-60",
    style: { marginTop: 22, padding: "13px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid rgba(192,86,109,.5)", color: HOT }
  }, "摆到 TA 面前 · 这是他藏起来的") : null)) : null;
  return h("div", { className: "h-full min-h-0 flex flex-col relative", style: { background: BG } },
    h("div", { className: "shrink-0 flex items-center justify-between px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: INK })),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, letterSpacing: ".08em", color: INK } }, "深夜台"),
      h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: INK }))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 18px 24px" } },
      (me.lastAt || me.note) ? h("div", { style: { padding: "10px 0 16px", borderBottom: "1px solid rgba(232,227,230,.08)", marginBottom: 4 } },
        (me.uid || me.lastAt) ? h("div", { className: "flex items-center justify-between" },
          h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, letterSpacing: ".14em", color: "rgba(232,227,230,.66)", border: "1px solid rgba(232,227,230,.18)", borderRadius: 6, padding: "3px 9px" } }, me.uid ? me.uid : "未登记"),
          me.lastAt ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: DIM } }, "上次 " + me.lastAt) : null) : null,
        me.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, color: "rgba(232,227,230,.62)", marginTop: 8 } }, me.note) : null) : null,
      items.length ? items.map(row) : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: DIM } }, "深夜台还是空的")),
    detail);
}
// ============================================================
// 广场（原「赞过」）—— 双列瀑布流图文社区
// 她 2026-08-29 说想做成某种社媒但没定；我选了图文社区而不是短视频，
// 理由：视频已经占了两个 app（视频 / 深夜台），再来一个短视频是重复；
// 而「点赞收藏」这个动作本来就最贴图文——他不会写下来，但他会点。
// 三页：广场（他赞过收藏过的）· 关注 · 我的（他自己发的）
// ============================================================
const PLAZA_RED = "#ff2e4d";
const PLAZA_BG = "#f7f7f8";
const PLAZA_INK = "#1f1f22";
const PLAZA_DIM = "#9b9ba3";
const PLAZA_COVERS = [
  ["#f4b8bf", "#fadde0"], ["#b9d4ef", "#dbe9f7"], ["#cfe0bd", "#e6efdc"],
  ["#eed9b0", "#f7ecd6"], ["#cfc4e6", "#e5dff2"], ["#b6dfd7", "#d9efeb"]
];
function PlazaView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [tab, setTab] = useState("feed");
  const [open, setOpen] = useState(null);
  const [chan, setChan] = useState(0);
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
    key: i, onClick: () => setOpen(it), className: "text-left active:opacity-75",
    style: { background: "#fff", borderRadius: 12, overflow: "hidden", minWidth: 0 }
  }, h("div", { style: { aspectRatio: "1 / " + (ratio || 1), background: "linear-gradient(150deg," + cover(it.cover)[0] + "," + cover(it.cover)[1] + ")" } }),
  h("div", { style: { padding: "9px 10px 11px" } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.5, color: PLAZA_INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, it.title || ""),
    h("div", { className: "flex items-center", style: { marginTop: 9, gap: 5 } },
      h("div", { style: { width: 17, height: 17, borderRadius: 99, flexShrink: 0, background: "linear-gradient(140deg," + cover(it.cover)[0] + "," + cover(it.cover)[1] + ")", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 9, color: "#6a6a72" } }, String(it.author || "?").trim().slice(0, 1)),
      h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 10.5, color: PLAZA_DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, it.author || ""),
      h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 10.5, color: it.act === "收藏" ? "#e8a33d" : PLAZA_RED } }, (it.act === "收藏" ? "★ " : "♥ ") + (it.likes != null ? it.likes : "")))));
  const detail = open ? h("div", {
    className: "absolute inset-0 flex flex-col justify-end", style: { background: "rgba(20,18,20,.44)", zIndex: 30 }, onClick: () => setOpen(null)
  }, h("div", {
    onClick: e => e.stopPropagation(),
    style: { background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "84%", overflowY: "auto", padding: "0 0 calc(env(safe-area-inset-bottom) * 0.4 + 20px)" }
  }, h("div", { style: { height: 138, background: "linear-gradient(150deg," + cover(open.cover)[0] + "," + cover(open.cover)[1] + ")", borderRadius: "20px 20px 0 0", position: "relative" } },
    h("button", { onClick: () => setOpen(null), "aria-label": "关闭", className: "active:opacity-60 flex items-center justify-center", style: { position: "absolute", right: 10, top: 10, width: 34, height: 34, fontSize: 17, color: "rgba(255,255,255,.92)", textShadow: "0 1px 4px rgba(0,0,0,.35)" } }, "✕")),
  h("div", { style: { padding: "16px 20px 0" } },
    h("div", { className: "flex items-center gap-2.5" },
      h("div", { style: { width: 30, height: 30, borderRadius: 99, flexShrink: 0, background: "linear-gradient(140deg,#ffd0d6," + PLAZA_RED + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 13 } }, String(open.author || "?").trim().slice(0, 1)),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#55555c" } }, open.author || ""),
      h("div", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 11.5, color: PLAZA_DIM } }, open.time || "")),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, lineHeight: 1.5, color: PLAZA_INK, marginTop: 14 } }, open.title || ""),
    open.excerpt ? h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.9, color: "#4b4b53", marginTop: 11 } }, open.excerpt) : null,
    A(open.tags).length ? h("div", { className: "flex flex-wrap gap-1.5", style: { marginTop: 14 } }, A(open.tags).map((tg, j) => h("span", {
      key: j, style: { fontFamily: F_BODY, fontSize: 11.5, color: "#5f7fb8", background: "#eef2f8", borderRadius: 999, padding: "4px 11px" }
    }, "#" + tg))) : null,
    h("div", { className: "flex items-center", style: { gap: 18, marginTop: 18, paddingTop: 14, borderTop: "1px solid #f1f1f4" } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: open.act !== "收藏" ? PLAZA_RED : "#b0b0b8" } }, "♥ " + (open.likes != null ? open.likes : "")),
      h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: open.act === "收藏" ? "#e8a33d" : "#b0b0b8" } }, "★ 收藏"),
      h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 12, color: PLAZA_DIM } }, open.act === "收藏" ? "他收藏了这条" : "他点了赞")),
    onPeek ? h("button", {
      onClick: () => onPeek(open._draft
        ? { tier: "hidden", label: "小红书草稿箱", title: open.title, text: [open.excerpt, open.savedAt].filter(Boolean).join("｜") }
        : { tier: "quiet", label: "他" + (open.act === "收藏" ? "收藏" : "赞") + "过的", title: open.title, text: [open.author, open.excerpt].filter(Boolean).join("｜") }),
      className: "w-full active:opacity-60",
      style: { marginTop: 18, padding: "12px 0", borderRadius: 12, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid #e6e6ea", color: "#55555c" }
    }, open._draft ? "摆到 TA 面前 · 这是他没发出去的" : "转发给 TA · 他会知道你翻了手机") : null))) : null;
  const followPage = h("div", { style: { padding: "4px 0" } },
    follows.length ? follows.map((f, i) => h("div", { key: i, className: "flex items-center gap-3", style: { background: "#fff", borderRadius: 14, padding: "14px 15px", marginBottom: 10 } },
      h("div", { style: { width: 42, height: 42, borderRadius: 99, flexShrink: 0, background: "linear-gradient(140deg," + cover(i)[0] + "," + cover(i)[1] + ")", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 17, color: "#5c5c64" } }, String(f.name || "?").trim().slice(0, 1)),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: PLAZA_INK } }, f.name || ""),
        f.desc ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, color: PLAZA_DIM, marginTop: 4 } }, f.desc) : null)))
      : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: PLAZA_DIM } }, "他谁也没关注"));
  // ── 「我的」：照小红书个人页（她 2026-08-29 给了参考稿）──
  // 大背景 + 头像 + 小红书号 + 三个数字 + 简介 + 药丸标签，
  // 底下 笔记 / 收藏 / 草稿 三个 tab；草稿带锁——那是他写了却没发的。
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
          kind === "draft" ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: "#a8a8b0" } }, "未发布") : null),
        h("div", { style: { padding: "9px 10px 11px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.5, color: PLAZA_INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, x.title || ""),
          A(x.tags).length ? h("div", { className: "flex flex-wrap", style: { gap: 5, marginTop: 7 } }, A(x.tags).slice(0, 3).map((tg, j) => h("span", {
            key: j, style: { fontFamily: F_BODY, fontSize: 10, color: "#5f7fb8", background: "#eef2f8", borderRadius: 999, padding: "2px 7px" }
          }, "#" + tg))) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: kind === "draft" ? "#c0554f" : PLAZA_DIM, marginTop: 7 } },
            kind === "draft" ? (x.savedAt || "没发出去") : [x.time, x.likes != null ? "♥ " + x.likes : ""].filter(Boolean).join(" · "))))))
    : h("div", { style: { padding: "44px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 12.5, color: PLAZA_DIM } },
        kind === "draft" ? "草稿箱是空的" : kind === "save" ? "他没收藏过什么" : "他一条也没发过");
  const mineTab = (k, label, n, lock) => h("button", {
    key: k, onClick: () => setMtab(k), className: "flex items-center active:opacity-60",
    style: { gap: 4, paddingBottom: 7, borderBottom: "2px solid " + (mtab === k ? PLAZA_RED : "transparent") }
  }, lock ? h("span", { style: { fontSize: 10, color: mtab === k ? PLAZA_INK : "#b0b0b8" } }, "🔒") : null,
  h("span", { style: { fontFamily: F_DISPLAY, fontSize: mtab === k ? 16 : 15, color: mtab === k ? PLAZA_INK : "#b0b0b8" } }, label),
  n ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: "#b0b0b8" } }, n) : null);
  const minePage = h("div", { style: { margin: "-10px -12px 0" } },
    // 顶部大背景卡
    h("div", { style: { position: "relative", background: "linear-gradient(150deg,#8f97a8,#c8ccd4 55%,#e7e3dd)", padding: "26px 20px 22px" } },
      h("div", { className: "flex items-center", style: { gap: 15 } },
        h("div", { style: { width: 74, height: 74, borderRadius: 99, flexShrink: 0, background: "linear-gradient(140deg,#ffd0d6," + PLAZA_RED + ")", border: "3px solid rgba(255,255,255,.85)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 30 } }, String(me.name || char.name || "?").trim().slice(0, 1)),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,.28)" } }, me.name || char.name),
          me.xhsId ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "rgba(255,255,255,.86)", marginTop: 5 } }, "小红书号：" + me.xhsId) : null)),
      h("div", { className: "flex", style: { gap: 26, marginTop: 18 } },
        [[me.following, "关注"], [me.followers, "粉丝"], [me.likes, "获赞与收藏"]].map(([n, l], i) => h("div", { key: i },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: "#fff" } }, n != null ? n : "--"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: "rgba(255,255,255,.82)", marginLeft: 5 } }, l)))),
      h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: "#fff", marginTop: 16 } }, me.bio || "这人没写简介"),
      me.tag ? h("span", { style: { display: "inline-block", marginTop: 12, fontFamily: F_BODY, fontSize: 12, color: "#fff", background: "rgba(255,255,255,.22)", borderRadius: 999, padding: "4px 12px" } }, me.tag) : null),
    // tab 条
    h("div", { style: { background: "#fff", borderRadius: "16px 16px 0 0", marginTop: -14, position: "relative", padding: "16px 18px 0" } },
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
      return list.length ? masonry(list) : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: PLAZA_DIM } }, c === "发现" ? "他还没赞过什么" : "这个频道底下没有");
    })() },
    { key: "follow", zh: "关注", glyph: "me", body: followPage },
    { key: "mine", zh: "我的", glyph: "notes", body: minePage }
  ];
  const page = PAGES.find(x => x.key === tab) || PAGES[0];
  // 顶栏照小红书：返回 · 居中的频道 tab（首页那页才有）· 刷新
  const chans = ["发现"].concat(A(data.tabs).filter(x => typeof x === "string").slice(0, 5));
  const topBar = h("div", { className: "shrink-0 flex items-center px-2 pb-1.5", style: { paddingTop: safeTop(10), background: "#fff" } },
    h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center shrink-0", style: { width: 36, height: 36 } }, h(IArrow, { size: 18, color: PLAZA_INK })),
    tab === "feed"
      ? h("div", { className: "flex-1 min-w-0 flex gap-3 overflow-x-auto justify-center", style: { scrollbarWidth: "none" } }, chans.map((c, i) => h("button", {
          key: i, onClick: () => setChan(i), className: "shrink-0 active:opacity-60",
          style: { fontFamily: F_DISPLAY, fontSize: i === chan ? 16 : 14, color: i === chan ? PLAZA_INK : "#b0b0b8", padding: "3px 2px", borderBottom: i === chan ? "2px solid " + PLAZA_RED : "2px solid transparent" }
        }, c)))
      : h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: PLAZA_INK } }, page.zh),
    h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center shrink-0", style: { width: 36, height: 36 } }, h(IRefresh, { size: 17, color: PLAZA_INK })));
  return h("div", { className: "h-full min-h-0 flex flex-col relative", style: { background: PLAZA_BG } }, topBar,
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "10px 12px 20px" } }, page.body),
    h("div", { className: "shrink-0 grid grid-cols-3", style: { padding: "5px 16px", paddingBottom: COMPOSER_PAD_BOTTOM, background: "#fff", borderTop: "1px solid #eeeef1" } },
      PAGES.map(pg => h("button", {
        key: pg.key, onClick: () => { setTab(pg.key); setOpen(null); },
        className: "flex flex-col items-center justify-center active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: 10.5, color: tab === pg.key ? PLAZA_RED : PLAZA_DIM, paddingTop: 2, paddingBottom: 2 }
      }, h("div", { style: { width: 30, height: 20, display: "flex", alignItems: "center", justifyContent: "center" } },
        h(PGlyph, { k: pg.glyph, size: 16, color: tab === pg.key ? PLAZA_RED : PLAZA_DIM })),
      h("span", { style: { marginTop: 2 } }, pg.zh)))),
    detail);
}
// ============================================================
// 日历 —— 月历格子 + 事项列表。推迟次数是这个 app 的重点：
// 一件推了四次的小事，比四件按时完成的大事更能说明这个人。
// ============================================================
function CalendarView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [open, setOpen] = useState(null);
  const [sel, setSel] = useState(null);
  const A = a => Array.isArray(a) ? a : [];
  const data = (d && typeof d === "object") ? d : {};
  const items = A(data.items).filter(x => x && typeof x === "object");
  const CAL_BG = "#f5f5f7", CAL_INK = "#1c1c1e", CAL_DIM = "#8e8e93", CAL_RED = "#ff3b30";
  const parse = v => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(v || "")); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  const dated = items.map(x => ({ x: x, at: parse(x.date) })).filter(r => r.at);
  // 月份：优先用数据里出现最多的那个月，没有就用今天
  const now = new Date();
  const tally = {};
  dated.forEach(r => { const k = r.at.y + "-" + r.at.m; tally[k] = (tally[k] || 0) + 1; });
  const topKey = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
  const cy = topKey ? +topKey.split("-")[0] : now.getFullYear();
  const cm = topKey ? +topKey.split("-")[1] : now.getMonth() + 1;
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
    }, h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 13.5, color: picked ? "#fff" : isToday(dd) ? CAL_RED : CAL_INK } }, dd),
    h("span", { style: { height: 5, display: "flex", gap: 2 } }, list.slice(0, 3).map((x, j) => h("span", {
      key: j, style: { width: 4, height: 4, borderRadius: 99, background: picked ? "rgba(255,255,255,.9)" : late(x) ? CAL_RED : x.done ? "#c7c7cc" : "#4a90d9" }
    })))));
  }
  const listFor = sel ? onDay(sel) : items;
  const row = (x, i) => h("button", {
    key: i, onClick: () => setOpen(x), className: "w-full text-left active:opacity-60",
    style: { display: "flex", gap: 12, background: "#fff", borderRadius: 14, padding: "14px 15px", marginBottom: 9 }
  }, h("span", { style: { width: 8, height: 8, borderRadius: 99, marginTop: 6, flexShrink: 0, background: x.done ? "#c7c7cc" : late(x) ? CAL_RED : "#4a90d9" } }),
  h("div", { style: { flex: 1, minWidth: 0 } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, lineHeight: 1.45, color: x.done ? CAL_DIM : CAL_INK, textDecoration: x.done ? "line-through" : "none" } }, x.title || ""),
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: late(x) ? CAL_RED : CAL_DIM, marginTop: 5 } },
      [calDay(x.date), x.time, x.kind, x.who, Number(x.postponed) > 0 ? "推迟 " + x.postponed + " 次" : (x.overdue ? "早该做了" : "")].filter(Boolean).join(" · "))));
  const detail = open ? h("div", {
    className: "absolute inset-0 flex flex-col justify-end", style: { background: "rgba(20,20,22,.4)", zIndex: 30 }, onClick: () => setOpen(null)
  }, h("div", {
    onClick: e => e.stopPropagation(),
    style: { background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 20px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 20px)" }
  }, h("div", { className: "flex items-start justify-between gap-3" },
    h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: CAL_DIM } }, [open.kind, open.date, open.time].filter(Boolean).join(" · ")),
    h("button", { onClick: () => setOpen(null), "aria-label": "关闭", className: "active:opacity-60", style: { fontSize: 15, color: CAL_DIM, padding: "0 4px" } }, "✕")),
  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, lineHeight: 1.4, color: CAL_INK, marginTop: 10 } }, open.title || ""),
  open.who ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: CAL_DIM, marginTop: 7 } }, "和 " + open.who) : null,
  Number(open.postponed) > 0 ? h("div", { style: { marginTop: 14, background: "rgba(255,59,48,.08)", borderRadius: 12, padding: "12px 14px", fontFamily: F_BODY, fontSize: 13.5, color: "#c0392b" } }, "已经往后推了 " + open.postponed + " 次")
    : open.overdue ? h("div", { style: { marginTop: 14, background: "rgba(255,59,48,.08)", borderRadius: 12, padding: "12px 14px", fontFamily: F_BODY, fontSize: 13.5, color: "#c0392b" } }, "日子早过了，他还没做。") : null,
  open.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.9, color: "#4b4b53", marginTop: 13 } }, open.note) : null,
  onPeek ? h("button", {
    onClick: () => onPeek({ tier: "quiet", label: open.kind === "提醒" ? "提醒事项" : "日历", title: open.title, text: [open.date, open.who ? "和 " + open.who : "", open.note, Number(open.postponed) > 0 ? "推迟过 " + open.postponed + " 次" : (open.overdue ? "日子早过了" : "")].filter(Boolean).join("｜") }),
    className: "w-full active:opacity-60",
    style: { marginTop: 18, padding: "12px 0", borderRadius: 12, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid #e6e6ea", color: "#55555c" }
  }, "转发给 TA · 他会知道你翻了手机") : null)) : null;
  return h("div", { className: "h-full min-h-0 flex flex-col relative", style: { background: CAL_BG } },
    h("div", { className: "shrink-0 flex items-center justify-between px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: CAL_INK })),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: CAL_INK } }, data.monthLabel || (cm + "月")),
      h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: CAL_INK }))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 14px 22px" } },
      h("div", { style: { background: "#fff", borderRadius: 18, padding: "14px 12px 10px", marginBottom: 16 } },
        h("div", { className: "grid grid-cols-7", style: { marginBottom: 6 } }, ["一", "二", "三", "四", "五", "六", "日"].map((w, i) => h("div", {
          key: i, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 11, color: CAL_DIM }
        }, w))),
        h("div", { className: "grid grid-cols-7", style: { gap: 2 } }, cells)),
      h("div", { className: "flex items-baseline justify-between", style: { padding: "0 4px 10px" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: CAL_INK } }, sel ? cm + "月" + sel + "日" : "全部安排"),
        sel ? h("button", { onClick: () => setSel(null), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: "#4a90d9" } }, "看全部") : null),
      listFor.length ? listFor.map(row)
        : h("div", { style: { padding: "40px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: CAL_DIM } }, sel ? "这天没有安排" : "日历上还没有东西")),
    detail);
}
// ============================================================
// 便签 —— 备忘录和录音合成一个（她 2026-08-29）
// 它们本来就是同一件事的两种载体：没人看的时候他留给自己的东西。
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
function StickyView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [open, setOpen] = useState(null);
  const A = a => Array.isArray(a) ? a : [];
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
      key: i, onClick: () => setOpen(it), className: "text-left active:opacity-80",
      style: {
        background: c.bg, borderRadius: 3, padding: "13px 13px 15px", minWidth: 0,
        transform: "rotate(" + tilt(i) + "deg)",
        boxShadow: "0 6px 14px rgba(70,60,40,.13), inset 0 -14px 18px -14px " + c.edge
      }
    }, h("div", { className: "flex items-center", style: { gap: 5, marginBottom: 7 } },
      voice ? h(PGlyph, { k: "mic", size: 11, color: c.ink }) : null,
      h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: c.ink, opacity: .6 } }, (voice && it.duration ? it.duration + " · " : "") + (it.time || ""))),
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, lineHeight: 1.45, color: c.ink, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, it.title || ""),
    it.body ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.65, color: c.ink, opacity: .74, marginTop: 6, display: "-webkit-box", WebkitLineClamp: voice ? 3 : 5, WebkitBoxOrient: "vertical", overflow: "hidden" } }, it.body) : null,
    voice ? wave(c.ink, 20) : null);
  };
  const cols = [[], []];
  items.forEach((it, i) => cols[i % 2].push(note(it, i)));
  const detail = open ? (function () {
    const c = pal(open.color);
    const voice = open.kind === "voice";
    return h("div", { className: "absolute inset-0 flex flex-col justify-center px-5", style: { background: "rgba(60,52,38,.36)", zIndex: 30 }, onClick: () => setOpen(null) },
      h("div", { onClick: e => e.stopPropagation(), style: { background: c.bg, borderRadius: 4, padding: "22px 20px 24px", maxHeight: "80%", overflowY: "auto", boxShadow: "0 20px 44px rgba(50,42,28,.32)" } },
        h("div", { className: "flex items-center justify-between", style: { marginBottom: 12 } },
          h("div", { className: "flex items-center", style: { gap: 6 } },
            voice ? h(PGlyph, { k: "mic", size: 13, color: c.ink }) : null,
            h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: c.ink, opacity: .62 } }, (voice ? "录音 " + (open.duration || "") + " · " : "") + (open.time || ""))),
          h("button", { onClick: () => setOpen(null), "aria-label": "关闭", className: "active:opacity-60", style: { fontSize: 15, color: c.ink, opacity: .6, padding: "0 4px" } }, "✕")),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, lineHeight: 1.45, color: c.ink } }, open.title || ""),
        voice ? wave(c.ink, 34) : null,
        open.body ? h("div", { style: { fontFamily: F_BODY, fontSize: 15, lineHeight: 1.95, color: c.ink, marginTop: 14, whiteSpace: "pre-wrap", fontStyle: voice ? "italic" : "normal" } }, open.body) : null,
        onPeek ? h("button", {
          onClick: () => onPeek({ tier: "quiet", label: voice ? "他录的一条" : "他的便签", title: open.title, text: open.body }),
          className: "w-full active:opacity-60",
          style: { marginTop: 20, padding: "12px 0", borderRadius: 10, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid " + c.edge, color: c.ink }
        }, "转发给 TA · 他会知道你翻了手机") : null));
  })() : null;
  return h("div", { className: "h-full min-h-0 flex flex-col relative", style: { background: STICKY_BG } },
    h("div", { className: "shrink-0 flex items-center justify-between px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: "#4a4438" })),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#4a4438" } }, "便签"),
      h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: "#4a4438" }))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 14px 26px" } },
      items.length
        ? h("div", { className: "grid grid-cols-2", style: { gap: 13, alignItems: "start" } },
            cols.map((col, ci) => h("div", { key: ci, style: { display: "flex", flexDirection: "column", gap: 13 } }, col)))
        : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: "#a09884" } }, "还没有便签，点右上角刷一次")),
    detail);
}
// ============================================================
// 剪贴板 —— 一叠复制过的纸条。最重要的不是内容，是【发没发出去】。
// 没发出去的那条单独一档：纸条压在最上面、红边、单独标出来。
// ============================================================
function ClipView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [open, setOpen] = useState(null);
  const A = a => Array.isArray(a) ? a : [];
  const items = A((d && d.items)).filter(x => x && typeof x === "object");
  const held = items.filter(x => x.sent === false);
  const sent = items.filter(x => x.sent !== false);
  const BG = "#1a1a1d", CARD = "#252529", INK = "#e9e9ec", DIM = "rgba(233,233,236,.44)", HOT = "#e0736b";
  const slip = (it, i, isHeld) => h("button", {
    key: i, onClick: () => setOpen(it), className: "w-full text-left active:opacity-75",
    style: {
      background: CARD, borderRadius: 12, padding: "15px 16px", marginBottom: 10,
      borderLeft: isHeld ? "3px solid " + HOT : "3px solid rgba(233,233,236,.14)"
    }
  }, h("div", {
    style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.75, color: INK, display: "-webkit-box", WebkitLineClamp: isHeld ? 4 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }
  }, it.text || ""),
  h("div", { className: "flex items-center", style: { gap: 7, marginTop: 10 } },
    it.from ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: DIM, border: "1px solid rgba(233,233,236,.16)", borderRadius: 6, padding: "2px 7px" } }, it.from) : null,
    h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: DIM } }, it.time || ""),
    h("span", { style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 10.5, color: isHeld ? HOT : DIM } }, isHeld ? "一直没发出去" : "已发出")));
  const detail = open ? (function () {
    const isHeld = open.sent === false;
    return h("div", { className: "absolute inset-0 flex flex-col justify-end", style: { background: "rgba(0,0,0,.55)", zIndex: 30 }, onClick: () => setOpen(null) },
      h("div", { onClick: e => e.stopPropagation(), style: { background: CARD, borderRadius: "20px 20px 0 0", padding: "20px 20px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 20px)", maxHeight: "82%", overflowY: "auto", borderTop: isHeld ? "2px solid " + HOT : "none" } },
        h("div", { className: "flex items-center justify-between gap-3" },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: isHeld ? HOT : DIM } }, [open.from, open.time, isHeld ? "复制了，一直没发出去" : "已发出"].filter(Boolean).join(" · ")),
          h("button", { onClick: () => setOpen(null), "aria-label": "关闭", className: "active:opacity-60", style: { fontSize: 15, color: DIM, padding: "0 4px" } }, "✕")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 16, lineHeight: 2, color: INK, marginTop: 16, whiteSpace: "pre-wrap" } }, open.text || ""),
        onPeek ? h("button", {
          onClick: () => onPeek({ tier: isHeld ? "hidden" : "quiet", label: isHeld ? "剪贴板里没发出去的一段" : "剪贴板", title: open.from || "", text: open.text }),
          className: "w-full active:opacity-60",
          style: { marginTop: 22, padding: "13px 0", borderRadius: 12, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid " + (isHeld ? "rgba(224,115,107,.5)" : "rgba(233,233,236,.2)"), color: isHeld ? HOT : INK }
        }, isHeld ? "摆到 TA 面前 · 这是他没发出去的" : "转发给 TA · 他会知道你翻了手机") : null));
  })() : null;
  const sec = (title, list, isHeld) => list.length ? h("section", { key: title },
    h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10, letterSpacing: ".18em", color: isHeld ? HOT : DIM, padding: "4px 2px 9px" } }, title),
    list.map((x, i) => slip(x, i, isHeld))) : null;
  return h("div", { className: "h-full min-h-0 flex flex-col relative", style: { background: BG } },
    h("div", { className: "shrink-0 flex items-center justify-between px-4 pb-2", style: { paddingTop: safeTop(10) } },
      h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: INK })),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: INK } }, "剪贴板"),
      h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: INK }))),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 16px 24px" } },
      items.length ? [sec("差一点就发出去", held, true), sec("复制过的", sent, false)]
        : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: DIM } }, "剪贴板是空的")),
    detail);
}
// ============================================================
// 浏览器 —— 仿真浏览器（她 2026-08-29 点名）
// 四页：标签页 / 搜索 / 书签 / 无痕
// 这个 app 的两个爆点：
//   ① 一堆没关的标签页是这个人脑子的横截面——尤其那个开了很久、他自己也说不清
//      为什么不关的；
//   ② 搜索词比访问过的网页更暴露人：人在搜索框里是不修饰的。
// 无痕那一页整个走 hidden 档：那是他专门开了不留记录的。
// ============================================================
const BR_BG = "#f2f2f5";
const BR_INK = "#1c1c1e";
const BR_DIM = "#8e8e93";
const BR_BLUE = "#2f6fdb";
const BR_COVERS = [["#cfd9e8", "#e6ecf5"], ["#e8d7cf", "#f4e9e3"], ["#d3e4d6", "#e8f1ea"],
  ["#e5dbef", "#f1ebf7"], ["#e9e3cc", "#f4f0e2"], ["#cfe3e8", "#e6f0f3"]];
function BrowserView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [tab, setTab] = useState("tabs");
  const [open, setOpen] = useState(null);
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
  const peekBtn = (tier, label, title, text) => onPeek ? h("button", {
    onClick: e => { e.stopPropagation(); onPeek({ tier, label, title, text }); },
    className: "w-full active:opacity-60",
    style: { marginTop: 18, padding: "12px 0", borderRadius: 12, fontFamily: F_BODY, fontSize: 12.5,
      border: "1px solid " + (tier === "hidden" ? "rgba(200,80,70,.42)" : "#e2e2e7"), color: tier === "hidden" ? "#b6473c" : "#55555c" }
  }, tier === "hidden" ? "摆到 TA 面前 · 这是他没打算留痕的" : "转发给 TA · 他会知道你翻了手机") : null;
  // ── 标签页：卡片网格，仿 Safari 那个标签墙 ──
  const tabCard = (x, i, isPriv) => h("button", {
    key: i, onClick: () => setOpen({ ...x, _priv: isPriv }), className: "text-left active:opacity-75",
    style: { background: isPriv ? "#26262b" : "#fff", borderRadius: 13, overflow: "hidden", minWidth: 0,
      border: x.pinned ? "1.5px solid " + BR_BLUE : "1px solid " + (isPriv ? "#33333a" : "#e8e8ed") }
  }, h("div", { style: { height: 84, position: "relative", background: isPriv ? "linear-gradient(150deg,#33333c,#22222a)" : "linear-gradient(150deg," + cov(x.cover != null ? x.cover : i)[0] + "," + cov(x.cover != null ? x.cover : i)[1] + ")" } },
    x.pinned ? h("span", { style: { position: "absolute", left: 7, top: 7, fontFamily: F_BODY, fontSize: 9.5, color: "#fff", background: BR_BLUE, borderRadius: 5, padding: "2px 7px" } }, "钉住") : null,
    x.age ? h("span", { style: { position: "absolute", right: 7, bottom: 7, fontFamily: F_BODY, fontSize: 9.5, color: isPriv ? "rgba(255,255,255,.7)" : "rgba(40,40,50,.6)", background: isPriv ? "rgba(0,0,0,.4)" : "rgba(255,255,255,.72)", borderRadius: 5, padding: "2px 7px" } }, x.age) : null),
  h("div", { style: { padding: "9px 10px 11px" } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.5, color: isPriv ? "#e6e6ea" : BR_INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, x.title || ""),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: isPriv ? "rgba(230,230,234,.5)" : BR_DIM, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.site || "")));
  const tabsPage = tabs.length
    ? h("div", { className: "grid grid-cols-2", style: { gap: 11, alignItems: "start" } }, tabs.map((x, i) => tabCard(x, i, false)))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: BR_DIM } }, "一个标签页都没开着");
  // ── 搜索记录：按时间列，搜索框的样子 ──
  const searchPage = searches.length ? h("div", { style: { background: "#fff", borderRadius: 14, overflow: "hidden" } },
    searches.map((x, i) => h("button", {
      key: i, onClick: () => setOpen({ title: x.q, site: x.site, gist: "", _search: true, time: x.time, results: x.results, opened: x.opened }),
      className: "w-full text-left active:opacity-60 flex items-center",
      style: { gap: 11, padding: "13px 14px", borderTop: i ? "1px solid #f1f1f4" : "none" }
    }, h("span", { "aria-hidden": "true", style: { width: 26, height: 26, borderRadius: 99, flexShrink: 0, background: "#f0f0f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: BR_DIM } }, "⌕"),
    h("div", { className: "flex-1 min-w-0" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.5, color: BR_INK, wordBreak: "break-word" } }, x.q || ""),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: BR_DIM, marginTop: 4 } }, [x.time, x.site].filter(Boolean).join(" · "))))))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: BR_DIM } }, "没有搜索记录");
  // ── 书签：文件夹分组 ──
  const markPage = marks.length ? h("div", null, marks.map((f, i) => h("div", { key: i, style: { marginBottom: 14 } },
    h("div", { className: "flex items-center", style: { gap: 7, padding: "2px 4px 9px" } },
      h("span", { "aria-hidden": "true", style: { width: 15, height: 12, borderRadius: "2px 4px 4px 4px", background: "#f0c264", flexShrink: 0 } }),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: BR_INK } }, f.name || ""),
      h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: BR_DIM } }, A(f.items).length + " 条")),
    h("div", { style: { background: "#fff", borderRadius: 14, overflow: "hidden" } },
      A(f.items).map((x, j) => h("button", {
        key: j, onClick: () => setOpen({ ...x, _mark: f.name }),
        className: "w-full text-left active:opacity-60",
        style: { padding: "12px 14px", borderTop: j ? "1px solid #f1f1f4" : "none" }
      }, h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5, color: BR_INK } }, x.title || ""),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: BR_DIM, marginTop: 4 } }, x.site || "")))))))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: BR_DIM } }, "还没有书签");
  const privPage = h("div", null,
    h("div", { style: { background: "#26262b", borderRadius: 14, padding: "15px 16px", marginBottom: 14 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: "#e6e6ea" } }, "无痕浏览"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.7, color: "rgba(230,230,234,.55)", marginTop: 6 } }, "他专门开了不留记录的那几页。关掉就没了——只是还没关。")),
    priv.length ? h("div", { className: "grid grid-cols-2", style: { gap: 11, alignItems: "start" } }, priv.map((x, i) => tabCard(x, i, true)))
      : h("div", { style: { padding: "44px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: BR_DIM } }, "这会儿没有无痕页"));
  // 搜索记录点进去 = 那一次搜索的【结果页】。
  // 「搜了什么」只有一半；另一半是【他点开了哪一条】——那才是他真正想知道的东西。
  const searchPage2 = open && open._search ? (function () {
    const rs = A(open.results).filter(x => x && typeof x === "object");
    // 结果数不问模型要：拿搜索词算一个稳定的数，每次进来都一样。
    // 它只是页面上的装饰，不该为它多花一次调用，更不该每次刷新跳一个数。
    const total = 12000 + phoneStableHash(open.title || "") % 880000;
    const shown = total.toLocaleString("en-US");
    return h("div", { className: "absolute inset-0 flex flex-col", style: { background: "#fff", zIndex: 30 } },
      h("div", { className: "shrink-0", style: { paddingTop: safeTop(8), borderBottom: "1px solid #ececf0" } },
        h("div", { className: "flex items-start px-3 pb-3", style: { gap: 6 } },
          h("button", { onClick: () => setOpen(null), "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center shrink-0", style: { width: 40, height: 40, marginTop: -4 } }, h(IArrow, { size: 19, color: BR_INK })),
          h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: 18, lineHeight: 1.45, color: BR_INK, wordBreak: "break-word", paddingTop: 4, paddingRight: 8 } }, open.title || ""))),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: COMPOSER_PAD_BOTTOM, background: "#fafafc" } },
        h("div", { className: "flex items-center", style: { gap: 11, padding: "20px 0 10px" } },
          h("span", { "aria-hidden": "true", style: { fontSize: 17, color: BR_DIM } }, "⌕"),
          h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 15, color: BR_INK, wordBreak: "break-word" } }, open.title || "")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#a8a8b0", paddingBottom: 16, borderBottom: "1px solid #ececf0" } },
          "找到约 " + shown + " 条结果" + (open.time ? "　|　搜索于 " + open.time : "")),
        rs.length ? rs.map((r, i) => {
          const src = String(r.source || "").trim();
          const isOpened = !!r.opened || (open.opened && String(open.opened) === src);
          return h("div", { key: i, style: { padding: "18px 0", borderBottom: i === rs.length - 1 ? "none" : "1px solid #ececf0" } },
            h("div", { className: "flex items-center", style: { gap: 9, marginBottom: 8 } },
              h("span", {
                "aria-hidden": "true",
                style: { width: 22, height: 22, borderRadius: 99, flexShrink: 0, background: "#efeff3", color: "#7a7a84", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: 11 }
              }, src.slice(0, 1) || "?"),
              h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#6b6b74", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, src),
              isOpened ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#c4553f", background: "rgba(196,85,63,.1)", borderRadius: 99, padding: "2px 8px", flexShrink: 0 } }, "他点开了这条") : null),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, lineHeight: 1.45, color: "#1a4fbd", wordBreak: "break-word" } }, String(r.title || "")),
            r.excerpt ? h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.8, color: "#8b8b93", marginTop: 7, wordBreak: "break-word" } }, String(r.excerpt)) : null);
        }) : h("div", { style: { padding: "50px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: BR_DIM, lineHeight: 1.9 } },
          "这条搜索记录里没存下结果。\n重新推演一次浏览器就有了。"),
        h("div", { style: { paddingTop: 18 } },
          peekBtn("quiet", "他搜过的", open.title,
            [open.time, rs.length ? "他翻到的：" + rs.map(r => String(r.title || "")).filter(Boolean).slice(0, 3).join(" / ") : ""].filter(Boolean).join("｜")))));
  })() : null;
  const detail = open && !open._search ? (function () {
    const isPriv = !!open._priv;
    return h("div", { className: "absolute inset-0 flex flex-col justify-end", style: { background: "rgba(20,20,24,.42)", zIndex: 30 }, onClick: () => setOpen(null) },
      h("div", { onClick: e => e.stopPropagation(),
        style: { background: isPriv ? "#26262b" : "#fff", borderRadius: "20px 20px 0 0", maxHeight: "82%", overflowY: "auto", padding: "18px 20px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 20px)" } },
        h("div", { className: "flex items-center justify-between", style: { gap: 10 } },
          h("div", { className: "flex-1 min-w-0 flex items-center", style: { gap: 8, height: 34, borderRadius: 10, background: isPriv ? "#33333a" : "#f0f0f4", padding: "0 12px" } },
            h("span", { "aria-hidden": "true", style: { fontSize: 11, color: isPriv ? "rgba(230,230,234,.55)" : BR_DIM } }, open._search ? "⌕" : "🔒"),
            h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 12, color: isPriv ? "rgba(230,230,234,.7)" : "#55555c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, open.site || (open._search ? "搜索" : ""))),
          h("button", { onClick: () => setOpen(null), "aria-label": "关闭", className: "active:opacity-60", style: { fontSize: 15, color: isPriv ? "rgba(230,230,234,.6)" : BR_DIM, padding: "0 4px" } }, "✕")),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, lineHeight: 1.5, color: isPriv ? "#e6e6ea" : BR_INK, marginTop: 16, wordBreak: "break-word" } }, open.title || ""),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: isPriv ? "rgba(230,230,234,.5)" : BR_DIM, marginTop: 8 } },
          [open.time, open.age, open._mark ? "书签 · " + open._mark : "", open.pinned ? "钉住的" : ""].filter(Boolean).join(" · ")),
        open.gist ? h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.95, color: isPriv ? "rgba(230,230,234,.86)" : "#4b4b53", marginTop: 14 } }, open.gist) : null,
        peekBtn(isPriv ? "hidden" : "quiet",
          isPriv ? "他的无痕标签页" : open._search ? "他搜过的" : open._mark ? "他的书签" : "他没关的标签页",
          open.title, [open.site, open.gist, open.age].filter(Boolean).join("｜"))));
  })() : null;
  const PAGES = [
    { key: "tabs", zh: "标签页", glyph: "browser", body: tabsPage, badge: tabs.length },
    { key: "search", zh: "搜索", glyph: "notes", body: searchPage, badge: searches.length },
    { key: "marks", zh: "书签", glyph: "reading", body: markPage },
    { key: "priv", zh: "无痕", glyph: "latenight", body: privPage, badge: priv.length }
  ];
  const page = PAGES.find(x => x.key === tab) || PAGES[0];
  return h("div", { className: "h-full min-h-0 flex flex-col relative", style: { background: BR_BG } },
    h("div", { className: "shrink-0", style: { paddingTop: safeTop(10) } },
      h("div", { className: "flex items-center px-3 pb-2", style: { gap: 9 } },
        h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center shrink-0", style: { width: 36, height: 36 } }, h(IArrow, { size: 18, color: BR_INK })),
        // 地址栏：真浏览器的样子
        h("div", { className: "flex-1 min-w-0 flex items-center", style: { gap: 7, height: 34, borderRadius: 11, background: "#e6e6ea", padding: "0 12px" } },
          h("span", { "aria-hidden": "true", style: { fontSize: 10.5, color: BR_DIM } }, "🔒"),
          h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 12.5, color: "#55555c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
            me.name ? me.name + (me.uid ? " · " + me.uid : "") : (char.remark || char.name) + " 的浏览器")),
        h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center shrink-0", style: { width: 36, height: 36 } }, h(IRefresh, { size: 17, color: BR_INK }))),
      h("div", { className: "flex px-3 pb-2", style: { gap: 4 } }, PAGES.map(pg => h("button", {
        key: pg.key, onClick: () => { setTab(pg.key); setOpen(null); }, className: "flex-1 active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: 12.5, padding: "7px 4px", borderRadius: 9,
          background: tab === pg.key ? "#fff" : "transparent",
          color: tab === pg.key ? (pg.key === "priv" ? "#b6473c" : BR_INK) : BR_DIM,
          boxShadow: tab === pg.key ? "0 1px 4px rgba(30,30,40,.10)" : "none" }
      }, pg.zh + (pg.badge ? " " + pg.badge : "")))) ),
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 13px 22px" } }, page.body),
    searchPage2, detail);
}
// ============================================================
// 电话 —— 通话 / 短信 / 信箱 / 联系人（她 2026-08-29 拍板留下并重做）
// 这个 app 真正有东西的是【没接通的那些】：谁打来他不接、他打给谁一直打不通、
// 深夜那通只有几十秒的。每一条都带他自己的想法。
// 短信单独一页，而且和微信收发的东西**完全不是一回事**——那条分界写在提示词里，
// 界面上也用「通知/人」两种样式把它显出来。
// ============================================================
const CALL_BG = "#f2f2f7";
const CALL_INK = "#1c1c1e";
const CALL_DIM = "#8e8e93";
const CALL_BLUE = "#0a84ff";
const CALL_RED = "#ff3b30";
function PhoneCallsView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [tab, setTab] = useState("calls");
  const [open, setOpen] = useState(null);
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
  const peekBtn = (tier, label, title, text) => onPeek ? h("button", {
    onClick: e => { e.stopPropagation(); onPeek({ tier, label, title, text }); },
    className: "w-full active:opacity-60",
    style: { marginTop: 18, padding: "12px 0", borderRadius: 12, fontFamily: F_BODY, fontSize: 12.5,
      border: "1px solid " + (tier === "hidden" ? "rgba(200,80,70,.42)" : "#e2e2e7"), color: tier === "hidden" ? "#b6473c" : "#55555c" }
  }, tier === "hidden" ? "摆到 TA 面前 · 这是他藏起来的" : "转发给 TA · 他会知道你翻了手机") : null;
  const groupCard = kids => h("div", { style: { background: "#fff", borderRadius: 14, overflow: "hidden" } }, kids);
  const secLabel = txt => h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: CALL_DIM, padding: "14px 4px 8px" } }, txt);
  // ── 通话记录：iOS 那种列表，未接标红 ──
  const callRow = (x, i) => {
    const missed = x.answered === false;
    const isIn = x.dir === "in";
    return h("button", {
      key: i, onClick: () => setOpen({ kind: "call", x: x }),
      className: "w-full text-left active:opacity-60 flex items-center",
      style: { gap: 12, padding: "12px 14px", borderTop: i ? "1px solid #f1f1f4" : "none" }
    }, h("span", { "aria-hidden": "true", style: { width: 26, flexShrink: 0, textAlign: "center", fontSize: 15, color: missed ? CALL_RED : CALL_DIM } }, isIn ? "↙" : "↗"),
    h("div", { className: "flex-1 min-w-0" },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: missed ? CALL_RED : CALL_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.name || x.number || "陌生号码"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: CALL_DIM, marginTop: 3 } },
        [isIn ? "来电" : "拨出", missed ? "未接通" : (x.duration || "")].filter(Boolean).join(" · "))),
    h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 12, color: CALL_DIM } }, x.time || ""));
  };
  const callsPage = calls.length ? h("div", null,
    missedN ? h("div", { style: { background: "rgba(255,59,48,.08)", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontFamily: F_BODY, fontSize: 12.5, color: "#c0392b" } },
      "这周有 " + missedN + " 通没接通") : null,
    groupCard(calls.map(callRow)))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: CALL_DIM } }, "没有通话记录");
  // ── 短信：通知类和人分开画 ──
  const smsRow = (x, i) => {
    const isNotice = x.kind !== "人";
    return h("button", {
      key: i, onClick: () => setOpen({ kind: "sms", x: x }),
      className: "w-full text-left active:opacity-60 flex items-start",
      style: { gap: 11, padding: "13px 14px", borderTop: i ? "1px solid #f1f1f4" : "none" }
    }, h("div", { style: { width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      background: isNotice ? "#eef0f4" : "#dcefe4", color: isNotice ? "#7b828c" : "#3f7a58", fontFamily: F_DISPLAY, fontSize: 14 } },
      isNotice ? "#" : String(x.name || "?").trim().slice(0, 1)),
    h("div", { className: "flex-1 min-w-0" },
      h("div", { className: "flex items-center", style: { gap: 6 } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: CALL_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.name || x.number || ""),
        x.unread ? h("span", { style: { width: 7, height: 7, borderRadius: 99, background: CALL_BLUE, flexShrink: 0 } }) : null),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: CALL_DIM, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } },
        ((A(x.msgs)[A(x.msgs).length - 1] || {}).text) || "")),
    h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 11, color: CALL_DIM } }, x.time || ""));
  };
  const smsPage = sms.length ? h("div", null,
    h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.7, color: CALL_DIM, padding: "2px 4px 11px" } },
      "短信里多半不是人——验证码、账目、催缴、送货、骗子。熟人出现在这儿，总有个理由。"),
    groupCard(sms.map(smsRow)))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: CALL_DIM } }, "没有短信");
  // ── 语音信箱 ──
  const vmPage = vm.length ? h("div", null,
    unheardN ? h("div", { style: { background: "rgba(10,132,255,.08)", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontFamily: F_BODY, fontSize: 12.5, color: "#1a5fb4" } },
      "有 " + unheardN + " 条他一直没听") : null,
    vm.map((x, i) => h("button", {
      key: i, onClick: () => setOpen({ kind: "vm", x: x }),
      className: "w-full text-left active:opacity-60",
      style: { background: "#fff", borderRadius: 14, padding: "15px 16px", marginBottom: 10, borderLeft: x.heard === false ? "3px solid " + CALL_BLUE : "3px solid transparent" }
    }, h("div", { className: "flex items-center justify-between", style: { gap: 10 } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: CALL_INK } }, x.from || ""),
      h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: CALL_DIM } }, [x.time, x.duration].filter(Boolean).join(" · "))),
    x.transcript ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8, color: "#5b5b62", marginTop: 8, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } }, x.transcript) : null,
    x.heard === false ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: CALL_BLUE, marginTop: 8 } }, "未听") : null)))
    : h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: CALL_DIM } }, "信箱是空的");
  // ── 联系人 + 拦截 ──
  const peoplePage = h("div", null,
    me.number ? h("div", { style: { background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 14 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: CALL_DIM } }, "他的号码"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: CALL_INK, marginTop: 5 } }, me.number)) : null,
    freq.length ? h("div", null, secLabel("常联系"),
      groupCard(freq.map((x, i) => h("div", { key: i, style: { padding: "13px 14px", borderTop: i ? "1px solid #f1f1f4" : "none" } },
        h("div", { className: "flex items-baseline justify-between", style: { gap: 10 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: CALL_INK } }, x.name || ""),
          x.count != null ? h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: CALL_DIM } }, x.count + " 通") : null),
        x.why ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: CALL_DIM, marginTop: 5 } }, x.why) : null)))) : null,
    blocked.length ? h("div", null, secLabel("拦截名单"),
      groupCard(blocked.map((x, i) => h("div", { key: i, style: { padding: "13px 14px", borderTop: i ? "1px solid #f1f1f4" : "none" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: CALL_INK } }, x.name || ""),
        x.why ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: "#b6473c", marginTop: 5 } }, x.why) : null))),
      onPeek ? peekBtn("hidden", "他的拦截名单", "他拉黑了谁", blocked.map(x => (x.name || "") + "：" + (x.why || "")).join("｜")) : null) : null,
    (!freq.length && !blocked.length && !me.number)
      ? h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: CALL_DIM } }, "还没有联系人") : null);
  // ── 详情 ──
  const detail = open ? (function () {
    const x = open.x || {};
    const isCall = open.kind === "call", isSms = open.kind === "sms", isVm = open.kind === "vm";
    const missed = isCall && x.answered === false;
    return h("div", { className: "absolute inset-0 flex flex-col justify-end", style: { background: "rgba(20,20,24,.42)", zIndex: 30 }, onClick: () => setOpen(null) },
      h("div", { onClick: e => e.stopPropagation(),
        style: { background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "84%", overflowY: "auto", padding: "18px 20px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 20px)" } },
        h("div", { className: "flex items-start justify-between", style: { gap: 10 } },
          h("div", { className: "min-w-0" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, lineHeight: 1.35, color: missed ? CALL_RED : CALL_INK } }, x.name || x.from || x.number || "陌生号码"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: CALL_DIM, marginTop: 5 } },
              [x.number, x.time, isCall ? (missed ? "未接通" : (x.dir === "in" ? "来电 " : "拨出 ") + (x.duration || "")) : "", isVm ? x.duration : "", isSms ? (x.kind === "人" ? "短信 · 人" : "短信 · 通知") : ""].filter(Boolean).join(" · "))),
          h("button", { onClick: () => setOpen(null), "aria-label": "关闭", className: "active:opacity-60", style: { fontSize: 15, color: CALL_DIM, padding: "0 4px" } }, "✕")),
        // 短信：气泡串。收到的靠左灰、他发的靠右蓝
        isSms ? h("div", { style: { marginTop: 16 } }, A(x.msgs).map((m2, j) => {
          const mine = m2.from === "me";
          return h("div", { key: j, className: "flex", style: { justifyContent: mine ? "flex-end" : "flex-start", marginTop: j ? 9 : 0 } },
            h("div", { style: { maxWidth: "78%", borderRadius: 15, padding: "10px 13px", background: mine ? CALL_BLUE : "#eeeef2", color: mine ? "#fff" : CALL_INK, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, m2.text || ""));
        })) : null,
        isVm && x.transcript ? h("div", { style: { marginTop: 16, background: "#f5f5f8", borderRadius: 12, padding: "14px 15px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: CALL_DIM } }, "留言转文字" + (x.heard === false ? " · 他一直没听" : "")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.95, color: "#3f3f47", marginTop: 8, fontStyle: "italic", whiteSpace: "pre-wrap" } }, x.transcript)) : null,
        isCall && x.gist ? h("div", { style: { marginTop: 16, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.9, color: "#4b4b53" } }, x.gist) : null,
        x.thought ? h("div", { style: { marginTop: 14, borderLeft: "3px solid " + (missed ? CALL_RED : "#c9c9d1"), paddingLeft: 12, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.9, color: CALL_INK } }, x.thought) : null,
        peekBtn("quiet",
          isCall ? (missed ? "他没接的一通电话" : "他的通话记录") : isSms ? "他收到的短信" : "有人给他留的言",
          x.name || x.from || x.number,
          [isCall ? (missed ? "没接通" : x.duration) : "", x.gist, x.transcript, A(x.msgs).map(m2 => m2.text).join(" / "), x.thought].filter(Boolean).join("｜"))));
  })() : null;
  const PAGES = [
    { key: "calls", zh: "通话", body: callsPage, badge: missedN },
    { key: "sms", zh: "短信", body: smsPage, badge: unreadN },
    { key: "vm", zh: "信箱", body: vmPage, badge: unheardN },
    { key: "people", zh: "联系人", body: peoplePage }
  ];
  const page = PAGES.find(x => x.key === tab) || PAGES[0];
  return h("div", { className: "h-full min-h-0 flex flex-col relative", style: { background: CALL_BG } },
    h("div", { className: "shrink-0", style: { paddingTop: safeTop(10) } },
      h("div", { className: "flex items-center px-4 pb-2" },
        h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: CALL_INK })),
        h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: CALL_INK } }, page.zh),
        h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演", className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center", style: { width: 40, height: 40, marginRight: -8 } }, h(IRefresh, { size: 18, color: CALL_INK }))),
      h("div", { className: "flex px-3 pb-2", style: { gap: 4 } }, PAGES.map(pg => h("button", {
        key: pg.key, onClick: () => { setTab(pg.key); setOpen(null); }, className: "flex-1 active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: 12.5, padding: "7px 4px", borderRadius: 9,
          background: tab === pg.key ? "#fff" : "transparent", color: tab === pg.key ? CALL_INK : CALL_DIM,
          boxShadow: tab === pg.key ? "0 1px 4px rgba(30,30,40,.10)" : "none" }
      }, pg.zh + (pg.badge ? " " + pg.badge : ""))))),
    h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 14px 22px" } }, page.body),
    detail);
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
      animation: "fadeUp .3s ease both"
    }
  }, kids);
  // 模型偶尔会把 items 返回成字符串或对象；a || [] 会原样放行，下一步 .map 就是白屏
  const arr = a => Array.isArray(a) ? a : [];
  // 【偷看转发】她 2026-08-29 定的规矩：手机里的东西不常驻上下文，**转发了才注入**，
  // 而且注入时的语境必须是「她翻了他的手机」。tier 决定他该有什么反应：
  //   open   = 他本来就没瞒着（歌单、大号发的帖）
  //   quiet  = 你看得见但他没主动说（备忘录、购物、浏览器、录音、普通照片）
  //   hidden = 他压根没打算让任何人知道（小号、匿名、深夜、私密、最近删除）
  const peekFoot = (tier, label, title, text) => ctx.onPeek ? h("button", {
    onClick: () => ctx.onPeek({ tier, label, title, text }),
    className: "w-full mt-6 py-3 active:opacity-60",
    style: {
      fontFamily: F_BODY, fontSize: 12.5, borderRadius: 13,
      border: "1px solid " + (tier === "hidden" ? "rgba(200,80,70,.45)" : t.line),
      color: tier === "hidden" ? "#b6473c" : t.ink
    }
  }, tier === "hidden" ? "摆到 TA 面前 · 这是他藏起来的" : tier === "open" ? "转发给 TA" : "转发给 TA · 他会知道你翻了手机") : null;
  if (key === "wechat") return h(WeChatViewFull, { d, char, t, profile: ctx.profile, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing });
  if (key === "notes") return h(StickyView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "calls") return h(PhoneCallsView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "browser") return h(BrowserView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "shopping") return h(ShoppingView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "takeout") return h(TakeoutView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "album") return h(AlbumView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  // ── 论坛：接【真论坛】，不再另生成一份光有标题的假货 ──
  // 论坛界面里她只看得见「匿名用户」和一个不认识的小号；哪些是他发的，
  // 只有翻他手机才知道。所以三个账号并排摆在这儿——查手机就是面具掉下来的地方。
  if (key === "forum") {
    const accounts = arr(ctx.forumAccounts);
    if (!accounts.length) return h(Empty, { text: "论坛还没有他的痕迹", sub: "等他去论坛发帖或回帖之后再来翻" });
    const acc = accounts.find(a => a.key === ctx.forumTab) || accounts[0];
    const fmtTs = ts => { if (!ts) return ""; const d = new Date(ts); return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
    const tabs = h("div", { className: "flex gap-2 mb-4" }, accounts.map(a => h("button", {
      key: a.key,
      onClick: () => ctx.setForumTab && ctx.setForumTab(a.key),
      className: "active:opacity-60",
      style: {
        fontFamily: F_BODY, fontSize: 12, padding: "5px 13px", borderRadius: 999,
        border: "1px solid " + (a.key === acc.key ? t.ink : t.line),
        background: a.key === acc.key ? t.ink : "transparent",
        color: a.key === acc.key ? t.bg : t.sub
      }
    }, a.label + " · " + ((a.posts || []).length + (a.comments || []).length))));
    // 顶部只留一行小字：名字进顶栏了，这里不再重复一遍大标题（mobile-ui-layout.md §1）
    const head = h("div", { className: "mb-3", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.7 } },
      [acc.handle || "", acc.followers != null ? acc.followers + " 关注者" : "", acc.joinTs ? fmtTs(acc.joinTs).slice(0, -6) + " 注册" : ""].filter(Boolean).join(" · "),
      acc.bio ? h("div", { style: { color: t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, acc.bio) : null);
    const postRow = (it, i) => h("button", {
      key: "p" + i,
      onClick: () => setSheet(h("div", null,
        h(Eyebrow, { style: { marginBottom: 10 } }, (it.board || "论坛") + " · " + fmtTs(it.ts)),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, lineHeight: 1.35 } }, it.title),
        it.body && h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.sub, marginTop: 12, lineHeight: 1.75, whiteSpace: "pre-wrap" } }, it.body),
        arr(it.replies).length ? h("div", { className: "mt-5" },
          h(Eyebrow, { style: { marginBottom: 8 } }, "楼下 " + it.replyCount + " 条"),
          arr(it.replies).map((r, j) => h("div", { key: j, className: "py-2", style: { borderTop: "1px solid " + t.line } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: r.mine ? t.accent : t.fog } }, r.name + "："),
            h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, lineHeight: 1.6 } }, r.text)))) : null,
        peekFoot(acc.key === "main" ? "open" : "hidden", acc.key === "main" ? "论坛（大号）" : acc.key === "alt" ? "论坛小号「" + (acc.name || "") + "」" : "论坛匿名帖", it.title, it.body))),
      className: "w-full text-left py-3.5 active:opacity-60",
      style: line
    }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, lineHeight: 1.4 } }, it.title),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4 } },
      [it.board, fmtTs(it.ts), it.replyCount ? it.replyCount + " 条回复" : "还没人回"].filter(Boolean).join(" · ")));
    const cmtRow = (it, i) => h("div", { key: "c" + i, className: "py-3.5", style: line },
      h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, lineHeight: 1.65 } }, it.text),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 5 } },
        "在「" + it.postTitle.slice(0, 18) + "」下 · " + fmtTs(it.ts) + (it.backCount ? " · 有 " + it.backCount + " 人回他" : "")));
    const posts = arr(acc.posts), cmts = arr(acc.comments);
    return h("div", { style: { animation: "fadeUp .3s ease both" } }, tabs, head,
      posts.length ? h("div", { className: "mb-6" }, h(Eyebrow, { style: { marginBottom: 4 } }, "发过的帖"), posts.map(postRow)) : null,
      cmts.length ? h("div", null, h(Eyebrow, { style: { marginBottom: 4 } }, "在别人楼下说的话"), cmts.map(cmtRow)) : null,
      (!posts.length && !cmts.length) ? h(Empty, { text: "这个号还是空的", sub: acc.key === "anon" ? "他还没用匿名发过什么" : "他还没用这个号露过面" }) : null);
  }
  // ── 音乐：接【一起听】里那张真歌单 ──
  // 以前这儿单独生成一份，于是同一个人有两张互不相干的歌单，
  // 手机里这张还点不动。现在读同一份数据，点开就能放，并且每首带他自己的心境。
  if (key === "music") {
    const pl = ctx.playlist;
    const songs = arr(pl && pl.songs);
    if (!songs.length) return h("div", { className: "py-6" }, h(Empty, {
      text: "他还没有歌单",
      sub: "「一起听」里给他生成一张，这里就能看到"
    }), h("button", {
      onClick: () => ctx.onGenPlaylist && ctx.onGenPlaylist(),
      disabled: !!ctx.playlistBusy,
      className: "w-full mt-4 py-3 active:opacity-60",
      style: { fontFamily: F_BODY, fontSize: 13, borderRadius: 14, border: "1px solid " + t.line, color: t.ink, opacity: ctx.playlistBusy ? .5 : 1 }
    }, ctx.playlistBusy ? "正在想他会听什么…" : "给他生成一张"));
    // 歌单名进顶栏了，这里不再放一块大字（mobile-ui-layout.md §1：普通子页面用紧凑标题栏）
    return h("div", { style: { animation: "fadeUp .3s ease both" } },
      h("div", { className: "mb-2", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, songs.length + " 首 · 和「一起听」是同一张"),
      songs.map((s, i) => {
        const note = String(s.note || "").trim();
        return h("button", {
          key: s.id || i,
          onClick: () => setSheet(h("div", null,
            h(Eyebrow, { style: { marginBottom: 8 } }, s.title),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, s.artist),
            note && h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.85, color: t.ink, marginTop: 14 } }, note),
            h("button", {
              onClick: () => ctx.onPlaySong && ctx.onPlaySong(s),
              className: "w-full mt-6 py-3 active:opacity-60",
              style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 13, border: "1px solid " + t.line, color: t.ink }
            }, "放这首"),
            peekFoot("open", "歌单", s.title + (s.artist ? " · " + s.artist : ""), note))),
          className: "w-full text-left py-2.5 flex items-start gap-3 active:opacity-60",
          style: { borderTop: `1px solid ${t.line}` }
        }, h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, color: t.fog, width: 20, paddingTop: 3 } }, String(i + 1).padStart(2, "0")),
        s.cover
          ? h("img", { src: s.cover, alt: "", style: { width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0 } })
          : h("div", { style: { width: 34, height: 34, borderRadius: 6, background: t.bg2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" } }, h(PGlyph, { k: "music", size: 15, color: t.fog })),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, s.title),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 1 } }, s.artist),
          // 心境：他为什么会循环这一首（她 2026-08-29 点名要在查手机这边看得到）
          note && h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 5, lineHeight: 1.6, paddingLeft: 8, borderLeft: "2px solid " + t.line } }, note)));
      }));
  }
  if (key === "reading") return h(ReadingView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "clipboard") return h(ClipView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "health") return h(HealthView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek, vitals: ctx.vitals });
  if (key === "liked") return h(PlazaView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "calendar") return h(CalendarView, { d: ctx.calendar || d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "bili") return h(BiliView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "latenight") return h(LateNightView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "mail") return h(MailView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  if (key === "tally") return h(TallyView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
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
  live
}) {
  const t = useTheme();
  const [sheet, setSheet] = useState(null);
  const zh = PHONE_LABEL[appKey];
  const rawData = charData[appKey];
  const data = appKey === "wechat" && rawData ? { ...rawData, actualChats: actualWechat || [] } : rawData;
  const loading = busyKey === appKey;
  const isLive = PHONE_LIVE_KEYS.indexOf(appKey) >= 0;
  const [forumTab, setForumTab] = useState("main");
  // 打开非视频版块：直接生成，失败退回上一级（不再显示中间的「生成」页）
  useEffect(() => {
    if (isLive || charData[appKey]) return;
    let alive = true;
    Promise.resolve(onGen(char, appKey)).then(ok => { if (alive && ok === false) onBack(); });
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [appKey]);
  // 视频子版块：点击 tab 时直接生成，失败退回上一级
  let content;
  if (loading && !data) content = h(Spinner, {
    label: "正在读取 " + zh + "…"
  });else if (!data && !isLive) content = h(Spinner, {
    label: "正在读取 " + zh + "…"
  });else content = renderPhoneModule(appKey, data, {
    t,
    char,
    setSheet,
    profile,
    onBack,
    onRefresh: () => onGen(char, appKey),
    refreshing: !!busyKey,
    forumTab,
    setForumTab,
    ...(live || {})
  });
  // 接真数据的 app 没有「重刷」这回事——它跟着他真去论坛发帖、真加歌单在变。
  const refreshKey = isLive ? null : appKey;
  const liveTitle = appKey === "music"
    ? (((live || {}).playlist || {}).name || "音乐")
    : appKey === "forum"
      ? (() => { const a = ((live || {}).forumAccounts || []).find(x => x.key === forumTab); return a ? a.label + " · " + (a.name || "") : "论坛"; })()
      : zh;
  return h("div", {
    className: "h-full flex flex-col",
    style: {
      background: t.bg
    }
  },
  FULL_BLEED_KEYS.indexOf(appKey) < 0 && h("div", {
    className: "shrink-0 px-4 pb-2 flex items-center gap-2",
    style: { background: t.bg, paddingTop: safeTop(10) }
  }, h("button", {
    onClick: onBack, className: "active:opacity-50 flex items-center justify-center",
    style: { width: 40, height: 40, marginLeft: -8 }, "aria-label": "返回"
  }, h(IArrow, { size: 19, color: t.ink })),
  h("div", {
    className: "flex-1 min-w-0 text-center",
    style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
  }, isLive ? liveTitle : zh),
  h("div", { style: { width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" } },
    refreshKey ? h("button", {
      onClick: () => onGen(char, refreshKey),
      disabled: !!busyKey,
      "aria-label": "重新推演",
      className: "active:opacity-50 disabled:opacity-40 flex items-center justify-center",
      style: { width: 40, height: 40 }
    }, h(IRefresh, { size: 18, color: t.ink })) : null)), h("div", {
    className: FULL_BLEED_KEYS.indexOf(appKey) >= 0 ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0 overflow-y-auto px-5 pt-1 pb-5"
  }, content), sheet && h(Sheet, {
    onClose: () => setSheet(null),
    tall: true
  }, sheet));
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
  forumAccountsFor,
  playlistFor,
  onGenPlaylist,
  playlistBusyId,
  onPlaySong,
  calendarFor,
  vitalsFor,
  archives,
  autoOn,
  onToggleAuto,
  onPeek
}) {
  const t = useTheme();
  const [pick, setPick] = useState(false);
  const [open, setOpen] = useState(null);
  const [deskPage, setDeskPage] = useState(0);
  const deskRef = useRef(null);
  // 点进 app 时桌面整个卸载，回来重挂就在第一页了——每次都得再翻一遍
  //（她 2026-08-29：「每次都得翻回来好累」）。回来后按记着的页码归位。
  const deskPageRef = useRef(0);
  deskPageRef.current = deskPage;
  const [inList, setInList] = useState(true); // 先看通讯录列表，点某人才进 Ta 的手机
  // ⚠️这个 effect 必须待在所有 return 上面。它原来写在函数中段（通讯录那个 return
  // 之后），于是列表页少调一次 hook、桌面页多调一次——从列表点进某人手机的那一下，
  // React 数出来的 hook 变多了，直接抛 #310 整页白（她 2026-08-29：查手机页面直接崩了）。
  // 提前 return 的组件里，hook 一律排在最前面，条件写进 effect 体内。
  useEffect(() => {
    if (open || inList || !deskRef.current) return;
    const n = deskPageRef.current;
    if (!n) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (deskRef.current) deskRef.current.scrollLeft = deskRef.current.clientWidth * n;
    }));
  }, [open, inList]);
  // 锁屏：拿起他手机的第一眼，不该直接是一片图标网格
  const [locked, setLocked] = useState(true);
  // 「我收着的」——她自己留的那些，只给她自己看，不进任何上下文。
  // 转发是摆到他面前，收着是我自己留一份：两件事。
  const [kept, setKept] = useState(() => loadJSON("x_phoneKeep", {}));
  // 桌面顶部的全局搜索。在他手机里搜自己的名字，是所有偷看动作里最真的一个。
  const [q, setQ] = useState("");
  // delta 账本：上次翻完时手机上有哪些条目。x_phoneMark[charId].ids = { 指纹: 1 }
  // 指纹只由内容决定（见 phoneEntryId），所以他没动的东西不会因为你又翻了一次就变新。
  const [mark, setMark] = useState(() => loadJSON("x_phoneMark", {}));
  // 绿点 = 有数据且还没看过；打开即消，刷新全部时重新点亮
  const [seen, setSeen] = useState(() => loadJSON("x_phoneSeen", {}));
  const isSeen = (cid, k) => !!(seen[cid] && seen[cid][k]);
  const markSeen = (cid, k) => setSeen(p => { const n = { ...p, [cid]: { ...(p[cid] || {}), [k]: true } }; saveJSON("x_phoneSeen", n); return n; });
  const clearSeen = cid => setSeen(p => { const n = { ...p }; delete n[cid]; saveJSON("x_phoneSeen", n); return n; });
  const allNowKey = String(busyKey || "").indexOf("__all__") === 0 ? (String(busyKey).split(":")[1] || "__all__") : null;
  const isAllRun = String(busyKey || "").indexOf("__all__") === 0;
  const char = characters.find(c => c.id === selId) || characters[0];
  if (!char) return h("div", {
    className: "h-full flex flex-col"
  }, h(Head, {
    zh: "查手机",
    en: "Inspect",
    onBack
  }), h(Empty, {
    text: "还没有角色",
    sub: "先去名录录入一位"
  }));
  // 通讯录列表：做成一块「手机屏」——顶部我的头像+通讯录，下面角色列表在屏内下滑；点某人才进 Ta 的手机
  if (inList) {
    const p = profile || {};
    const meAv = { name: p.name || "我", avatarImage: p.avatarImage, color: p.color || t.accent };
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
      // 紧凑标题栏（.claude/rules/mobile-ui-layout.md §1），不再顶一块 30px 大标题
      h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { background: t.bg, paddingTop: safeTop(10) } },
        h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: t.ink })),
        h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "查手机"),
        h("div", { style: { width: 40, height: 40 } })),
      h("div", { className: "flex-1 min-h-0 px-4 pb-6" },
        h("div", { className: "h-full flex flex-col rounded-[30px] overflow-hidden", style: { background: "linear-gradient(180deg,#fbfaf7,#f1eee7)", border: "1px solid " + t.line, boxShadow: "0 12px 34px rgba(0,0,0,0.10)" } },
          // 手机顶栏：我的头像 + 通讯录
          h("div", { className: "shrink-0 flex items-center gap-3 px-5 pt-6 pb-4", style: { borderBottom: "1px solid " + t.line } },
            h(Avatar, { character: meAv, size: 50, radius: 999 }),
            h("div", { className: "flex-1 min-w-0" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink, lineHeight: 1.1 } }, "通讯录"),
              h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10, letterSpacing: "0.18em", color: t.fog, marginTop: 3 } }, "CONTACTS · " + characters.length))),
          // 角色列表：在手机屏内下滑
          h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 py-1" },
            characters.map(c => h("div", {
              key: c.id, className: "w-full flex items-center gap-3", style: { borderBottom: "1px solid " + t.line }
            },
              h("button", {
                onClick: () => { onSel(c.id); setOpen(null); setLocked(true); setInList(false); },
                className: "flex-1 min-w-0 flex items-center gap-3 py-3 active:opacity-60 text-left"
              },
                h(Avatar, { character: c, size: 44, radius: 13 }),
                h("div", { className: "flex-1 min-w-0" },
                  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 1 } },
                    (autoOn || {})[c.id] ? "每周自动刷一次" : "翻翻 Ta 的手机"))),
              // 每周自动刷的开关。默认关——她按次计费，默认开会吓人。
              // ⚠️必须和那一行并排、不能套在里面：按钮不许嵌按钮。
              // 放在这儿而不是设置里：开关和「这是谁的手机」得在同一个地方看得见。
              onToggleAuto ? h("button", {
                onClick: () => onToggleAuto(c.id),
                className: "active:opacity-60 shrink-0",
                "aria-label": "每周自动刷新 " + (c.remark || c.name),
                style: {
                  fontFamily: F_BODY, fontSize: 10.5, padding: "4px 10px", borderRadius: 99,
                  background: (autoOn || {})[c.id] ? t.ink : "transparent",
                  color: (autoOn || {})[c.id] ? "#fff" : t.fog,
                  border: "1px solid " + ((autoOn || {})[c.id] ? t.ink : t.line)
                }
              }, "每周") : null,
              h("span", { style: { fontFamily: F_BODY, fontSize: 20, color: t.fog, flexShrink: 0 } }, "\u203a")))))));
  }
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
    // 日历接 App 里那份真的：他自己那格日历 + 带时刻的日程 + 他答应过她的事
    calendar: calendarFor ? calendarFor(char) : null,
    // 健康的每日快照（趋势）。报告本身照旧每次重写，这一条是另存的轻量线。
    vitals: vitalsFor ? vitalsFor(char.id) : null,
    // 偷看转发：手机里的东西只有【转发了】才进他的上下文（她 2026-08-29 定的）
    onPeek: pk => onPeek && onPeek(char, pk)
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
    saveJSON("x_phoneKeep", n);
    return n;
  });
  // 搜索：不调模型。时间线已经把各 app 的碎片规范化了，再补上它不收的那几栏。
  const searchExtra = phoneSearchExtra(data, liveCtx);
  const hits = q.trim() ? phoneSearch(tlRows, searchExtra, q) : [];
  const liveCount = k => {
    if (k === "forum") return (liveForum || []).reduce((n, a) => n + (a.posts || []).length + (a.comments || []).length, 0);
    if (k === "music") return ((livePlaylist && livePlaylist.songs) || []).length;
    if (k === "calendar") return ((liveCtx.calendar || {}).items || []).length;
    if (k === "timeline") return tlRows.length;
    return 0;
  };
  const hasData = a => PHONE_LIVE_KEYS.indexOf(a.key) >= 0 ? liveCount(a.key) > 0
    : data[a.key];
  const appByKey = k => PHONE_APPS.find(a => a.key === k);
  const openApp = a => {
    if (!a || a.soon) return;
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
  const appIcon = (a, compact) => h("button", {
    key: a.key,
    onClick: () => openApp(a),
    className: "flex flex-col items-center active:opacity-60",
    style: { gap: compact ? 3 : 7, minWidth: 0 }
  }, h("div", {
    className: "relative flex items-center justify-center",
    style: {
      width: compact ? 44 : 56,
      height: compact ? 44 : 56,
      borderRadius: compact ? 13 : 17,
      background: "rgba(255,255,255,.88)",
      border: "1px solid rgba(255,255,255,.72)",
      boxShadow: "0 8px 22px rgba(28,25,20,.10)"
    }
  }, h(PGlyph, { k: a.key, size: compact ? 22 : 27, color: t.ink }), hasData(a) && !isSeen(char.id, a.key) && h("span", {
    style: {
      position: "absolute", top: -3, right: -3, width: 10, height: 10,
      borderRadius: 9, background: "#78bd58", border: "2px solid rgba(255,255,255,.95)"
    }
  })), h("span", {
    // ⚠️dock 那排也要写名字。浏览器在四套布局里有三套只在 dock，没有名字就等于
    // 这个 app 不存在（她 2026-08-29：「我的查手机浏览器怎么找不到了」）。
    // iOS 的 dock 不写字，但这不是 iOS，是「翻他手机」——找得到比像不像重要。
    style: {
      width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      fontFamily: F_BODY, fontSize: compact ? 9.5 : 11, color: t.ink,
      textShadow: compact ? "none" : "0 1px 8px rgba(255,255,255,.85)"
    }
  }, a.zh));
  if (open) return h(PhoneApp, {
    appKey: open,
    char,
    charData: data,
    // 全刷时 busyKey 是 "__all__:当前那个 key"。以前不分是谁，一律当成「打开的这个正在生成」，
    // 于是全刷期间随便点哪个 app 都是一个转不完的圈，看起来就像卡死了（她 2026-08-29 报音乐打不开）。
    busyKey: allNowKey || busyKey,
    onGen: onGenApp,
    profile,
    actualWechat: actualWechatFor ? actualWechatFor(char) : [],
    live: {
      ...liveCtx,
      timelineRows: tlRows, newIds, newCount,
      kept: keptIds, onToggleKeep: toggleKeep,
      onMarkRead: () => markRead(tlRows.map(r => r.id)),
      onOpenApp: k => { const a = appByKey(k); if (a) openApp(a); }
    },
    onBack: () => setOpen(null)
  });
  if (locked) return h(LockScreen, {
    char, t, rows: tlRows, newIds, newCount,
    onUnlock: () => setLocked(false),
    onTimeline: () => { setLocked(false); setOpen("timeline"); },
    onOpenApp: k => { setLocked(false); const a = appByKey(k); if (a) openApp(a); }
  });
  const wall = strColor(char.id || char.name);
  const layout = phoneDesktopLayout(char);
  const widgetData = key => data[key];
  const widgetCopy = key => {
    const fallback = {
      wechat: "点开看看最近和谁说过话", notes: "最近没有留下新备忘", browser: "最近没有浏览记录",
      music: "他还没有歌单", album: "相册还没翻过", bili: "最近没有观看记录", latenight: "深夜台还是空的",
      forum: "论坛上还没有他的痕迹", reading: "最近没在读什么", liked: "还没点过什么",
      health: "还没有健康记录", clipboard: "剪贴板是空的", calendar: "日历上没有安排", takeout: "最近没点过吃的",
      timeline: "先刷一遍手机，这里才串得起来", tally: "他还没给你们记账", mail: "邮箱还没翻过"
    }[key] || "还没有内容";
    // 真数据这几个走自己那份，不然桌面小组件永远显示兜底话
    if (key === "timeline") {
      // 小组件说的是「他最近干了什么」，不是待办清单，所以跳过还没发生的那几条
      const r = tlRows.find(x => !x.ahead) || tlRows[0];
      if (!r) return fallback;
      return (newCount > 0 ? newCount + " 条新的 · " : "") + (r.ts == null ? "" : phoneClock(r.ts) + " ") + (r.title || r.text || "");
    }
    if (key === "calendar") {
      const ci = ((liveCtx.calendar || {}).items || [])[0];
      return ci ? (ci.date ? String(ci.date).replace(/^\d{4}-/, "") + " " : "") + ci.title : fallback;
    }
    if (key === "music") { const sg = ((livePlaylist && livePlaylist.songs) || [])[0]; return sg ? (livePlaylist.name || "歌单") + " · " + sg.title : fallback; }
    if (key === "forum") {
      const all = (liveForum || []).reduce((a, x) => a.concat((x.posts || []).map(p => ({ ts: p.ts, s: p.title })), (x.comments || []).map(c => ({ ts: c.ts, s: c.text }))), []);
      const last = all.sort((a, b) => b.ts - a.ts)[0];
      return last ? String(last.s || "").slice(0, 40) : fallback;
    }
    return latestLine(widgetData(key), fallback);
  };
  const deskWidget = spec => {
    const key = spec.key;
    const wide = spec.span === 2;
    const hero = spec.size === "hero";
    const dark = key === "music" || key === "latenight";
    if (key === "refresh") return h("button", {
      key,
      onClick: () => { clearSeen(char.id); onGenAll(char); }, disabled: !!busyKey,
      className: "text-left active:opacity-70 disabled:opacity-50",
      style: {
        gridColumn: wide ? "span 2" : "span 1", minHeight: hero ? 124 : 104, padding: 15, borderRadius: 23,
        background: "rgba(255,255,255,.62)", border: "1px solid rgba(255,255,255,.7)"
      }
    }, h(IRefresh, { size: 19, color: t.ink }), h("div", {
      style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, marginTop: 12 }
    }, isAllRun ? (allNowKey && PHONE_LABEL[allNowKey] ? "正在翻…" + PHONE_LABEL[allNowKey] : "正在翻整部手机…") : "刷新全部 App"));
    const app = appByKey(key);
    return h("button", {
      key,
      onClick: () => openApp(app), className: "text-left active:opacity-70",
      style: {
        gridColumn: wide ? "span 2" : "span 1", minHeight: hero ? 124 : spec.size === "wide" ? 108 : 104,
        padding: hero ? 17 : 15, borderRadius: hero ? 25 : 23,
        background: dark ? "rgba(30,29,27,.88)" : "rgba(255,255,255,.72)",
        color: dark ? "#fff" : t.ink, border: dark ? "none" : "1px solid rgba(255,255,255,.72)",
        boxShadow: hero ? "0 12px 28px rgba(35,31,25,.09)" : "none"
      }
    }, h("div", { className: "flex items-center justify-between" },
      h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".11em", color: dark ? "rgba(255,255,255,.62)" : t.fog } }, app.zh),
      h(PGlyph, { k: key, size: 19, color: dark ? "#fff" : t.ink })),
    h("div", {
      style: {
        fontFamily: F_DISPLAY, fontSize: hero ? 18 : 14, lineHeight: 1.42,
        marginTop: hero ? 20 : 13, display: "-webkit-box", WebkitLineClamp: hero ? 2 : 2,
        WebkitBoxOrient: "vertical", overflow: "hidden"
      }
    }, widgetCopy(key)));
  };
  const pages = layout.pages.map((keys, pageIndex) => h("section", {
    key: pageIndex,
    className: "h-full min-w-full overflow-y-auto px-5 pt-3 pb-5",
    style: { scrollSnapAlign: "start", scrollSnapStop: "always" }
  }, h("div", { className: "grid grid-cols-2 gap-3 mb-6" }, (layout.widgets[pageIndex] || []).map(deskWidget)),
  h("div", { className: "grid grid-cols-4 gap-x-2 gap-y-6" }, keys.map(k => appIcon(appByKey(k), false)))));
  return h("div", {
    className: "h-full flex flex-col overflow-hidden",
    style: {
      background: `radial-gradient(circle at 82% 12%,rgba(255,255,255,.80),transparent 31%),linear-gradient(155deg,${wall}35 0%,#eee8dc 56%,${wall}22 100%)`
    }
  }, h("div", {
    className: "shrink-0 px-5 pb-2 flex items-center justify-between",
    style: { paddingTop: safeTop(20) }
  }, h("button", { onClick: () => { setInList(true); setLocked(true); }, className: "active:opacity-50", "aria-label": "返回通讯录" }, h(IArrow, { size: 19, color: t.ink })),
  h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, fontWeight: 600, color: t.ink } }, new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })),
  h("button", { onClick: () => setPick(true), className: "active:opacity-50", "aria-label": "切换角色" }, h(Avatar, { character: char, size: 28, radius: 9 }))),
  // 名字和头像顶栏已经有了，这儿不再顶一大块（她 2026-08-29：「那一大块角色名也删了吧」）
  // 搜索条：在他手机里搜一个词。零调用——读的是已经翻出来的东西。
  h("div", { className: "shrink-0 px-4 pb-2" },
    h("div", {
      className: "flex items-center",
      style: { gap: 8, height: 34, borderRadius: 12, padding: "0 12px", background: "rgba(255,255,255,.62)", border: "1px solid rgba(255,255,255,.7)" }
    },
      h("span", { "aria-hidden": "true", style: { fontSize: 13, color: t.fog } }, "\u2315"),
      h("input", {
        value: q, onChange: e => setQ(e.target.value),
        placeholder: "在他手机里搜…",
        "aria-label": "在他手机里搜",
        style: { flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontFamily: F_BODY, fontSize: 13, color: t.ink }
      }),
      q ? h("button", { onClick: () => setQ(""), "aria-label": "清空", className: "active:opacity-60", style: { fontSize: 13, color: t.fog, padding: "0 2px" } }, "\u2715") : null)),
  q.trim() ? h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
    h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, padding: "2px 2px 10px" } },
      hits.length ? "在他手机里找到 " + hits.length + " 处" : "他手机里没有这个"),
    hits.slice(0, 60).map(r => h("button", {
      key: r.id,
      onClick: () => { const a = appByKey(r.app); if (a) { setQ(""); openApp(a); } },
      className: "w-full text-left active:opacity-60",
      style: { display: "block", background: "rgba(255,255,255,.72)", borderRadius: 15, padding: "12px 14px", marginBottom: 8 }
    },
      h("div", { className: "flex items-center", style: { gap: 6, marginBottom: 4 } },
        h(PGlyph, { k: r.app, size: 12, color: t.fog }),
        h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          r.appZh + (r.tag ? " · " + r.tag : "")),
        r.when ? h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10, color: t.fog } }, r.when) : null),
      r.title ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, lineHeight: 1.45, wordBreak: "break-word" } }, r.title) : null,
      r.text ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, lineHeight: 1.65, marginTop: 3, wordBreak: "break-word" } },
        r.text.length > 60 ? r.text.slice(0, 60) + "…" : r.text) : null))) : null,
  !q.trim() && h("div", { className: "shrink-0 px-5 pb-1 flex items-center justify-between" },
  h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "向左滑还有一页"),
  h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: ".17em", color: t.fog } }, layout.label)),
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
  h("div", { className: "shrink-0 mx-4 mb-3 px-3 py-2 grid grid-cols-4", style: { borderRadius: 25, background: "rgba(255,255,255,.66)", border: "1px solid rgba(255,255,255,.74)", boxShadow: "0 12px 30px rgba(35,31,25,.11)" } }, layout.dock.map(k => appIcon(appByKey(k), true))), pick && h(Sheet, {
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
      fontSize: 16,
      color: t.ink
    }
  }, c.name))))));
}

// 各 app 的推演任务
// ============================================================
// 同一部手机不许复读（她 2026-08-29：「差不多同一时间刷新的话素材都差不多，
// 就算功能不一样还是会说的大差不差的」）
//
// 病因在结构，不在哪个 app 的提示词写坏了：runProbe 给每个 app 发的
// system 是【引擎前言 + buildBundle(ctx) + 这个 app 的 instruction】，
// 而 buildBundle(ctx) 十二次逐字相同。同一份上下文喂十二遍，模型每次都会
// 抓住其中最显眼的那件事（昨晚那场架、这趟出门），然后换十二种格式重讲一遍：
// 备忘录里记它、搜索框里搜它、买的东西为它、听的歌为它、录音里叹它。
//
// 所以要两层一起上（规则降概率，代码才保证）：
//   ① 代码层——把这轮别的 app 已经写出来的东西回喂给下一个，明确禁止重讲。
//      这跟朋友圈那份【不许复读】和微信那份【真实会话避重】是同一个形状。
//   ② 规则层——每个 app 除了输出格式，还要有自己的【取材层】和【时间窗】，
//      让它们靠结构分开，而不是靠运气分开。
// ============================================================

// 每个 app 站的位置：他在这个 app 里是「对谁」的样子，以及往回捞多久。
// 时间窗尤其重要——现在所有 app 默认都在写「这几天」，相册本该跨年、
// 购物本该跨月，全挤在同一个窗口里，撞车是必然的。
const PHONE_ANGLE = {
  wechat: "【取材层】有别人在场时的他。这里每句话都是说给某个具体的人听的，会挑措辞、会留一手。【时间窗】这几天。",
  notes: "【取材层】完全没人看的时候，他留给自己的东西——打字的和说出口的都在这儿。录下来的那些是**打字打不出来、只能说出来**的，这是它和打字条的分界。【时间窗】这一两周。",
  calls: "【取材层】他和外面世界打交道时留下的硬痕迹：谁打来他不接、谁给他留了言、哪些人只配收到短信。**电话记录里最有东西的是没接通的那些。**【时间窗】这一周。",
  browser: "【取材层】没人看着的时候他自己去找的东西。搜索框里的人是不修饰的——会打错字、会问很蠢的问题、会反复搜同一件事。【时间窗】这几天，标签页可以开了很久。",
  shopping: "【取材层】他花钱的方式。买了什么、想买没买、绝不买什么、送到谁家——这四样加起来比他自己说的任何一句都准。【时间窗】这一个月，想买清单可以惦记很久。",
  bili: "【取材层】他消磨时间的口味，不是他的心事——刷视频多半是没在想什么的时候。弹幕是例外：那是他忍不住开口的地方。【时间窗】这几天。",
  latenight: "【取材层】深夜、独自一人、没打算被任何人看见的欲望。【时间窗】这阵子。",
  album: "【取材层】过去。**相册的主体不是这几天**，而是几个月到几年沉下来的东西：旧的人、去过的地方、早就结束的事。只有一两张属于最近。【时间窗】跨月跨年。",
  reading: "【取材层】他一个人读到某一句停下来的那个瞬间。**批注和划线是不打算给任何人看的动作**，所以它比书单诚实得多；书架怎么分、怎么起名，也是他自己对自己的说法。【时间窗】跨年，一架书是攒出来的，不是这个月买的。",
  liked: "【取材层】他不会写下来、但会顺手点的东西。点赞和收藏没有措辞、不用解释，所以最诚实。【时间窗】这一两个月。",
  health: "【取材层】他的身体和心神这一天经历了什么。**指标名和细分项都要长成这个角色世界里的样子**，不是通用体检报告。【时间窗】今天为主，一周做背景。",
  clipboard: "【取材层】他复制过、但不一定发出去的东西。这里最重要的不是内容，是**发没发出去**。【时间窗】这几天。",
  takeout: "【取材层】他怎么把自己喂饱。几点吃、吃什么、送到谁那儿、备注里写了什么——**备注那一栏比吃什么更暴露人**。【时间窗】这两周。",
  wallet: "【取材层】他的谋生方式和消费水平，是长期的底子，不是这几天的心情。【时间窗】按月。",
  mail: "【取材层】他对外那一面：工作、账单、订阅、学校、机构。**这里的他是【对陌生人和上级说话】的样子**，跟微信里那个人是同一个，但措辞完全两回事。【时间窗】这一两周，订阅和账单可以更久。",
  tally: "【取材层】他心里给这段关系记的那本账——欠着的、兜过的底、放过的狠话、舍不得的、拿不准的。**这本账不记钱**，钱在钱包里；这儿记的是没结清的东西。【时间窗】从认识到现在，横跨很久；大多数条目应该已经挂了一阵子了。"
};

// 从已存下来的各 app 数据里抽一行代表，喂给下一个 app 当【已经写过】清单。
// 只抽标题/名字这一层，不抽正文——目的是让模型认出「这件事被人写过了」，
// 不是把别的 app 的内容再塞一份进上下文（她按次计费，也按字数付钱）。
const pArr = a => Array.isArray(a) ? a : [];
const PHONE_DIGEST_PICK = {
  wechat: d => pArr(d.chats).slice(0, 3).map(c => (c.name || "") + "：" + (c.last || ""))
    .concat(pArr(d.moments).slice(0, 2).map(m => "朋友圈「" + String(m.content || "").slice(0, 30) + "」")),
  notes: d => pArr(d.items).map(x => x.title),
  calls: d => pArr(d.calls).slice(0, 4).map(x => x.name || x.number).concat(pArr(d.sms).map(x => x.name)),
  browser: d => pArr(d.tabs).map(x => x.title).concat(pArr(d.searches).map(x => x.q)),
  shopping: d => pArr(d.orders).map(x => x.title).concat(pArr(d.wish).map(x => x.title), pArr(d.cart).map(x => x.title)),
  album: d => pArr(d.items).slice(0, 4).map(x => x.caption),
  bili: d => pArr(d.items).map(x => x.title),
  latenight: d => pArr(d.items).map(x => x.title),
  reading: d => pArr(d.shelves).map(x => x.name).concat(pArr(d.shelves).reduce((a, sh) => a.concat(pArr(sh.books).slice(0, 2).map(b => b.title)), [])),
  liked: d => pArr(d.items).map(x => x.title).concat(pArr(d.mine).map(x => x.title)),
  health: d => pArr(d.cards).map(x => x.name + "·" + (x.tag || "")),
  clipboard: d => pArr(d.items).map(x => x.text),
  takeout: d => pArr(d.orders).map(x => x.shop + "·" + ((pArr(x.items)[0] || {}).name || "")).concat(pArr(d.shops).map(x => x.name), pArr(d.wish).map(x => x.title)),
  wallet: () => [],
  mail: d => pArr(d.inbox).map(x => x.subject).concat(pArr(d.sent).map(x => x.subject)),
  tally: d => pArr(d.debts).map(x => x.title).concat(pArr(d.statements).map(x => x.text), pArr(d.treasures).map(x => x.title))
};

// charData = phones[charId]，形如 { notes:{items,_at}, browser:{...}, ... }
function phoneRoundDigest(charData, exceptKey, cap) {
  const lines = [];
  Object.keys(PHONE_DIGEST_PICK).forEach(k => {
    if (k === exceptKey) return;
    const d = charData && charData[k];
    if (!d) return;
    let picked = [];
    try { picked = PHONE_DIGEST_PICK[k](d) || []; } catch (e) { picked = []; }
    picked = picked.map(x => String(x || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 4);
    if (picked.length) lines.push("- " + (PHONE_LABEL[k] || k) + "：" + picked.join("｜"));
  });
  const max = cap || 900;
  const out = [];
  let used = 0;
  for (const l of lines) {
    const s = l.length > 120 ? l.slice(0, 120) : l;
    if (used + s.length > max) break;
    out.push(s);
    used += s.length;
  }
  return out;
}

function phoneAvoidBlock(lines) {
  if (!lines || !lines.length) return "";
  return "\n\n【同一部手机 · 不许复读】这轮他手机里别的 app 已经写了下面这些：\n" + lines.join("\n")
    + "\n**换一件别的事写。**一个人的手机里不会所有 app 都在说同一件事——备忘录记的、搜索框里搜的、买的东西、听的歌，本来就来自他生活里互不相干的角落，"
    + "很多东西跟你以为最重要的那件事根本没关系。\n"
    + "上面已经出现过的事，这里【只能写它的侧面或后果】，绝不许重讲一遍：别处写了他在等一个消息，这里可以是他等的时候顺手买的东西，但不能又写一遍他在等。\n"
    + "优先去写上面完全没提到的、属于他自己的另一条线：工作、家里、旧朋友、身体、钱、没做完的事、纯粹的无聊。";
}

function phoneProbeSpec(key, char, rel, actualWechat, avoidLines, known, money, weekly) {
  const relHint = rel && rel.length ? "关系网里的人（" + rel.join("、") + "）请优先出现。" : "";
  const S = {
    wechat: {
      instruction: "推演此刻「" + char.name + "」完整的微信。下面先给你 TA 手机里【真实已有、不可改写】的聊天摘要；你要避开其中已有会话名与原话，另外生成正好 5 个互不相同的新会话（私聊与群聊混合，至少各 2 个）。\n" + (actualWechat || "目前没有可用的真实聊天。") + "\n" + relHint + "chats 每个会话给名字、private/group 类型、最后一条、时间及最近 8-12 条有来有回的对话，不要只给三两句。contacts 正好 5 个，不含用户 Lisa：必须是与 TA 真有关系的人，含 TA 给对方的微信备注 remark 和一段具体、有个人态度的关系简介 intro。userContact 单独写 Lisa：name 固定 Lisa，但 remark 必须是 TA 真会给 Lisa 起的微信备注，intro 必须写 TA 对 Lisa 的具体认识、情感和私下评价，不能写「以主聊天为准」之类占位话。moments 正好 3 条，作者从 contacts 里选；每条给点赞名单和评论，且 comments 中必须有一条来自「" + char.name + "」本人的自然评论。me 写 TA 自己给自己取的 wechatName（不是角色本名照抄，要像 TA 真会使用的微信昵称、符合 TA 的取名风格）、wechatId 和本轮新生成的朋友圈 signature；并给最近看过的 3 篇公众号文章：标题、公众号、时间、较完整的文章摘要和 TA 看完的真实感想。所有内容贴合人物关系、近况和声纹，避免客服腔与泛泛而谈。",
      schemaHint: "{\"chats\":[{\"type\":\"private或group\",\"name\":\"会话名\",\"last\":\"最后一条\",\"time\":\"14:20\",\"messages\":[{\"from\":\"说话人\",\"text\":\"内容\"}]}],\"userContact\":{\"name\":\"Lisa\",\"remark\":\"TA给Lisa的微信备注\",\"intro\":\"TA对Lisa具体而私人的感想\"},\"contacts\":[{\"name\":\"本名\",\"remark\":\"TA的备注\",\"intro\":\"关系与感想\"}],\"moments\":[{\"author\":\"联系人\",\"time\":\"2小时前\",\"content\":\"朋友圈正文\",\"likes\":[\"姓名\"],\"comments\":[{\"from\":\"姓名\",\"text\":\"评论\"}]}],\"me\":{\"wechatName\":\"TA的微信昵称\",\"wechatId\":\"微信号\",\"signature\":\"本轮生成的朋友圈签名\",\"accounts\":[{\"title\":\"文章标题\",\"source\":\"公众号\",\"time\":\"昨晚\",\"summary\":\"较完整文章摘要\",\"thought\":\"TA的感想\"}]}}"
    },
    notes: {
      instruction: "推演「" + char.name + "」手机便签里的东西（**8-12 条**）。这里既有他打字记下的，也有他说出口录下来的——**两种混在一起，本来就是一个 app**。\n"
        + "每条：kind（typed = 打字的 / voice = 录音的）、title（很短的一句抬头，可以就是正文第一句）、time、body（正文）、color（0-5 的整数，定便签颜色）。\n"
        + "kind=voice 的另给 duration（如 0:37 / 2:14）；它的 body 就是那段录音转成的字。\n\n"
        + "【两种要真的不一样，这是这个 app 唯一重要的事】\n"
        + "**打字的**：清单、待办、半句话、气话、抄下来的一行字、一串数字、一个地址。不必是完整的想法，很多条根本没有情绪。可以短到只有四五个字。\n"
        + "**录下来的**：**只有打字打不出来、必须说出口的东西才会被录**。所以它有语气词、有停顿、有说到一半改口、有自己都嫌烦的叹气；转成字之后是不通顺的。录音在总数里是少数（三分之一以内），而且往往在深夜、在路上、在刚吵完架之后。\n"
        + "如果两种写出来一个味道，就等于这个 app 白做了。\n\n"
        + "【长短要差得开】有的一行，有的一大段。不许每条都是同一个长度、同一个句式。" + relHint,
      schemaHint: "{\"items\":[{\"kind\":\"typed\",\"title\":\"很短的抬头\",\"time\":\"昨天 21:03\",\"body\":\"正文\",\"color\":2},{\"kind\":\"voice\",\"title\":\"抬头\",\"time\":\"昨天 23:40\",\"duration\":\"0:37\",\"body\":\"录音转成的字，不通顺\",\"color\":4}]}"
    },
    calls: {
      instruction: "推演「" + char.name + "」手机上的电话和短信。\n\n"
        + "me：number（他自己的号码）。\n\n"
        + "calls 通话记录 **8-12 条**：name（对方怎么称呼，陌生号就留空）、number、dir（in 来电 / out 拨出）、time、duration（接通了才写；没接通留空）、answered（true/false）、gist（这通说了什么，一句；没接通就写没接通时他在干嘛）、thought（**他对这通电话的真实想法**，一句，可以刻薄、可以敷衍、可以是没接的理由）。\n"
        + "**这个 app 真正有东西的是没接通的那些**：谁打来他不接、他打给谁一直打不通、深夜那通只有几十秒的、同一个人一天打了好几遍。**至少三条是没接通的**，而且每一条不接的理由都不一样（在忙、不想接、故意晾着、没听见、正跟别人在一起）。\n\n"
        + "sms 短信 **5-8 串**：name、number、kind（通知 或 人）、time、unread（true/false）、msgs（1-4 条，各有 from = they／me、text、time）、thought（他对这串的想法，可空）。\n"
        + "**⚠️短信和微信收发的东西完全不是一回事，别把微信那套搬过来。**\n"
        + "短信里**绝大多数不是人**：验证码、账目通知、催缴、店家提醒、送货、推销、以及骗子。这些一条就是一条，没有来回，语气是机器或者陌生人的。kind=通知 的那几串占多数。\n"
        + "**熟人一旦出现在短信里，必有一个理由**：那会儿联不上网、对方被他删了或拉黑了、手机不在身边、或者是必须留个凭据的正事。**写熟人短信时，那个理由要能从内容里看出来**，不能写成日常闲聊——日常闲聊属于微信，不属于这里。\n"
        + "短信也**几乎没有表情、没有连发、没有撒娇**，句子是完整的、生硬的、像在办事。\n\n"
        + "voicemail 语音信箱 **2-4 条**：from、time、duration、transcript（留言转成的字，**要有停顿、改口、说到一半的句子**）、heard（他听没听过）、thought。\n"
        + "**留言是单向的，本身就说明对方联系不上他**——所以这几条里应该有他一直没听的那条。\n\n"
        + "frequent 常联系 **3-5 个**：name、count（通话次数）、why（一句为什么总跟这人通话）。**电话打给谁，和微信聊得多的，往往不是同一批人**：电话给的是办事的、家里的、以及不方便打字的。\n\n"
        + "blocked 拦截名单 **1-3 个**：name、why（一句为什么拉黑的）。可以是骗子，也可以是他不想再接的人。" + relHint,
      schemaHint: "{\"me\":{\"number\":\"他的号码\"},\"calls\":[{\"name\":\"对方称呼\",\"number\":\"号码\",\"dir\":\"in\",\"time\":\"今天 09:12\",\"duration\":\"04:32\",\"answered\":true,\"gist\":\"这通说了什么\",\"thought\":\"他的想法\"}],\"sms\":[{\"name\":\"发信方\",\"number\":\"号码\",\"kind\":\"通知\",\"time\":\"时间\",\"unread\":false,\"msgs\":[{\"from\":\"they\",\"text\":\"内容\",\"time\":\"时间\"}],\"thought\":\"可空\"}],\"voicemail\":[{\"from\":\"谁留的\",\"time\":\"时间\",\"duration\":\"0:41\",\"transcript\":\"留言转成的字\",\"heard\":false,\"thought\":\"他的想法\"}],\"frequent\":[{\"name\":\"谁\",\"count\":14,\"why\":\"为什么总跟这人通话\"}],\"blocked\":[{\"name\":\"谁\",\"why\":\"为什么拉黑\"}],\"retired\":{\"frequent\":[\"不再常联系的\"],\"blocked\":[\"放出黑名单的\"]}}"
    },
    browser: {
      instruction: "推演「" + char.name + "」浏览器里的全部东西。\n\n"
        + "me：他浏览器同步账号的昵称（不是本名照抄）和 uid。\n\n"
        + "tabs 没关掉的标签页 **8-12 个**：title（网页标题）、site（站点名或域名）、age（这一页开了多久，写成一句）、pinned（true/false，钉住的最多 2 个）、cover（0-5 整数定色）、gist（这一页上写着什么，一句）。\n"
        + "**一堆没关的标签页是这个人脑子的横截面**：有他正在办的正事、有查到一半忘了的、有想买没买的、有半夜看了没退出的、有开了很久舍不得关的。**至少有一个是开了很久、他自己也说不清为什么不关的。**\n\n"
        + "searches 搜索记录 **10-14 条**：q（他敲进搜索框的原话）、time、site（在哪儿搜的，可空）、results（这一次搜出来的结果，2-4 条）、opened（这几条里他真正点开的那条的 source，填其中一个）。\n"
        + "**搜索词比访问过的网页更暴露人**：人在搜索框里是不修饰的，会打错字、会问很蠢的问题、会反复搜同一件事、会在半夜搜白天绝不会问出口的东西。所以这十几条里要有：实用的、丢人的、重复搜过的、以及一两条他绝不会告诉任何人他搜过的。\n"
        + "results 每条：source（哪个站/哪个号发的）、title（那条结果的标题）、excerpt（摘要，一两句，像搜索结果页里那截被掐头去尾的正文，可以用「……」表示截断）。\n"
        + "**这一层要写成【搜索引擎会返回什么】，不是【他想看到什么】**：结果里该有权威一点的、有营销号味的、有答非所问的，也可以有一条正好戳到他心事的。\n"
        + "**opened 才是这一栏真正的东西**——搜了什么只说明他在想什么，点开了哪一条才说明他信谁、他到底想确认什么。这两个不必一致：他可以搜得很正经，然后点开最不正经的那条。\n\n"
        + "marks 书签 **3-4 个文件夹**：name（文件夹名，按他自己的分法起，不是「工作」「学习」这种）、items（2-4 条，各有 title 和 site）。**书签是他觉得以后还用得着的东西**，所以里面会有很久没点过的旧东西。\n\n"
        + "private 无痕标签页 **1-3 个**：title、site、gist。**这是他专门开了不留记录的那几页**，和上面那些不是一回事。\n\n"
        + "所有内容都要贴合他的身份和时代——古代角色的\"浏览器\"是他那个世界里查东西的方式，别硬套现代网站。" + relHint,
      schemaHint: "{\"me\":{\"name\":\"昵称\",\"uid\":\"账号\"},\"tabs\":[{\"title\":\"网页标题\",\"site\":\"站点\",\"age\":\"开了多久\",\"pinned\":false,\"cover\":0,\"gist\":\"这页上写着什么\"}],\"searches\":[{\"q\":\"他敲进去的原话\",\"time\":\"时间\",\"site\":\"在哪搜的\",\"opened\":\"他点开那条的 source\",\"results\":[{\"source\":\"哪个站或哪个号\",\"title\":\"结果标题\",\"excerpt\":\"摘要……\"}]}],\"marks\":[{\"name\":\"文件夹名\",\"items\":[{\"title\":\"标题\",\"site\":\"站点\"}]}],\"private\":[{\"title\":\"标题\",\"site\":\"站点\",\"gist\":\"这页上写着什么\"}],\"retired\":{\"marks\":[\"已经取消收藏的书签名\"]}}"
    },
    shopping: {
      instruction: "推演「" + char.name + "」网购 App 的整个界面。" + relHint + "\n"
        + "**所有金额、店铺、商品都必须贴合他的身份、时代和谋生方式**：古代角色买的是他那个世界里买得到的东西、逛的是那种铺子；普通人就是普通消费水平，不许人人都很有钱。\n\n"
        + "account 账户：name（**他在这个平台上的昵称**，不是本名照抄）、uid（会员号，一串数字）、member（会员等级的名字，按平台在他世界里的叫法起，可以带点调侃）、style（一句话概括他的购物风格）、monthSpend（本月消费，数字）、monthOrders（本月订单数）、points（积分）、persona（一句更狠的购物性格：他买东西时最像他自己的那个毛病）。\n"
        + "shipping 在途包裹 **2-3 件**：status（派送中/运输中/已揽收）、eta（如「今日 18:00 前」）、shop、title（商品全名带规格）、progress（0-100 整数）、carrier、tail（运单尾号）、amount（数字）。\n"
        + "cart 购物车 **4-6 件**：shop、title、spec（颜色/尺码/款式）、price（现价数字）、was（原价数字，可为 0）、promo（优惠标签，可空）、qty。购物车装的是【还没下决心的东西】。\n"
        + "wish 想买清单 **4-6 件**：title、shop、price、why（**为什么想买，一句他自己的话**）。\n"
        + "**why 这一栏是整个 app 里最重要的东西**：它要暴露他的私心、旧事和惦记的人（「某人不是喜欢红的么，买来扣她脖子上」「刀柄弧度很像当年父亲留下的那把」「府里那张被陆闻拍裂了一条缝」）。不许写「质量好」「性价比高」这种。\n"
        + "orders 我的订单 **6-8 单**：**id（这一单的编号，同一单以后刷新也必须是同一个 id——钱包靠它认账，换了 id 会被当成新的一单再扣一次钱）**、shop、status（已收货/待收货/已取消）、time、title、items（1-3 件，各有 name、spec、qty、price）、ship（运费数字）、paid（实付数字）、tags（2 个左右：品类和付款方式各一个）、review（收货后他写的一句，很短很实在）、reason（**一句下单理由**，可以牵涉到人）、addr（送到哪）。\n"
        + "habit 购物习惯：budget（单笔预算区间）、buys（常买什么）、avoids（**绝不买什么**——这一条比常买更像人）、how（下单习惯，什么时候翻、还不还价）。\n"
        + "shops 常逛店铺 **3-4 家**：name、cat（品类）、why（一句为什么是这家，要具体到掌柜脾气、货色成色这种）。\n"
        + "coupons 优惠券 **2-3 张**：rule（如「满300减50」）、name、scope（哪家或哪类可用）、until（到期日）。\n"
        + "viewed 最近浏览 **5-7 条**：title、shop、price、time。**看了没买的东西和购物车里的要错开**，那是另一层心思。\n"
        + "addrs 收货地址 **2-3 条**：label（地址别名）、tail（尾号）、detail（详细到门房怎么放的那种备注）、isDefault（只有一条 true）。**其中一条应当是「他常去的另一个地方」**，不是自己家。\n"
        + "gifts 相关往来 **3-5 条**：who（给谁买的，用他嘴里对那个人的叫法）、title、note（**一句只有他会写的备注**，如「嘴上说着不喜欢我吵，接了油纸包自己一口气吃了三块」）。\n"
        + "monthNote：本月购物概况，一段 60-110 字，账房口吻，别抒情。tail：最后一句他自己的念叨，一两句，可以很得意也可以很没出息。",
      schemaHint: "{\"account\":{\"name\":\"平台昵称\",\"uid\":\"1043827\",\"member\":\"会员等级的叫法\",\"style\":\"一句购物风格\",\"monthSpend\":3260.5,\"monthOrders\":8,\"points\":18420,\"persona\":\"一句购物性格\"},\"shipping\":[{\"status\":\"派送中\",\"eta\":\"今日 18:00 前\",\"shop\":\"店铺\",\"title\":\"商品全名\",\"progress\":78,\"carrier\":\"快递\",\"tail\":\"9042\",\"amount\":340}],\"cart\":[{\"shop\":\"店铺\",\"title\":\"商品\",\"spec\":\"规格\",\"price\":680,\"was\":880,\"promo\":\"跨店满减\",\"qty\":1}],\"wish\":[{\"title\":\"商品\",\"shop\":\"店铺\",\"price\":560,\"why\":\"一句他自己的话\"}],\"orders\":[{\"id\":\"这一单的编号，同一单永远不变\",\"shop\":\"店铺\",\"status\":\"已收货\",\"time\":\"8月28日 14:15\",\"title\":\"订单标题\",\"items\":[{\"name\":\"商品\",\"spec\":\"规格\",\"qty\":2,\"price\":48}],\"ship\":0,\"paid\":128,\"tags\":[\"食品特产\",\"微信支付\"],\"review\":\"收货一句\",\"reason\":\"下单理由\",\"addr\":\"送到哪\"}],\"habit\":{\"budget\":\"...\",\"buys\":\"...\",\"avoids\":\"...\",\"how\":\"...\"},\"shops\":[{\"name\":\"店铺\",\"cat\":\"品类\",\"why\":\"为什么是这家\"}],\"coupons\":[{\"rule\":\"满300减50\",\"name\":\"券名\",\"scope\":\"哪儿可用\",\"until\":\"8月31日\"}],\"viewed\":[{\"title\":\"商品\",\"shop\":\"店铺\",\"price\":680,\"time\":\"今天 21:15\"}],\"addrs\":[{\"label\":\"王府侧门\",\"tail\":\"4819\",\"detail\":\"详细地址与备注\",\"isDefault\":true}],\"gifts\":[{\"who\":\"给谁\",\"title\":\"东西\",\"note\":\"一句备注\"}],\"monthNote\":\"一段\",\"tail\":\"最后一句念叨\",\"retired\":{\"wish\":[\"买到手或不想要了的\"]}}"
    },
    album: {
      instruction: "推演「" + char.name + "」手机相册里正好 25 张互不重复的照片。时间跨度要自然；date 必须写真实完整日期 YYYY-MM-DD HH:mm，必须带年份，禁止写周三、周五、昨天、最近等相对日期。每张分进且只分进五类之一：回忆(memory)、个人收藏(favorite)、最近保存(saved)、私密(private)、最近删除(deleted)，每类至少 4 张、不必平均。memory 是 TA 真正会反复翻看的重要瞬间，不是普通随手拍。caption 是很短的照片标题；desc 要具体写照片真正拍到了什么（人物、地点、构图、光线和细节），不能只写抽象心情；thought 单独写 TA 看到这张照片时真实、私人的想法。类别与内容要合理：私密不等于一律色情，最近删除也要写为什么舍不得或为什么删。",
      schemaHint: "{\"items\":[{\"id\":\"p01\",\"caption\":\"很短的标题\",\"date\":\"2026-08-28 18:42\",\"category\":\"memory或favorite或saved或private或deleted\",\"desc\":\"照片实际画面描述\",\"thought\":\"TA对此的私人想法\"}]}"
    },
    reading: {
      instruction: "推演「" + char.name + "」手机读书 App 里的整个书架。**正好 5 个书架、正好 30 本书（每架 6 本）。**\n\n"
        + "【书架名是这个功能的灵魂】书架名**不是分类标签**——不许写「历史」「科幻」「文学」「哲学」这种。它是【他自己给这堆书起的名字】，带着他的处境、身份、私心和自嘲——**一看名字就知道是谁的书架**，而且换个角色这名字就不成立了。每架另配一个英文 slug（小写下划线，如 midnight_wander）。\n"
        + "五个里至少有一个是【只有他会有的】：跟他的职业、他正在应付的麻烦、他藏着的身份、或者某个具体的人有关。" + relHint + "\n\n"
        + "【书必须是真的】真实存在、书名和作者都对得上，而且【是他在他所处的时代和世界里拿得到的】：古代角色的架子上不许出现现代出版物，现代角色可以有古籍和译本。同一架里的书要像同一个人挑的。\n\n"
        + "【每本都要有】title、author；readAt = 他读到哪儿（「卷七·饮食果子」「第 3 章」「214 页」都行，**允许有几本写「还没翻开」或「读了两页就放下了」**）；note = 他的批注，40-90 字，第一人称。\n"
        + "批注要写他读到这里**真实想到的事**：可以跑题、可以刻薄、可以突然想到某个人、可以是很实际的念头、一个当场冒出来的打算。**不许写读后感、不许总结这本书讲了什么、不许出现「这本书让我明白了」「引发了我的思考」这类句子。**换个角色也说得通的批注就是写坏了。\n"
        + "quote 可选：他在这本里划的一句原文（书里的句子，不是他的话），没有就填空字符串——**多数书是没有的**。\n\n"
        + "【阅读档案 archive】name = **他在这个读书 app 上的昵称**（不是本名照抄）；uid = 书友号（一串数字）；favorite = 他最爱的一本（title+author，要在上面 30 本里）；weekTime = 本周读了多久（如「7小时5分」，按他的处境合理，忙的人可以只有二十分钟）；weekGoal = **他给自己定的每周阅读目标**（同样格式，如「5小时」；定得高还是低本身就是这个人的样子，也完全允许他这周没读到）；plan = 他打算下一本读的（title+author）。",
      schemaHint: "{\"shelves\":[{\"name\":\"他自己起的书架名\",\"slug\":\"english_slug\",\"books\":[{\"title\":\"书名\",\"author\":\"作者\",\"readAt\":\"读到哪儿\",\"quote\":\"他划的原句，多数留空\",\"note\":\"40-90字第一人称批注\"}]}],\"archive\":{\"name\":\"书友昵称\",\"uid\":\"7742019\",\"favorite\":{\"title\":\"书名\",\"author\":\"作者\"},\"weekTime\":\"7小时5分\",\"weekGoal\":\"5小时\",\"plan\":{\"title\":\"书名\",\"author\":\"作者\"}}}"
    },
    liked: {
      instruction: "推演「" + char.name + "」在小红书那样的图文社区里的账号。\n"
        + "me：name（**他在这儿的昵称**，不是本名照抄；这种号往往随手起、有点敷衍或自嘲）、xhsId（一串数字号）、bio（一句简介，可以很敷衍甚至只有几个字）、tag（个人页上那颗小药丸：年纪、所在地、或一句自嘲，二选一）、posts（发过几条）、following、followers、likes（获赞与收藏总数）。**粉丝数按他这个人合理，多数人很少。**\n"
        + "tabs：他常看的频道 **4-6 个**，按他的口味起名（按他真正会点进去的东西起名，别用平台默认那几个大类）。\n"
        + "items **10-12 条**他【赞过或收藏过】的笔记，每条：author、title（社区那种口吻——夸张、口语、像在跟人诉苦或炫耀）、excerpt（正文一两句）、tab、tags（1-3 个）、likes、act（赞 或 收藏）、time、cover（0-5 的整数，定封面色）。\n"
        + "**点赞记录是一个人最诚实的东西**：他不会写下来，但他会点。这十来条要出现他【不主动说、也不觉得需要解释】的部分——某种审美、某个身体或情绪上的需要、一个他嘴上不承认的爱好、一条他其实想照做的建议、一件他偷偷惦记的事。也要有很没意思的（做饭、通勤、修东西），别每条都深刻。\n"
        + "mine **2-4 条**他自己发出去的笔记：title、excerpt、tags（1-3 个，和他赞的那些是同一套标签体系）、likes、time、cover。\n"
        + "**drafts 1-3 条：他写了却一直没发出去的草稿。**这是这个 app 最狠的一格——写完了、存着、就是没点发送。可以是矫情的、丢人的、太露骨的、或者写给某个具体的人却不敢发的。每条：title、excerpt、tags（1-3 个）、savedAt（存了多久，写成一句）。\n"
        + "**他发出去的、他赞过的、和他没发出去的，可以完全是三个人**：发出去的是他愿意给人看的，赞过的是他自己，草稿箱里的是他不敢承认的。\n"
        + "follows：他关注的 **4-6 个**账号，name ＋一句 desc。别全是正经账号。" + relHint,
      schemaHint: "{\"me\":{\"name\":\"昵称\",\"xhsId\":\"159193450\",\"bio\":\"简介\",\"tag\":\"24岁\",\"posts\":3,\"following\":254,\"followers\":12,\"likes\":153},\"tabs\":[\"频道名\",\"频道名\"],\"items\":[{\"author\":\"发帖人\",\"title\":\"标题\",\"excerpt\":\"正文一两句\",\"tab\":\"频道\",\"tags\":[\"标签\"],\"likes\":1204,\"act\":\"赞\",\"time\":\"3天前\",\"cover\":2}],\"mine\":[{\"title\":\"他发的\",\"excerpt\":\"正文\",\"tags\":[\"标签\"],\"likes\":12,\"time\":\"上周\",\"cover\":4}],\"drafts\":[{\"title\":\"没发出去的\",\"excerpt\":\"正文\",\"tags\":[\"标签\"],\"savedAt\":\"存了 11 天\"}],\"follows\":[{\"name\":\"账号名\",\"desc\":\"这号是干嘛的\"}],\"retired\":{\"follows\":[\"取关了的\"],\"drafts\":[\"发出去或删掉的草稿标题\"]}}"
    },
    health: {
      instruction: "推演「" + char.name + "」健康 App 今天的整份报告。" + relHint + "\n\n"
        + "cards **12-14 张指标卡**，group 分三档、每档 4-5 张：body（身体：睡眠、活动、心跳、消耗、恢复这类）、mind（心神：情绪、静心、社交、私密的身体反应这类）、intake（摄入与消耗：喝的、吃的、以及他花在传消息上的时间）。wide=true 的整宽卡每档 1-2 张，其余为窄卡。\n\n"
        + "【这个 app 的灵魂 · 指标名要长成他世界里的样子】**不要照搬现代体检报告的词。**一个古代王爷不知道什么叫「屏幕使用时间」，所以那一项在他那儿必须换成他会用的说法；「正念冥想」「社交电量」这类现代词同理。现代角色就用现代说法。**先想清楚这个人所处的是什么世界、他会怎么称呼这件事，再落名字。**\n\n"
        + "【每张卡都要有】name（指标名，见上）、group、wide、score（0-100 整数）、value（大数字或大词，如 6.2 / 11420 / 「不均」/「亢奋克制」）、unit（单位，大词就留空）、tag（四个字以内的状态词，说清此刻是好是坏）、note（一段 50-90 字的观测叙述）、stats（**正好 3 项**，各有 k 和 v）、week（7 个 0-100 的整数，做一周条形图）、quote（他自己的一句话）。\n\n"
        + "【stats 那三项是最见功夫的地方】**它们的名字必须是这个角色专属的，绝不能用通用标签。**同样一张「步数」卡：三项拆的应该是**他今天真正走过的那几段路、真正喝下去的那几样东西**，名字要带上地点、场合、或某个具体的人。**换个角色还照样成立的三项，就是写坏了。**\n\n"
        + "【note】用体检报告那种冷静的观测口吻写，但内容必须是**他今天真实经历过的事**：熬夜看什么看到几点、为什么突然心跳飙起来、去了哪、跟谁吵了、吃了什么没吃成什么。不许写「建议保持规律作息」这类套话。\n"
        + "【quote】切回他本人的口气，带脾气、带私心，可以刻薄可以得意，和上面那段冷静叙述形成反差。\n\n"
        + "today：score（今日综合分 0-100 整数）、label（一句今天的总评，很短）。\n"
        + "timeline **4-6 条**：time（HH:mm）、tag（两三个字的类别，用上面那些指标名里的词）、text（一句 25-45 字，说清那个时刻身体发生了什么、为什么）。按时间顺序。\n"
        + "insights **正好 3 条**：title（一个短判断，像体检报告小标题那样）、text（一段 30-55 字的解释）。\n"
        + "tail：最后一句他自己的话，一两句。",
      schemaHint: "{\"today\":{\"score\":74,\"label\":\"一句总评\"},\"cards\":[{\"name\":\"指标名\",\"group\":\"body\",\"wide\":true,\"score\":68,\"value\":\"6.2\",\"unit\":\"h\",\"tag\":\"欠佳\",\"note\":\"一段观测叙述\",\"stats\":[{\"k\":\"角色专属项\",\"v\":\"02:15\"},{\"k\":\"角色专属项\",\"v\":\"1.1h\"},{\"k\":\"角色专属项\",\"v\":\"3次\"}],\"week\":[62,55,70,48,66,58,72],\"quote\":\"他自己的一句话\"}],\"timeline\":[{\"time\":\"02:34\",\"tag\":\"两三个字的类别\",\"text\":\"一句\"}],\"insights\":[{\"title\":\"短判断\",\"text\":\"一段\"}],\"tail\":\"最后一句\"}"
    },
    clipboard: {
      instruction: "推演「" + char.name + "」手机剪贴板里最近躺着的东西（5-7 条）。每条给 text（复制的原文）、from（从哪个 app 复制的）、time、sent（true=后来发出去了；false=复制了但一直没发）。\n**必须至少有一条 sent=false，而且是他打给某个具体的人、却始终没发出去的话。**这是「差一点就说了」的物证，是这个 app 唯一重要的东西。它不必长，可以只有半句，可以很难看、很没出息、说到一半停住。\n其余的可以很杂很无聊：验证码、快递单号、店铺地址、一个人名、一句歌词、一个链接。别每条都深情。" + relHint,
      schemaHint: "{\"items\":[{\"text\":\"复制的原文\",\"from\":\"从哪个 app 复制的\",\"time\":\"昨天 02:11\",\"sent\":false}]}"
    },
    takeout: {
      instruction: "推演「" + char.name + "」点餐 App 的整个界面。" + relHint + "\n"
        + "**所有店铺、菜名、价格都要贴合他的身份、时代和谋生方式**：古代角色是从街市的铺子叫吃食、由跑腿送到门上；现代角色就是正常外卖。别人人都点贵的。\n\n"
        + "account：name（**他在这个平台上的昵称**，不是本名照抄；这种账号名往往随手起、有点敷衍或自嘲）、uid（平台号，一串数字或字母数字）、member（会员等级的叫法，按这个平台在他世界里的说法起）、monthOrders、monthSpend（数字）、persona（一句他点餐的性格：他叫外卖时最像他自己的那个毛病）。\n\n"
        + "today 今日推荐（一条）：addrLabel（送到哪，一两个字的地方别名）、addrDetail、date（如「8月28日 周五」）、meal（早餐/午餐/晚餐/夜宵）、shop、rating（店铺评分，如「4.6」）、eta（如「12:45送达」）、delivery（配送方式的叫法）、main（主推那道菜，**后面用括号带上他每次都要的规格**）、amount（数字）、status、note（下单备注）。\n\n"
        + "shops 常点商家 **4-5 家**：name、cat、times（点过多少次，写成一句）、usual（他每次都点的）、why（一句为什么总是这家，具体到掌柜脾气、火候、开到几时）、last（上次什么时候）、cover（0-5 整数定色）。\n\n"
        + "live 正在送的 **0-2 单**：status、eta、shop、items（一句话说清点了什么）、rider、step（0-3 的整数：0已下单 1商家接单 2配送中 3待送达）、amount、note。\n\n"
        + "orders 我的订单 **6-8 单**：**id（这一单的编号，同一单以后刷新也必须是同一个 id——钱包靠它认账）**、shop、time、meal（餐次）、status、main（主菜一行）、items（1-3 样，各有 name、spec 规格、qty、price）、pack（包装费数字）、fee（配送费数字）、amount（实付数字）、stars（1-5 整数）、rating（他写的评价，一句，很实在）、tags（2-3 个：品类、餐次、付款方式各一个）、addr、note（**下单备注**）、reason（**为什么这一单**，一句，可以牵涉到人）。\n"
        + "**note 那一栏是这个 app 的重点**：同样一句备注，写给谁、护着谁、怕吵着谁，是三个不同的人。要像真人当场打的字，宁可留空也别写成客服模板。**至少一单是深夜的，至少一单是送到别人那儿的。**\n\n"
        + "taste 口味：spicyTags（辣度，2-3 个短词的数组）、avoidTags（**忌口，3-4 个**——这一组比爱吃什么更像人。**别只写食材名**，要写清他嫌它哪一点，越具体越像他）、likeTags（偏好，3-4 个）、budget（一句预算）、habit（一句点餐习惯，什么时辰点、为什么点）。\n\n"
        + "week 本周吃什么 **正好 7 天**：day（一到日）、meals（1-3 条，各有 t=早/午/晚/夜 和 text=吃了什么，可以写「未点送」表示那顿没叫）。\n\n"
        + "coupons 红包卡券 **2-4 张**：amount（如「50」或「免跑腿脚钱2文」）、unit（如「元」，amount 已经是整句时留空）、name（券名，按他世界里的叫法起，别用现代满减券的套话）、scope（哪家可用）、until（到期）。\n\n"
        + "addrs 常用地址 **2-3 条**：label（地址别名，**后面用括号补一句这是谁的地方／去干嘛的**）、tail（尾号数字）、detail（详细到怎么送、怎么放、进哪个门——**要具体到只有常来的人才写得出**）、isDefault（只有一条 true）。**其中一条应当是【他常去投喂的另一个地方】，不是自己住处。**\n\n"
        + "wish 想吃清单 **3-5 条**：title（想吃的东西，可以很长很具体）、when（**什么时候会突然想起它**——写那个当下他在哪、在受什么罪、嘴里是什么味）。\n\n"
        + "together 一起点过 **3-4 条**：who（**用他嘴里对那个人的叫法**，不是规规矩矩的本名——那个称呼本身就该看得出他俩什么关系）、items（点了什么）、story（一段 40-70 字，那顿饭上发生了什么，要具体、要有画面、可以很好笑）。\n\n"
        + "monthNote：本周点餐概况，一段 70-110 字。tail：最后一两句他自己的念叨。",
      schemaHint: "{\"account\":{\"name\":\"平台昵称\",\"uid\":\"88412037\",\"member\":\"会员等级的叫法\",\"monthOrders\":22,\"monthSpend\":1180,\"persona\":\"一句性格\"},\"today\":{\"addrLabel\":\"家\",\"addrDetail\":\"详细地址\",\"date\":\"8月28日 周五\",\"meal\":\"午餐\",\"shop\":\"店名\",\"rating\":\"4.6\",\"eta\":\"12:45送达\",\"delivery\":\"配送方式的叫法\",\"main\":\"主推菜（他每次都要的规格）\",\"amount\":68.5,\"status\":\"已送达\",\"note\":\"备注\"},\"shops\":[{\"name\":\"店\",\"cat\":\"品类\",\"times\":\"点过 24 次\",\"usual\":\"常点\",\"why\":\"为什么总是这家\",\"last\":\"今天中午\",\"cover\":0}],\"live\":[{\"status\":\"配送中\",\"eta\":\"预计 13:30 送达\",\"shop\":\"店\",\"items\":\"点了什么\",\"rider\":\"送的人怎么称呼\",\"step\":2,\"amount\":42,\"note\":\"\"}],\"orders\":[{\"id\":\"这一单的编号，同一单永远不变\",\"shop\":\"店\",\"time\":\"今天 12:10\",\"meal\":\"午餐\",\"status\":\"已完成\",\"main\":\"主菜\",\"items\":[{\"name\":\"菜\",\"spec\":\"规格\",\"qty\":1,\"price\":52}],\"pack\":0,\"fee\":2,\"amount\":68.5,\"stars\":5,\"rating\":\"一句评价\",\"tags\":[\"品类\",\"餐次\"],\"addr\":\"送到哪\",\"note\":\"备注\",\"reason\":\"为什么这一单\"}],\"taste\":{\"spicyTags\":[\"辣度短词\"],\"avoidTags\":[\"忌口，写清嫌它哪点\"],\"likeTags\":[\"偏好短词\"],\"budget\":\"一句\",\"habit\":\"一句\"},\"week\":[{\"day\":\"一\",\"meals\":[{\"t\":\"早\",\"text\":\"吃了什么\"}]}],\"coupons\":[{\"amount\":\"50\",\"unit\":\"元\",\"name\":\"券名\",\"scope\":\"哪家可用\",\"until\":\"8月31日\"}],\"addrs\":[{\"label\":\"地址别名（这是谁的地方）\",\"tail\":\"3391\",\"detail\":\"详细与备注\",\"isDefault\":true}],\"wish\":[{\"title\":\"想吃的东西\",\"when\":\"什么时候会想起它\"}],\"together\":[{\"who\":\"他嘴里对那人的叫法\",\"items\":\"点了什么\",\"story\":\"那顿饭上发生了什么\"}],\"monthNote\":\"一段\",\"tail\":\"最后一句\",\"retired\":{\"wish\":[\"不惦记了的\"]}}"
    },
    bili: {
      instruction: "推演「" + char.name + "」白天刷的视频站（仿 bilibili）。\n"
        + "me：他自己的账号——name（**他给自己取的用户名**，不是本名照抄；这种名字往往随手起、有点中二或自嘲）、uid（一串数字）、level（1-6 整数）、followers（关注了多少人，数字）、fans（粉丝数，数字，多数人很少）、coins（硬币数）。\n"
        + "tabs：他首页顶上的分区标签 **4-6 个**，按他真实的口味排（如「推荐」「科技」「生活」「鬼畜」「纪录片」）。\n"
        + "items **正好 10 条**视频，每条：title（真实感的视频标题，长短不一，可以有那种很长的标题党）、up（UP主名）、tab（属于上面哪个分区）、duration（如 08:24 / 1:12:05，按内容类型给合理长度）、views（播放量，如「12.4万」「873」）、danmaku（弹幕数，数字）、desc（视频简介一两句）、thought（**他看完的真实想法**，一句，可以很敷衍、可以骂、可以只是「行吧」）。\n"
        + "**myDanmaku：他自己在这个视频里发过的弹幕，0-3 条。**这是这个 app 最好的东西——**弹幕是他忍不住开口的地方**，短、脱口而出、没措辞，跟他在别处说话的样子可以完全不同。多数视频他是不发弹幕的（留空数组），只在真被戳到时才发。弹幕要短（十几个字以内），像真弹幕：可以是吐槽、接梗、数字刷屏、突然一句真心话。\n"
        + "【内容要贴人设】十条要有层次：他真正在追的、随手点开的、无聊到底的、别人推给他的、以及一两条跟他职业或麻烦事有关的。别十条都是同一类。视频要像那个世界里真会有的东西——不必强行套现代，但要是他刷得到的。" + relHint,
      schemaHint: "{\"me\":{\"name\":\"用户名\",\"uid\":\"3947201\",\"level\":5,\"followers\":128,\"fans\":37,\"coins\":412},\"tabs\":[\"分区名\",\"分区名\"],\"items\":[{\"title\":\"视频标题\",\"up\":\"UP主\",\"tab\":\"分区\",\"duration\":\"08:24\",\"views\":\"12.4万\",\"danmaku\":320,\"desc\":\"简介\",\"thought\":\"他看完的想法\",\"myDanmaku\":[\"他发的弹幕\"]}]}"
    },
    latenight: {
      instruction: "推演「" + char.name + "」深夜独自看的小电影（**正好 10 条**）。尺度该多大就多大，不要含糊其辞、不要写成文艺片。\n"
        + "每条：title（标题）、duration（如 00:18:42 / 01:45:20，符合这类片子的合理长度）、tags（2-4 个标签的字符串数组）、views（播放量）、thought（点开那一秒他在想什么，一句，赤裸、不修饰）。\n"
        + "另给 me：uid（这种站子上他没有名字，只有一串数字或字母）、lastAt（上次是什么时候，如「前天 03:12」）、note（一句他自己都不愿承认的旁白）。\n"
        // 病：所有角色都往「强势占有」那一头写（她 2026-08-29 报）。那不是哪个词写坏了，
        // 是这一栏除了「一个角色 + 深夜看的片」几乎没给别的约束，剩下的空白由训练先验补上，
        // 而这个题材的先验就是支配。治法跟人设被截断那次一样：不是加禁令，是把维度铺开，
        // 让他必须先在几根互不相干的轴上各选一头，答案才有地方长出来。
        + "【先定他站在哪几根轴上，再写这十条】欲望不是一条从轻到重的直线，是好几根互不相干的轴。动笔前先想清楚这个人在下面每一根上偏向哪一头，**再让十条分散落在不同的轴上**：\n"
        + "· 他要的是自己掌控局面，还是要有人替他拿主意，还是根本不在这条轴上；\n"
        + "· 他是在看别人，还是在想象自己被看；\n"
        + "· 他要陌生、一次性的，还是要认识很久的那种熟；\n"
        + "· 他要用力和快，还是要慢和长；\n"
        + "· 要不要有情节、有没有对话，还是根本不需要；\n"
        + "· 他代入的是哪一边——也可能哪边都不代入，只是在旁边看着。\n"
        + "【这一栏最容易写坏的地方】不要默认每个人的欲望都往「支配 / 占有 / 强势」那一头去。那是最省事的答案，**也是换成任何一个角色都照样成立的答案——照样成立就等于没写**。有人要的是被照顾，有人要的是自己失控，有人要的是被当成平等的人，有人只是想有一段不必说话的时间。他要哪一种，从他的人设长出来，不从这个题材的惯例长出来。\n"
        + "【十条要有差别】不是同一个口味重复十遍：有他最常回去的那几条、有一次性点开就关的、有他自己都嫌过火的、也可以有跟某个具体的人有关的那种。标签要落到具体的场合、身份、动作或情境上，**别用那种换个角色照样贴得上的形容词**。",
      schemaHint: "{\"me\":{\"uid\":\"u_7741903\",\"lastAt\":\"前天 03:12\",\"note\":\"一句旁白\"},\"items\":[{\"title\":\"标题\",\"duration\":\"00:18:42\",\"tags\":[\"tag1\",\"tag2\"],\"views\":\"3.2万\",\"thought\":\"想法\"}]}"
    },
    mail: {
      instruction: "推演「" + char.name + "」的邮箱。\n"
        + "me：addr（他的邮箱地址，**从他的身份和年代来定**，不是随手编一串）、name（发件人显示名）、sign（邮件签名档，一到两行）。\n"
        + "inbox 收件箱 **8-12 封**：from（谁发的）、fromAddr、subject（主题）、time、kind（这封属于哪一类）、unread（true/false）、preview（列表里露出来的那一截）、body（正文，3-6 句，写成那类邮件真正的样子）、thought（他看完心里那句，一句，可空——大多数邮件他心里什么都没有，那就留空）。\n"
        + "sent 发出去的 **3-5 封**：to、subject、time、body（他写的正文）。\n"
        + "drafts 草稿 **1-3 封**：to、subject、body、savedAt（存了多久）——**草稿是这个 app 最有东西的一栏**：写了没发的那封，通常是他不敢发或者不知道怎么措辞的。\n\n"
        + "【这一栏的全部意义是【落差】】邮件里的他是【对陌生人和上级说话】的样子：客气、绕、留余地、把话说死之前先铺三层。"
        + "**这个腔调和他私下说话的差距，就是这个 app 要给出来的东西**——同一个人，一边是邮件里那套滴水不漏的说法，一边是他在便签里骂的那句。\n"
        + "【收件箱要杂】不是每封都重要：该有正事、有账单、有他懒得退订的推送、有群发的、有一封他一直没回的。**一直没回的那封最说明人。**\n"
        + "【不要和微信撞车】微信是熟人和随口，这儿是正式的往来。同一件事不要在两处各写一遍。",
      schemaHint: "{\"me\":{\"addr\":\"他的邮箱地址\",\"name\":\"发件人显示名\",\"sign\":\"签名档\"},\"inbox\":[{\"from\":\"谁发的\",\"fromAddr\":\"地址\",\"subject\":\"主题\",\"time\":\"今天 09:12\",\"kind\":\"哪一类\",\"unread\":true,\"preview\":\"列表里那一截\",\"body\":\"正文\",\"thought\":\"他心里那句\"}],\"sent\":[{\"to\":\"寄给谁\",\"subject\":\"主题\",\"time\":\"昨天 18:40\",\"body\":\"正文\"}],\"drafts\":[{\"to\":\"本来要寄给谁\",\"subject\":\"主题\",\"body\":\"正文\",\"savedAt\":\"存了多久\"}],\"retired\":{\"drafts\":[\"发出去或删掉的草稿主题\"]}}"
    },
    tally: {
      instruction: "推演「" + char.name + "」心里给他和用户之间记的那本账。\n"
        + "**这本账不记钱**——钱是钱包的事。这儿记的是【没结清的东西】：欠着的、兜过的底、放过的狠话、舍不得的、拿不准的。\n"
        + "所有内容必须从【他和用户之间真实发生过的事】里长出来（关系、记忆、印象、这阵子的来往）；写不出具体的，那一栏宁可少给两条，也不要拿泛泛的关系描述凑数。\n\n"
        + "五栏，各自的写法：\n"
        + "① debts（4-7 条）没结清的账。每条：title 一句话说清欠的是什么、dir 填 mine（他欠用户）/ theirs（用户欠他）/ open（两个人都没说清、悬着）、note 一句他自己怎么想这笔。\n"
        + "   ⚠️theirs 那几条**不是他在讨债**——写成他自己惦记着的一件还没完的事，主语是他的在意，不是对方的亏欠。写成指责就是写坏了。三种都要有，别一边倒。\n"
        + "② policies（2-4 条）他给对方兜的底，**写成保险条款那种腔调**：name 险种名、scope 一句承保范围、terms 理赔条件（写成对方要做到什么，那句话里要看得出他的脾气）、clause 一句正文条款（承保人负责做什么）。\n"
        + "   条款体的用处是**逼他把感情写成义务**——一个不肯说软话的人，在条款里反而什么都答应了。这层落差是这一栏的全部意义。\n"
        + "③ statements（4-6 条）他盖过章的定论，每条一句他会亲口说出来的话。text 那句话本身、heat 这句话的温度（一个字或两个字，从这句话的力道来定，别都用同一个）。\n"
        + "④ treasures（3-5 条）他心里估价最高的东西，**用估值的语言说**：title 那样东西是什么（可以是一个瞬间、一个习惯、一份证据）、kind 归成哪一类、worth 他给的估价（用估价的口吻，不是数字）。\n"
        + "⑤ appraisals（3-5 条）他自己给自己的定论，问答体：q 一个悬着的问题（这个问题得是他真会在心里问自己的）、a 他的答案，一到两句，说死不留余地。\n\n"
        + "【最容易写坏的地方】这本账要能一眼看出是【这两个人】的账。换成任何一对角色都照样成立的条目就是写坏了——那种句子只是在描述「有点在乎对方」，谁都能写。"
        + "每一条都要能指回一件具体的事：某次没做到的、某次替对方挡下的、某句被记住的话、某个他不肯承认自己在留意的细节。",
      schemaHint: "{\"debts\":[{\"title\":\"欠的是什么\",\"dir\":\"mine或theirs或open\",\"note\":\"他怎么想这笔\"}],\"policies\":[{\"name\":\"险种名\",\"scope\":\"承保范围\",\"terms\":\"理赔条件\",\"clause\":\"条款正文\"}],\"statements\":[{\"text\":\"他会亲口说的一句\",\"heat\":\"这句话的温度\"}],\"treasures\":[{\"title\":\"那样东西\",\"kind\":\"归哪一类\",\"worth\":\"他给的估价\"}],\"appraisals\":[{\"q\":\"悬着的问题\",\"a\":\"他的答案\"}]}"
    },
    wallet: {
      instruction: "推演「" + char.name + "」的财务档案。**最重要：收入来源与全部金额必须严格依据 TA 的人设、职业、身份和社会阶层来定，money 要贴合 TA 真实的谋生方式。** 收入来源 incomes（1-3 项，name+category+amount 数字）——category 从 TA 实际的谋生方式来：工资/自由职业/接单/做生意/兼职/学生生活费/退休金/稿费/打赏 等；**只有当人设明确是富家子弟、继承人、家境优渥时，才可以出现「家族供养/信托」这类收入，否则绝对不要默认套用家族收入。** 普通人就是普通收入、金额可以不高甚至拮据。monthlyIncome 月收入合计；fixedMonthly 每月固定支出；baseBalance 当前存款余额；investAssets 理财持有资产（普通人可能很少或为 0）；notes 各部分批注（income/savings/invest/spending，每条一句符合人设的旁白，透露财力与消费态度）；dailyPool 15-25 条日常消费模板（每条 items 一句话描述当天买了啥，amount 数字，反映其真实生活水平）；可选 gifts 送礼转账。所有金额纯数字不带符号，务必与身份匹配、不要人人都很有钱。",
      schemaHint: "{\"incomes\":[{\"name\":\"收入来源\",\"category\":\"类别\",\"amount\":11000}],\"monthlyIncome\":11000,\"fixedMonthly\":6800,\"baseBalance\":38400,\"investAssets\":15000,\"notes\":{\"income\":\"...\",\"savings\":\"...\",\"invest\":\"...\",\"spending\":\"...\"},\"dailyPool\":[{\"items\":\"当天买了啥\",\"amount\":42}],\"gifts\":[{\"date\":\"6月20日\",\"name\":\"送了什么\",\"amount\":200}]}"
    }
  };
  const spec = S[key] || {
    instruction: "推演内容",
    schemaHint: "{}"
  };
  // 取材层 + 时间窗 + 不许复读：三样都拼在 instruction 上。
  // 拼在这里而不是各 app 的 instruction 里，是为了【四处一样喂】——
  // 新加一个 app 时不必记得手动补，漏不掉（.claude/rules/four-surfaces-same-context.md）。
  const angle = PHONE_ANGLE[key] ? "\n\n" + PHONE_ANGLE[key] : "";
  // 输出天花板统一给满（同 StylePresets.OUT_CEILING / trpg 的 TOK_MAX）。
  // max_tokens 是【天花板】不是预付款：她按次计费，给大了不多花一分钱，给小了才要命——
  // 思考型模型的推理 token 也从这里扣，压小了推理吃完、正文只剩两百来字。
  // 以前这里每个 app 各写一个数（2200~30000），相册和微信被截断过就是因为那个数拍小了。
  // 控制篇幅的活儿交给 instruction 里写的条数和字数，不是拿额度去掐。
  // 已经钉死的身份（号码/账号/住址/忌口）原样发回去，让新写的内容跟它对得上——
  // 光在存的时候覆盖回去不够：模型不知道收货地址是哪儿，编的订单会送去别处，
  // 界面上一半是钉死的旧地址、一半是新编的，比不钉还乱。
  return { ...spec, maxTokens: PHONE_OUT_CEILING, instruction: spec.instruction + angle + phoneMoneyBlock(key, money) + phoneIdentityBlock(key, known) + phoneEvolveBlock(key, known) + phoneRosterBlock(key, known) + phoneSelfAvoidBlock(key, known) + phoneAvoidBlock(avoidLines) + (weekly ? PHONE_WEEKLY_HINT : "") };
}
