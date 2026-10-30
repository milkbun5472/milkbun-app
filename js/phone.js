// ============================================================
// 查手机 — 仿 iOS 桌面：锁屏 → 桌面 → 各 app。生成的那些各自独立刷新；
// 论坛/音乐/日历/匿名信箱读 App 里的真数据；时间线不生成，只把翻出来的碎片按时间串起来。
// ============================================================
// 独立 Node 工具与浏览器使用同一份称呼规则；网页由 index.html 先加载。
if (typeof module === "object" && module.exports) require("./character-pronoun.js");
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
  // 邮件：TA对外那一面。跟微信不撞车——微信是熟人和随口，邮件是**正式的**：
  // 工作、账单、订阅、学校。真正有东西的是【正式腔和TA私下说话的落差】。
  key: "mail",
  zh: "邮件"
}, {
  // 账本：TA心里那本没结清的账。跟钱包不是一回事——钱包记钱，这儿记
  // 没结清的东西（欠着的、替谁挡过的、放过的狠话、舍不得的、拿不准的）。
  // 账是跟【谁】的都行，用户只是其中一个人。
  key: "tally",
  zh: "账本"
}, {
  // 角色自己的匿名树洞。这里接 x_anon 真数据，不让查手机另编一套假箱子。
  key: "anon",
  zh: "匿名信箱"
}, {
  // 时间线不推演任何东西，它只把上面那些 app 已经翻出来的碎片按时间串起来。
  // 所以它同时属于 PHONE_LIVE_KEYS（不调模型、不进 phones）。
  key: "timeline",
  zh: "时间线"
}, {
  // 星测（她 2026-10-05）：TA 那天打开星测看到的运势和跟你的配对。按生日算、不调模型，
  //   所以跟日历、论坛一样是 PHONE_LIVE_KEYS——日子取 TA 上一次真打开的那天（刷新或看TA玩时点开）。
  key: "astro",
  zh: "星测"
}];
const PHONE_LABEL = PHONE_APPS.reduce((o, a) => (o[a.key] = a.zh, o), {});
// 接真数据的 app：不调模型、不存进 phones，直接读 App 里那份真的。
// 论坛读 x_forumPosts（TA真发过的帖，连小号和匿名一起），
// 音乐读「一起听」里归到TA名下的那张歌单（点开就能放）。
// 以前这两个各自另生成一份，等于同一个人有两套互不相干的论坛痕迹和歌单，
// 而且手机里那份点不动、也不会因为TA真去发帖而变。
const PHONE_OUT_CEILING = 65000;   // 同 StylePresets.OUT_CEILING；中转会自行 clamp 到模型上限
// 日历接的是 App 里那份真的（x_calendar 里TA自己的那格 + 带时刻的日程 + TA答应过她的事），
// 不再另生成一份假的——翻到角色日历上真的写着某一天有事，比生成出来的任何一条都重。
const PHONE_LIVE_KEYS = ["forum", "music", "calendar", "anon", "timeline", "astro"];
// 桌面上那几个【不是 app 的动作格】：点了是干一件事，不是进一个 app。
// ⚠️名单要有个名字，别在 deskWidget 和两个测试里各写死一个 "refresh"——
//   v66.18 加「看TA玩」时，那三处正好一处不落地全红了一遍（一层写在三处的现成一例）。
const PHONE_ACTION_WIDGETS = ["refresh", "watch"];
const phoneStableHash = value => [...String(value || "?")].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);

// ─────────────────────────────────────────────────────────────
// 时间线：把 16 个 app 的碎片按时间串成一条线
// ─────────────────────────────────────────────────────────────
// 单看每个 app，里面那些条目都挺平的：一通未接来电、一段没发出去的话、一个
// 深夜看完的视频、一条只有两个字的便签。可它们都带时间——按时间排一下，
// 就是TA一个晚上的完整心路。这一层不生成任何新内容，只是把已经翻出来的东西
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

  A(g("notes").items).forEach(x => x && push("notes", x.kind === "voice" ? "录音" : "便签", x.time, x.title, x.kind === "voice" && typeof ttsMarkStrip === "function" ? ttsMarkStrip(x.body) : x.body));

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
// 钱：花钱的那几个 app 得知道TA有多少钱
// ─────────────────────────────────────────────────────────────
// 钱包那边算着TA的存款、月收入、固定支出，购物和外卖却各编各的价钱——
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
  let out = "\n\n【TA的钱】" + bits.join("；") + "。";
  if (money.spendingNote) out += "TA对花钱的态度：" + String(money.spendingNote).slice(0, 200);
  out += "\n**金额必须落在这个水平上**：买不起的东西TA就是买不起，别让TA随手下单一笔够TA过半个月的单子。"
    + "手头紧的时候，想买清单会变长、真下单的会变少——那种落差本身就是内容。"
    + (n(money.balance) != null && n(money.balance) <= 0 ? "TA现在已经透支了：这一轮不该有任何非必需的下单。" : "");
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
//      **不许硬钉死**：关系会长，人会搬家，评价会变——钉死等于TA永远拿
//      第一次见面的眼光看她（Codex 2026-08-29 指出，是我做错了）。
//   📚 累积日志 PHONE_GROW —— 发生过的事，新旧合并去重，满了挤掉最旧的。
//   ♻️ 当前快照（不登记 = 默认）—— 只表示此刻：购物车、在途、开着的标签页、
//      今天的健康、常联系人、黑名单、关注列表。
//
// 判据两问：
//   一、这一栏变了，是「TA变了」还是「系统忘了」？系统忘了 → 🔒 或 🌱。
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
  // 「对你的评价」尤其不能钉死——钉死就是关系长了TA还拿第一次的眼光看你
  // 朋友圈签名和封面走这一档（她 2026-09-03 点名「最慢那一档」）：
  // 一个人的签名和封面确实不是每天换，但也不是一辈子不换——真钉死（🔒）就成了
  // 「TA这辈子只写过这一句」。所以 🌱：默认原样沿用，心境真变了才动。
  wechat: ["me.wechatName", "me.signature", "me.cover", "userContact"],
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
// ⚠️这是【每个 app 各一个计数器】，不是整次刷新的总额：带 🌱 的有八个 app，
//   所以一次完整刷新真正能动的是这个数的八倍。
// 2 → 4（她 2026-09-14）。2 是按「她一天随手刷好几次」定的，可购物有六项、
//   外卖有八项，真要换一轮得等三四次刷新；而每周例行那一次中间隔了整整一周，
//   只准动两项就太紧了——一周里换个签名、搬个家、口味变了都很正常。
const PHONE_EVOLVE_CHURN = 4;

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
// 🔒 要喂回提示词：不然模型不知道TA的账号是什么，编的内容跟钉死的对不上
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
  return "\n\n【这几项是TA的身份，原样照抄回来，一个字都不要改】\n" + lines.join("\n");
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
  return "\n\n【这几项是TA现在的样子，默认照抄回来】\n" + lines.join("\n")
    + "\n它们不是永远不能变——**关系真的变了、TA真的搬了家、口味真的换了，就该跟着变**。"
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
  // 「只更新说的话」那一路里，朋友圈和公众号照旧当日志并进来（会话不走这儿）
  _wechatRest: { moments: 14, "me.accounts": 12 },
  notes: { items: 24 },
  calls: { calls: 30, sms: 20, voicemail: 12, frequent: 12, blocked: 10 },
  browser: { searches: 44, marks: 14, private: 10 },
  shopping: { orders: 36, wish: 24, viewed: 24, shops: 10, gifts: 20 },
  takeout: { orders: 36, shops: 10, wish: 16 },
  // 相册的收口交给 phoneAlbumTidy（要先判重、再按五类保底分配额）。
  // 在这一步就砍到 80 的话，数量少的那一类会先被挤掉，保底就没得保了。
  // 病历夹：一次就诊就是一条，攒着看（她 2026-09-01 定的那个变体）
  health: { visits: 12 },
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
  // 这里只数【日历上的天】，不能拿本地时间戳直接除以固定 7 天：春季换夏令时的
  // 那一周只有 167 小时，会和前一周撞成同一个 key，整周例行刷新因此被跳过。
  // 把年月日投到 UTC 只是为了得到稳定的日序号，不改变“周一按手机当地日期起算”的定义；
  // 没有夏令时的地区结果与旧算法一致。
  const year = x.getFullYear();
  const mondayDay = Date.UTC(year, x.getMonth(), x.getDate());
  const yearStartDay = Date.UTC(year, 0, 1);
  return year + "-W" + String(Math.floor((mondayDay - yearStartDay) / 604800000) + 1).padStart(2, "0");
}
// 周刊式刷新时告诉模型取材的时间窗。平时手动刷不发这一段。
const PHONE_WEEKLY_HINT = "\n\n【这一次是每周一次的例行刷新】写的是**过去这一周**新发生的事，"
  + "不是从头再编一遍TA这个人。上面列出来的旧东西该留的留着，你补的是这七天里多出来的那些。"
  + "一周该有一周的量：不必每一栏都塞满，有些栏这一周本来就没什么新的。";

// ── 健康的趋势：另存每日轻量快照，不把整份报告天天累计 ──────
// 健康这个 app 从 v59.44 起是【两层】的，两层各走各的（她 2026-09-01 定的变体）：
//   · visits 病历夹 → 📚 累积。一次就诊就是一条，攒着看；间隔由代码兜死。
//   · 其余全部（cards / timeline / since / tail）→ ♻️ 照旧每次重写。
//     它们说的是【今天身上什么样】，不是发生过什么。
// 「这一周睡得怎么样」还是想知道，所以每次刷新另抽一条极轻的快照：
// 几个核心指标（跟的是 num——把读数折成的那个整数），一天一条，留 90 天。
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
    // v59.44 起卡片不再有 score（记分板撤了），走势跟的是 num——
    // 把这一项的读数折成 0-100 的那个整数。老存档里还有 score 的照旧认。
    const v = Number(c.num != null ? c.num : c.score);
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
  // ⚠️「常去的那几家」是名册，不是日志（她 2026-09-01 同意改）。
  // 它答的是「现在常去哪几家」，不是「发生过什么」——按第二问就该走名册这一路。
  // 原来挂在纯累积层：模型每轮凭空写四五家新店，一路攒到十八家，
  // 那不是「TA常去的店」，那是「TA去过的所有店」。而且TA真的不去了的那几家永远退不出。
  // 走名册＝【还在的原样照抄回来 + 不去了的写进 retired】，跟书签、想买清单一个形状。
  shopping: { wish: "想买清单", shops: "常去的店" },
  // 想吃的／想买的：买到手或不惦记了就该退出，同理
  takeout: { wish: "想吃的", shops: "常去的店" },
  // 便签会被划掉、会写完就撕、事情办完了就没用了——是名册不是日志（她 2026-09-01 定）
  notes: { items: "便签" },
  browser: { marks: "书签" },
  liked: { follows: "关注的人", drafts: "草稿箱" },
  calls: { frequent: "常联系", blocked: "黑名单" },
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
// 「这封存了多久」那一句（她 2026-09-06 抓到「已经存了 9月3日」）。
// 病根：savedAt 问的是【存了多久】（一段时长），可 phoneFreezeTime 会把
// 「存了三天」这种相对写法冻成绝对日期——冻是对的（放两周之后「存了三天」就是谎话），
// 错的是【冻完之后那句话没跟着变】：时长的句式套在日期上就成了病句。
// 所以这句话自己算：冻过的行身上有 _ts，用它现算天数；没有 _ts 就按 savedAt
// 长什么样挑句式，绝不硬往「已经存了 X」里塞。
function phoneKeptLine(x, nowTs) {
  const raw = String((x && x.savedAt) || "").trim();
  const ts = x && x._ts;
  if (ts != null && Number.isFinite(Number(ts))) {
    const d = Math.floor(((nowTs || Date.now()) - Number(ts)) / 86400000);
    if (d <= 0) return "今天存下的，还没发。";
    return "已经存了 " + d + " 天。";
  }
  if (!raw) return "";
  // 冻成日期了（9月3日 / 2025年3月1日 / 3-1）：那就用日期的说法
  if (/\d+\s*月|\d{4}\s*年|\d{1,2}\s*-\s*\d{1,2}/.test(raw)) return raw + "写下的，一直没发。";
  // 模型自己写的时长：可能带「存了」也可能不带，别拼成「已经存了存了三天」
  // 空格只在数字前面加（「存了 11 天」好看，「存了 三天」难看）
  return /^(存|放|搁)/.test(raw) ? "已经" + raw + "。" : "已经存了" + (/^\d/.test(raw) ? " " : "") + raw + "。";
}
const phoneTimeField = x => (x && typeof x === "object") ? PHONE_TIME_FIELDS.find(k => typeof x[k] === "string" && x[k].trim()) : undefined;
// 一行的身份：由内容决定，不用模型自己编的 id（那玩意儿每次都变，或者反过来撞车）
const phoneRowKey = x => {
  if (!x || typeof x !== "object") return String(x);
  // 只认【一个】标识字段 + 时刻。取两个的话，正文改一个字就成了新的一条——
  // 模型重写同一件事时措辞总会变，那样永远认不出是同一条，会攒成两份。
  // ⚠️who 放在最后：只有【前面这些一个都没有】的行才靠它认人（病历就是这种，
  // 它只有 who/chief/exam…）。放前面会抢掉礼物那类本该按 title 认的行。
  const word = ["title", "caption", "q", "text", "content", "main", "shop", "name", "body", "excerpt", "transcript", "from", "author", "number", "who"]
    .map(k => (typeof x[k] === "string" ? x[k].trim() : "")).filter(Boolean)[0];
  const f = phoneTimeField(x);
  return (word || JSON.stringify(x).slice(0, 90)) + "@" + (f ? x[f] : "");
};
// 这部手机的「现在」：开了虚拟时间就照 TA 那张面具的钟（群里 2026-10-31：小手机设的是 25 号，邮件却刷成了 30 号——
//   模型照钟写的「今天 09:15」，存的时候拿现实的今天去换算，就落成了现实的日子）。存、归档、排序、显示都问这一处
function phoneNow(charId) { return charId && typeof vclockMap === "function" ? vclockMap(Date.now(), charId) : Date.now(); }
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
// 会话列表那一栏的时刻。聊天列表有它自己的读法，跟朋友圈那种「3小时前」不是一回事：
// 今天只写几点、昨天就写「昨天」、更早写日期。**同一屏里必须是同一种写法**——
// 她 2026-09-01 报的「日期有 bug」，一半病在这儿：模型写回来的是什么就显示什么，
// 于是「8月30日 23:45」「14:45」「8月29日」三种写法并排站着，读的人根本没法比较先后。
// 有 _ts 就现算（存着的那句话会过期），没有才退回原话。
function phoneChatWhen(x, nowTs) {
  if (!x || typeof x !== "object") return "";
  const f = phoneTimeField(x);
  const raw = f ? String(x[f] || "").trim() : "";
  if (x._ts == null) return raw;
  const d = new Date(x._ts), n = new Date(nowTs == null ? Date.now() : nowTs);
  const mid = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const yesterday = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1).getTime();
  if (x._ts >= mid) return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  if (x._ts >= yesterday) return "昨天";
  return (d.getFullYear() !== n.getFullYear() ? d.getFullYear() + "年" : "") + (d.getMonth() + 1) + "月" + d.getDate() + "日";
}
// 新的并进旧的：新的在前（同一条以新的为准），有时刻的按时间倒序，攒到上限挤掉最旧的
// ⚠️模型会把 schemaHint 里的占位说明【原样抄进数据】。
// 她 2026-09-01 截图里「想吃清单」有三条的「什么时候会想起它」是灰的——那不是空，
// 那就是 schemaHint 里 "when":"什么时候会想起它" 被逐字抄了回来，还把上一轮真写的
// 那句盖掉了。这跟 施工规则/prompt-no-content-samples.md 是同一件事的另一半：
// 占位值写成【说明】仍然挡不住照抄，**规则降概率，代码才保证**。
// 做法不挑字段、不写死名单：把这个 app 自己那份 schemaHint 里所有字符串叶子收集起来，
// 生成结果里凡是跟其中一条【一模一样】的字符串，一律当成没写。
// 只认全等，不认包含——真话里碰巧含着占位词的不该被误伤。
function phoneEchoSet(schemaHint) {
  const out = new Set();
  const walk = v => {
    if (typeof v === "string") { const t = v.trim(); if (t) out.add(t); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === "object") { Object.keys(v).forEach(k => walk(v[k])); }
  };
  try { walk(JSON.parse(schemaHint)); } catch (e) { return out; }
  return out;
}
function phoneDropEchoes(data, schemaHint) {
  const echo = phoneEchoSet(schemaHint);
  if (!echo.size) return data;
  const clean = v => {
    if (typeof v === "string") return echo.has(v.trim()) ? "" : v;
    if (Array.isArray(v)) return v.map(clean).filter(x => !(typeof x === "string" && !x));
    if (v && typeof v === "object") { const o = {}; Object.keys(v).forEach(k => { o[k] = clean(v[k]); }); return o; }
    return v;
  };
  return clean(data);
}
// byName：这一栏是【名册】。名册的身份是**名字**，不是名字＋时刻——
// 同一件事被再提起一次，它还是那一件事。
// 不这么分的话，模型把便签照抄回来时随手改了 time，就会攒成两条一模一样的便签。
// 日志那几栏仍然认「名字＋时刻」：同一家店昨天去一次今天去一次，那本来就是两条。
function phoneGrowList(fresh, old, cap, nowTs, byName) {
  const A = a => Array.isArray(a) ? a : [];
  const now = nowTs || Date.now();
  const seen = {};
  const out = [];
  // ⚠️同一行在新旧两份里都出现时，【新的赢，但空的不许抹掉旧的】。
  // 这就是 🌱 那一层「空值不许抹掉旧值」同一条规矩，累积层一样要有：
  // 模型这一轮漏写了某一栏（想吃的那句「什么时候会想起它」最常漏），
  // 原来直接整行拿新的顶掉，上一轮真写的那句就没了。
  const at = {};
  A(fresh).concat(A(old)).forEach(x => {
    if (x == null) return;
    const frozen = (x && typeof x === "object") ? phoneFreezeTime(x, now) : x;
    // ⚠️取不出名字的行不能一律记成 "@"——那样它们会全部塌成一条。
    // 认不出名字就退回原来那把钥匙（名字＋时刻），宁可多留一条也不能吞掉别人。
    const nm = byName ? phoneNameNorm(phoneRowName(frozen)) : "";
    const k = nm ? ("@" + nm) : phoneRowKey(frozen);
    if (seen[k]) {
      const keep = out[at[k]];
      if (keep && typeof keep === "object" && frozen && typeof frozen === "object") {
        Object.keys(frozen).forEach(f => {
          const has = v => v != null && !(typeof v === "string" && !v.trim()) && !(Array.isArray(v) && !v.length);
          if (!has(keep[f]) && has(frozen[f])) keep[f] = frozen[f];
        });
      }
      return;
    }
    seen[k] = 1;
    at[k] = out.length;
    out.push((frozen && typeof frozen === "object") ? { ...frozen } : frozen);
  });
  // ⚠️认得出时刻的排前面（新→旧），认不出的原样留在后面。
  // 原来是【全都认得出才排序】——只要有一条的时间写成「周一」这种解析不出来的，
  // 整份就一次都不排，于是今天下午那条会掉在前天那条下面
  //（她 2026-09-01：「这个日期有 bug」，截图里 14:45 排在 8月30日 23:45 下面）。
  // 「一半有一半没有排完更乱」这个担心是真的，但止损方式不该是【一条都不排】：
  // 认得出的那些照旧按时间走，认不出的沉底、彼此保持原来的先后，一条都不会互相打乱。
  const known = [], unknown = [];
  out.forEach((x, i) => (x && typeof x === "object" && x._ts != null ? known : unknown).push(x));
  known.sort((a, b) => b._ts - a._ts);
  out.length = 0;
  known.forEach(x => out.push(x));
  unknown.forEach(x => out.push(x));
  return out.slice(0, cap || 30);
}
// 阅读单开一路：它是【两层】的（shelves[].books[]），上面那套平的配置盖不住。
// 不处理的话，书架名每刷一次全换（她 v57.47 专门要求书架名要有脾气，等于白要），
// 而且一架书永远只有生成那一轮的几本——攒不起来。
// 规矩：书架按名字认人，老架子留着；每架里的书累积；新长出来的架子接在后面。
const PHONE_SHELF_CAP = 8, PHONE_BOOK_CAP = 40;
// ⚠️书是【慢慢长的】，不是每周换一批（她 2026-09-01：「图书应该算慢慢改的那类，
// 不应该每周刷新的时候都更新，最多更新一下读到哪儿了和批注」）。
// 原来每一轮都让模型重出「正好 5 架 30 本」，累积层再把它们并进去——
// 结果不是那几本书往前读了，而是**每周凭空多出三十本新书**，一架很快就满四十本。
// 一个人的书架不该这样长。
// 所以例行刷新走另一条路：只回 updates（这一周TA真的动过的那几本），
// 按书名认人，只改 readAt 和 note，别的一概不动，也不许添新书。
// 动过的那几本盖上 _upd 时间戳，界面上给个红点——她要的「就在书上放个红点」。
function phoneApplyBookUpdates(oldData, updates, nowTs) {
  const A = a => Array.isArray(a) ? a : [];
  const norm = v => String(v == null ? "" : v).replace(/[\s《》「」"'·,，.。!！?？:：;；]/g, "");
  const want = {};
  A(updates).forEach(u => { const k = norm(u && u.title); if (k) want[k] = u; });
  let hit = 0;
  const shelves = A(oldData && oldData.shelves).map(sh => ({
    ...sh,
    books: A(sh && sh.books).map(b => {
      const u = want[norm(b && b.title)];
      if (!u) return b;
      const readAt = String(u.readAt || "").trim() || b.readAt;
      const note = String(u.note || "").trim() || b.note;
      // 两栏都没真变就别盖戳——不然红点会天天亮，等于没有
      if (readAt === b.readAt && note === b.note) return b;
      hit++;
      return { ...b, readAt: readAt, note: note, _upd: nowTs };
    })
  }));
  return { shelves: shelves, hit: hit };
}
// ── 微信：人是慢慢认识的，话是天天在说的（v59.54）──────────────────────
// 她 2026-09-01：「微信联系人，一开始只生成几个但是后续封顶了不应该生成新的，
// 而是在TA已有的联系人和群聊里更新说的话而已」。
// 原来每刷一次都要「另外生成正好 5 个互不相同的**新**会话」+「contacts 正好 5 个」，
// 累积层再并进去——三轮之后TA微信里就有十五个互不相干的会话、十五拨人。
// 那不是一个人的微信，那是十五份互不相干的样本。
// 跟书架同一个形状：**名单封顶之后，变的只是那几个会话里【又说了什么】。**
const PHONE_WECHAT_ENOUGH = 8;
function phoneApplyChatUpdates(oldData, updates, nowTs) {
  const A = a => Array.isArray(a) ? a : [];
  const norm = v => String(v == null ? "" : v).replace(/[\s（）()「」【】·,，.。!！?？:：;；]/g, "");
  const want = {};
  A(updates).forEach(u => { const k = norm(u && u.name); if (k) want[k] = u; });
  let hit = 0;
  const chats = A(oldData && oldData.chats).map(c => {
    const u = want[norm(c && c.name)];
    if (!u) return c;
    const add = A(u.messages).filter(m => m && (m.text || m.content));
    if (!add.length) return c;
    // 接着往下说：新消息追在后面，同一句话不重复攒
    const had = {};
    const old = A(c.messages);
    old.forEach(m => { had[String(m && m.from) + "|" + String(m && (m.text || m.content))] = 1; });
    // 这一批新说的话打上「哪一回刷新来的」（群里读者 2026-10-02：「查手机微信所有聊天内容没有时间戳，
    //   分不清从哪里开始是当天新的」）——会话里按这一批画一条时间分隔线，跟真微信一样。
    const batchLabel = String(u.time || "").trim();
    const fresh = add.filter(m => !had[String(m.from) + "|" + String(m.text || m.content)])
      .map(m => ({ ...m, _at: nowTs, ...(batchLabel ? { _atLabel: batchLabel } : {}) }));
    if (!fresh.length) return c;
    hit++;
    const msgs = old.concat(fresh).slice(-40);
    // 模型这一回没写时刻：就当是刚刚说的（她 2026-10-02 问「新的应该会到聊天的上面吧」——
    //   原来留着上一回的旧时刻，刚说完话的会话还停在原位）。
    const time = String(u.time || "").trim()
      || (function (d) { return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); })(new Date(nowTs));
    // ⚠️时刻变了，_ts 必须跟着重算。这一路不走 phoneGrowList，
    // 不重算的话它还留着上一轮那个时刻——会话列表就会把刚说完话的那个排到底下去
    //（v59.41 刚修好的那个病，从这儿又能漏回来）。
    const ts = (time !== c.time) ? phoneWhenTs(time, nowTs) : (c._ts != null ? c._ts : phoneWhenTs(time, nowTs));
    return { ...c, messages: msgs,
      last: String(u.last || "").trim() || (fresh[fresh.length - 1].text || fresh[fresh.length - 1].content || c.last),
      time: time, ...(ts != null ? { _ts: ts, _abs: undefined } : {}), _upd: nowTs };
  });
  return { chats: chats, hit: hit };
}
function phoneMergeShelves(oldData, newData, nowTs) {
  const A = a => Array.isArray(a) ? a : [];
  const oldSh = A(oldData && oldData.shelves), newSh = A(newData && newData.shelves);
  if (!oldSh.length) return newData;
  // 例行刷新那一路：模型只回 updates，架子和书目一本不动
  if (Array.isArray(newData && newData.updates)) {
    const r = phoneApplyBookUpdates(oldData, newData.updates, nowTs);
    return { ...oldData, ...(newData.archive ? { archive: newData.archive } : {}), shelves: r.shelves, _lastUpd: r.hit ? nowTs : (oldData && oldData._lastUpd) || 0 };
  }
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
  // 微信「只更新说的话」那一路：会话和联系人一个不增，只把新说的话接在后面
  if (appKey === "wechat" && Array.isArray(newData && newData.updates)) {
    const r = phoneApplyChatUpdates(oldData, newData.updates, nowTs);
    const keep = { ...oldData, chats: r.chats };
    // 关系网里新来的人（后来才绑的配角、后来才连上关系的角色）：只在提示里点了名时模型才会写 newChats，私聊、最多 3 个、已有的不重开
    const _nm = v => String(v == null ? "" : v).replace(/[\s（）()「」【】·,，.。!！?？:：;；]/g, "");
    const _have = new Set(keep.chats.map(c => _nm(c && c.name)));
    const _add = (Array.isArray(newData.newChats) ? newData.newChats : []).filter(c => c && c.name && !_have.has(_nm(c.name)) && Array.isArray(c.messages) && c.messages.length).slice(0, 3)
      .map(c => { const time = String(c.time || "").trim(); const ts = phoneWhenTs(time, nowTs); return { type: "private", name: String(c.name).trim(), last: String(c.last || "").trim() || String((c.messages[c.messages.length - 1] || {}).text || ""), time: time, messages: c.messages.slice(-40).map(m => ({ ...m, _at: nowTs })), ...(ts != null ? { _ts: ts } : {}), _upd: nowTs }; });
    if (_add.length) keep.chats = _add.concat(keep.chats);
    // 新开私聊的这几位也进通讯录，带着TA给对方起的备注（她 2026-10-21：保底塞进去的人没有备注）
    const _cHave = new Set((Array.isArray(keep.contacts) ? keep.contacts : []).flatMap(x => [_nm(x && x.name), _nm(x && x.remark)]));
    const _cAdd = (Array.isArray(newData.newChats) ? newData.newChats : []).filter(c => c && c.name && !_cHave.has(_nm(c.name)))
      .map(c => ({ name: String(c.name).trim(), remark: String(c.remark || "").trim(), intro: String(c.intro || "").trim() }));
    if (_cAdd.length) keep.contacts = (Array.isArray(keep.contacts) ? keep.contacts : []).concat(_cAdd);
    // 朋友圈和公众号仍是【发生过的事】，照旧并进来
    const merged = phoneGrowMerge("_wechatRest", { moments: (oldData || {}).moments, me: (oldData || {}).me },
      { moments: newData.moments, me: newData.me }, nowTs);
    if (Array.isArray(merged && merged.moments)) keep.moments = merged.moments;
    if (newData.me && typeof newData.me === "object") keep.me = { ...(oldData || {}).me, ...newData.me };
    return keep;
  }
  const conf = PHONE_GROW[appKey];
  if (!conf || !newData || typeof newData !== "object") return newData;
  const out = JSON.parse(JSON.stringify(newData));
  const now = nowTs || Date.now();
  const retired = (newData && newData.retired && typeof newData.retired === "object") ? newData.retired : {};
  const roster = PHONE_RETIRE[appKey] || {};
  Object.keys(conf).forEach(field => {
    const fresh = phoneGetPath(out, field);
    const old = oldData ? phoneGetPath(oldData, field) : null;
    if (!Array.isArray(fresh) && !Array.isArray(old)) return;
    let list = phoneGrowList(fresh, old, conf[field], now, !!(roster && roster[field]));
    // 墓碑：模型显式说这几个已经不在名单上了
    const gone = (Array.isArray(retired[field]) ? retired[field] : []).map(phoneNameNorm).filter(Boolean);
    if (gone.length) list = list.filter(x => gone.indexOf(phoneNameNorm(phoneRowName(x))) < 0);
    phoneSetPath(out, field, list);
  });
  delete out.retired;    // 它是一条指令，不是要存下来的内容
  return appKey === "album" ? phoneAlbumTidy(out, now) : out;
}
// ── 走乙：TA自己刷出来的那几行，周刷不许凭空重编（她 2026-09-10 选的「乙」）──
// 「看TA玩」之后，这个 app 就变成【有底稿的 app】。可它写进去的那几栏偏偏是 ♻️：
// 开着的标签页、购物车、还在路上的那一单——♻️ 的规矩是每次照实重写，
// 于是下一次周刷会把TA刚开的那一页、刚放进车里的那件东西，凭空抹掉。
//
// 「甲」是周刷绕开TA碰过的 app（那一周整个 app 不刷了，太粗）；
// 「乙」是她选的：**那几行留住，别的照旧重编**。这就是乙在代码里的落法——
// 提示词那一段（phoneWatchDraftBlock）告诉模型它们存在，这一层兜死它们不会没。
//
// ⚠️只保【TA真做过的那几行】，不是整栏冻住：栏还是 ♻️，周刷照常重写其余部分。
// ⚠️会过期。八天＝比一周长一点，正好让下一次周刷还认得上一周TA干的事；
//   再往后那一页早该关了、那一单早该到了，还留着就成了坟场。
const PHONE_WATCH_KEEP = {
  browser: { tabs: 12 },
  // shipping v68.31 补登记（抽卡的事件种子往这儿种一件在路上的东西）。
  // 判据还是那一句：**周刷会把他刚做的那一下重写掉吗？** 在途是 ♻️ 当前快照、每次照实重写，
  // 所以种进去的那一行第二天就没了——盖上 _wk 戳它才留得住。
  // ⚠️还是只保【盖过戳的那几行】，不是把整栏冻住：这一栏照旧是 ♻️。
  shopping: { cart: 12, shipping: 6 },
  takeout: { live: 6 }
};
const PHONE_WATCH_KEEP_DAYS = 8;
const phoneWatchRows = (data, field, nowTs) => {
  const arr = phoneGetPath(data, field);
  if (!Array.isArray(arr)) return [];
  const now = Number(nowTs) || Date.now();
  return arr.filter(x => x && typeof x === "object" && x._wk
    && (now - (Number(x._wkAt) || Number(x._ts) || 0)) <= PHONE_WATCH_KEEP_DAYS * 86400000);
};
function phoneWatchKeep(appKey, oldData, newData, nowTs) {
  const conf = PHONE_WATCH_KEEP[appKey];
  if (!conf || !oldData || !newData || typeof newData !== "object") return newData;
  const out = JSON.parse(JSON.stringify(newData));
  Object.keys(conf).forEach(field => {
    const mine = phoneWatchRows(oldData, field, nowTs);
    if (!mine.length) return;
    const fresh = phoneGetPath(out, field);
    const seen = {};
    mine.forEach(x => { seen[phoneNameNorm(phoneRowName(x))] = 1; });
    // TA做过的那几行排在最前面（那是【刚刚】发生的），模型新写的接在后面；
    // 同名的以TA那一行为准——不然屏幕上同一件东西会出现两遍。
    const rest = (Array.isArray(fresh) ? fresh : []).filter(x => !seen[phoneNameNorm(phoneRowName(x))]);
    phoneSetPath(out, field, mine.concat(rest).slice(0, conf[field]));
  });
  return out;
}
// 这几行也要喂回提示词：代码兜死它们不会没，但模型不知道它们存在的话，
// 会写出一份跟屏幕上对不上的东西来（规则降概率，代码才保证，两头都要）。
function phoneWatchDraftBlock(appKey, known, nowTs) {
  const conf = PHONE_WATCH_KEEP[appKey];
  if (!conf || !known) return "";
  const lines = [];
  Object.keys(conf).forEach(field => {
    const names = phoneWatchRows(known, field, nowTs).map(phoneRowName).filter(Boolean).slice(0, 12);
    if (names.length) lines.push("- " + field + "：" + names.join("｜"));
  });
  if (!lines.length) return "";
  return "\n\n【这几样是TA自己刚在手机上弄出来的】\n" + lines.join("\n")
    + "\n它们不是编出来的，是TA真做过的那一下——**别当成旧数据清掉，也别改写名字**。"
    + "你这一轮写的别的东西要和它们对得上（同一件东西别再写一遍）。";
}
// 存进去的那一份：新生成的 + 沿用的身份 + 并进来的日志 + TA自己刷出来的那几行
function phoneMergeSaved(appKey, oldData, newData, nowTs) {
  // 顺序：🔒 硬钉死盖回来 → 🌱 缓慢演化收口 → 📚 日志并进来 → 走乙留住TA做过的。
  // 剩下没登记的一律 ♻️ 照实重写。
  // ⚠️走乙排在最后：它要盖的正是 ♻️ 那一步的结果，排在前面会被随后的重写抹掉。
  return phoneWatchKeep(appKey, oldData, phoneGrowMerge(appKey, oldData,
    phoneEvolveMerge(appKey, oldData, phoneKeepIdentity(appKey, oldData, newData)), nowTs), nowTs);
}
// 名册发回去。跟 phoneSelfAvoidBlock 说的是相反的话：
// 日志那些「别再写一遍」，名册这些「还在的请照抄回来」。
// ── 多久才该再看一次大夫（v59.44）────────────────────────────────────────
// 她 2026-09-01 定的形状：大夫的话是【低频、有日期、会累积的】，每天变的只是读数。
// 「别每次都写一条新就诊」写在提示词里只是降概率——模型高兴起来天天送TA去医院。
// 所以间隔由代码说了算：离上一次不够久，这一轮生成的 visits 一律丢掉，旧的照旧留着。
// 例外：一条都没有的时候必须让它写第一条，否则这个 app 永远是空的。
// 14 天＝整两周（她 2026-09-01 定）：**跟每周自动刷那条链对齐**——
// 每周补刷一次的话，每隔一次那一刷正好能带上一条新的就诊，不用另开一条时机。
// 12 天会跟周次错开，某几周赶得上、某几周赶不上，看着像随机。
const PHONE_VISIT_GAP_DAYS = 14;
function phoneVisitDays(known) {
  const list = (known && Array.isArray(known.visits)) ? known.visits : [];
  let newest = 0;
  list.forEach(v => {
    const t = v && v.date ? Date.parse(String(v.date).replace(/年|月/g, "-").replace(/日/g, "")) : NaN;
    if (isFinite(t) && t > newest) newest = t;
  });
  if (!newest) return null;
  return Math.floor((Date.now() - newest) / 86400000);
}
// ⚠️这三档必须【整段分开写】，不能共用一句收尾。
// 她 2026-09-01：「之前有旧数据刷新了一直不看大夫」——病因就在这儿：
// 原来三档共用一句加粗的「**不写就给空数组，别硬凑**」，而「TA从没看过大夫，写第一次」
// 只是一句轻飘飘的陈述。**最响的那句话赢**，何况这一轮本来就要吐十六张卡，
// 给空数组是最省事的路，于是病历夹永远开不了张。
// 跟主动消息那次是同一个病：一条强否定压在一条弱肯定后面，模型只听得见否定那句。
// 现在：没看过 = 命令句、没有退路；到期 = 可以但不强求；刚看过 = 禁止。
function phoneVisitHint(known) {
  const days = phoneVisitDays(known);
  if (days == null) {
    return "TA的病历夹是空的，从没有过一条记录。**这一轮必须写出正好一条**——"
      + "写TA最近一次去看大夫的那一回（哪天由你定，不必是今天）。**这一档不许给空数组。**";
  }
  if (days >= PHONE_VISIT_GAP_DAYS) {
    return "TA上一次看大夫是 " + days + " 天前。这一次可以再看一回，写就正好一条——"
      + "**但只有TA身上真有事才去**，没事就给空数组，别硬送TA去医院。";
  }
  return "TA " + days + " 天前刚看过大夫。**这一轮不要写新的就诊记录，visits 给空数组。**";
}
// 存之前再筛一遍：离上次不够久的新就诊直接丢掉（旧的由累积层留着）
function phoneGateVisits(data, known) {
  if (!data || typeof data !== "object" || !Array.isArray(data.visits) || !data.visits.length) return data;
  // ⚠️先扔掉【空壳】：schemaHint 里的占位词被照抄回来时，phoneDropEchoes 会把它们
  // 洗成空串，剩一个什么都没有的对象。让它进病历夹就是一张空白病历，比没有更糟。
  const real = data.visits.filter(v => v && typeof v === "object"
    && [v.who, v.chief, v.exam, v.impression, v.orders].some(x => String(x || "").trim()));
  if (!real.length) return { ...data, visits: [] };
  const days = phoneVisitDays(known);
  if (days == null || days >= PHONE_VISIT_GAP_DAYS) return { ...data, visits: real };
  return { ...data, visits: [] };
}
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
  return "\n\n【TA这几份名单上现在有这些】\n" + lines.join("\n")
    + "\n**还在名单上的请原样照抄回来**（连名字一起，别改写），这几份是「现在有哪些」不是「这次新增了哪些」。"
    + "\n**已经不在了的，写进 retired**：取消收藏的书签、发出去或删掉的草稿、取关的人、放出黑名单的人、买到手或不想要了的东西、**已经不去了的那家店**、**划掉或者事情办完了的便签**。"
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
// 清空重生：把某个 app 存的那份整个删掉，下一次刷新从零开始写
// ─────────────────────────────────────────────────────────────
// 她 2026-09-14：人设里的英文去掉了，查手机还是接着写英文。
// 病根是刷新【从来不是从零开始】——旧那份会原样发回去当料（见 phoneLangBlock 那一段）。
// 语言那一层是治本的，这一层是止血的：她哪天彻底不想要这个 app 现在这副样子了，
// 得有个出口能把它整份扔掉，而不是只能一遍遍刷、指望它自己走出来。
// ⚠️连归档一起清：时间线上那一份是从这个 app 抽出来的，留着的话「清空」之后
//   界面上照样翻得到旧的那几条，看起来就像没清干净。
// ⚠️别的角色、别的 app 一个字都不许动——这是全库唯一会主动删数据的地方。
function phoneResetApp(store, charId, key) {
  const m = (store && typeof store === "object") ? store : {};
  if (!charId || !key || !m[charId]) return m;
  const mine = { ...m[charId] };
  if (!(key in mine)) return m;
  delete mine[key];
  return { ...m, [charId]: mine };
}
// 归档里属于这个 app 的那几条一起走
function phoneArchDropApp(list, key) {
  if (!Array.isArray(list)) return [];
  return list.filter(r => !(r && r.app === key));
}
// 清空三张表走同一条可验证写入链；失败回放旧快照，调用方持锁到回滚结束。
async function phoneResetStored(charId, key, read, commit) {
  const keys = ["x_phone", "x_phoneArch"].concat(key === "health" ? ["x_phoneVitals"] : []);
  const before = keys.map(k => read(k, {}));
  const after = [phoneResetApp(before[0], charId, key),
    { ...before[1], [charId]: phoneArchDropApp(before[1][charId], key) }];
  if (key === "health") { const v = { ...before[2] }; delete v[charId]; after.push(v); }
  const attempted = [];
  try {
    for (let i = 0; i < keys.length; i++) {
      attempted.push(i);
      const result = await commit(keys[i], after[i]);
      if (!result || !result.durable || !result.live) throw new Error("clear not durable");
    }
    return { ok: true };
  } catch (e) {
    let restored = true;
    for (const i of attempted.reverse()) {
      try { const r = await commit(keys[i], before[i]); if (!r || !r.durable || !r.live) restored = false; }
      catch (err) { restored = false; }
    }
    return { ok: false, restored };
  }
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
// 一个词在这部手机里出现在哪儿。词不区分大小写、去掉空白再比。
// ── 界面上的称呼（v58.88，她 2026-08-31：「把所有查手机里的『他』换成跟着实际性别走」）──
// 提示词那一半 v58.86 已经从 phoneProbeSpec 一处过掉了。这一半是【界面标签】：
// 「TA的订单」「TA为什么想买」这类写死的字面量，一百五十多处。
// 一个人的手机同一时刻只看得了一份，所以记一个模块级的「现在在看谁」就够了，
// 不用把称呼一路穿过几十个组件的 props。
let PHONE_VIEW_TA = "TA";
// T("TA的订单") → 按现在这台手机的主人换称呼；默认「TA」时原样返回，一个字不动。
function T(s) { return characterText({ gender: PHONE_VIEW_TA }, s); }
function phoneImage(ref) {
  if (!ref) return "";
  return typeof resolveImg === "function" ? (resolveImg(ref) || "") : String(ref);
}
// ⚠️只是个转交口：真正的换算和符号全在 js/money.js 那一份里
//   （她 2026-09-18：「把钱收入公共然后后续任何交易都走一层汇率」）。
//   第二个参数是【这是谁的钱】——不给就是人民币，跟以前一模一样。
//   别在这儿补规则，也别在页面里自己拼 "¥" + n：那就又是一层活在两处。
const fmtMoney = (n, charId) => (typeof Money !== "undefined" && Money)
  ? Money.fmt(n, charId)
  : "¥" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
function PGlyph({
  k,
  size = 26,
  color = "#1b1a17",
  wk
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
    anon: [P("M4 5.2h16v11.2H9l-5 4z"), P("M8.2 9.2h7.6M8.2 12.4h4.8"), P("M18.4 3.2l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z")],
    mail: [R(2.6, 5, 18.8, 14, 2.6), P("M2.6 7.2l9.4 6.4 9.4-6.4")],
    astro: [C(12, 12, 8.5), P("M12 5.5l1.3 3.9 4.1.1-3.3 2.4 1.2 3.9L12 13.5l-3.3 2.3 1.2-3.9-3.3-2.4 4.1-.1z")],
    settings: [C(12, 6, 2), C(12, 18, 2), C(6, 12, 2), P("M3 6h7M14 6h7M3 18h7M14 18h7M3 12h1M8 12h13")]
  };
  return h(Svg, {
    size,
    color,
    wk,
    sw: 1.5
  }, ...(kids[k] || []));
}
// 收藏仍独立存在 x_phoneKeep，刷新推演只换本轮相册，不覆盖她留下的收藏。
// 一张照片的指纹：id 优先；没有 id 的旧数据用内容指纹。不要把本轮数组下标写进去，
// 否则同一张照片在下次刷新排序变化后会被误当成另一张。
// ⚠️模块级函数，不是 AlbumView 里的局部量——App 那边画完真图要按同一个指纹
//   把图挂回 x_phoneKeep 的那条记录上，两处必须是同一套算法。
function phonePhotoSig(p) {
  p = p || {};
  return p.id || (p.caption || "") + "|" + (p.date || p.time || "") + "|" + (p.desc || "");
}
// ── 两个「我收着的」分开住（她 2026-10-06 群友：「为什么我收藏的照片都没有了，我没有换设备呀」）──
//   相册收藏原来跟动态那颗「收着」共用 x_phoneKeep 一把键，形状还不一样：
//     相册：x_phoneKeep[charId] = [照片, …]      动态：x_phoneKeep[charId] = { 条目id: 1 }
//   查手机一打开就把整份读进手里；之后在动态里点一下「收着」，它拿那份旧的整份写回去——
//   这个人的照片数组被摊成 { "0": 照片, "1": 照片, 条目id: 1 }，相册认不出＝0 张；
//   别的人在那之后新收的照片也一并被旧快照盖回去。
//   现在：动态那份搬去 x_phoneTlKeep；相册读的时候把被摊开的那几张认回来（数字键＋值是对象的就是照片）。
function phoneKeptPhotos(v) {
  if (Array.isArray(v)) return v.filter(x => x && typeof x === "object");
  if (v && typeof v === "object") return Object.keys(v).filter(k => /^\d+$/.test(k)).sort((a, b) => a - b)
    .map(k => v[k]).filter(x => x && typeof x === "object");
  return [];
}
// 动态那份：有自己的键就用；没有就从混住的老 x_phoneKeep 里拆一次（值是 1 的才是动态条目）
function phoneTlKeepLoad() {
  const own = typeof loadJSON === "function" ? loadJSON("x_phoneTlKeep", null) : null;
  if (own && typeof own === "object" && !Array.isArray(own)) return own;
  const old = (typeof loadJSON === "function" ? loadJSON("x_phoneKeep", {}) : {}) || {};
  const out = {};
  Object.keys(old).forEach(cid => {
    const v = old[cid];
    if (!v || typeof v !== "object" || Array.isArray(v)) return;
    const box = {};
    Object.keys(v).forEach(k => { if (v[k] === 1) box[k] = 1; });
    if (Object.keys(box).length) out[cid] = box;
  });
  if (typeof saveJSON === "function") saveJSON("x_phoneTlKeep", out);
  return out;
}
// 相册那份：先保证动态那份拆出去了，再把每个人都整理回照片数组（被摊开的认回来），有改动才写
function phoneKeepLoad() {
  phoneTlKeepLoad();
  const all = (typeof loadJSON === "function" ? loadJSON("x_phoneKeep", {}) : {}) || {};
  let changed = false;
  const out = {};
  Object.keys(all).forEach(cid => {
    const v = all[cid];
    if (Array.isArray(v)) { out[cid] = v; return; }
    out[cid] = phoneKeptPhotos(v); changed = true;
  });
  if (changed && typeof saveJSON === "function") saveJSON("x_phoneKeep", out);
  return out;
}
// ── 固定的指标格位 ────────────────────────────────────────────
// 她 2026-08-30：「改一下每一个人的数据类型统一一下不然有点抽象，统一了但是实际名称
// 可以跟人设改」。所以这里定死【有哪几项、各归哪一档、谁占整宽】，
// 而每一项【叫什么名字】仍旧由模型按角色的世界起——王爷的「步数」可以叫别的，
// 但它还是那一项，还是在体征那一档、还是排在同一个位置。
// slot 是不翻译的机器 key；zh 是这一项的标准含义，只在角色给它改了名时当小字副标题露出来。
const HEALTH_SLOTS = [
  { slot: "sleep",     zh: "睡眠质量",     group: "body",    wide: true },
  { slot: "workout",   zh: "运动质量",     group: "body" },
  { slot: "steps",     zh: "步数",         group: "body" },
  { slot: "hr",        zh: "心率",         group: "body" },
  { slot: "burn",      zh: "活动消耗",     group: "body" },
  { slot: "recovery",  zh: "恢复指数",     group: "body" },
  { slot: "mood",      zh: "情绪状态",     group: "mind",    wide: true },
  { slot: "screen",    zh: "屏幕使用",     group: "mind" },
  { slot: "mindful",   zh: "正念冥想",     group: "mind" },
  { slot: "social",    zh: "社交能量",     group: "mind" },
  { slot: "intimacy",  zh: "私密生理状态", group: "private", wide: true },
  { slot: "desire",    zh: "欲念起伏",     group: "private" },
  { slot: "closeness", zh: "亲近时的反应", group: "private" },
  { slot: "water",     zh: "饮水",         group: "intake" },
  { slot: "nutrition", zh: "饮食营养",     group: "intake" },
  { slot: "calories",  zh: "摄入与消耗",   group: "intake",  wide: true }
];
// 「看TA玩」里现编的那一页，四个 app 共用一份（浏览器 / 购物 / 外卖 / 小红书）。
// 这儿只是个转手：组件在 js/phone-watch.js 里，没加载那个文件时什么也不画。
// 「看TA玩」里【买东西那一路】的三个 app：它们没有输入框，send 落的是屏幕上那一页。
// 写成一份名单，播放器和落盘各读它一次——别在两处各写一串 || 。
const WATCH_BUY_APPS = ["shopping", "takeout", "liked"];

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

// 每个 app 站的位置：TA在这个 app 里是「对谁」的样子，以及往回捞多久。
// 时间窗尤其重要——现在所有 app 默认都在写「这几天」，相册本该跨年、
// 购物本该跨月，全挤在同一个窗口里，撞车是必然的。
// 【角色在哪儿】（v64.72，她 2026-09-06：「以前查手机他们都会查温尼伯有关的…
// 现在都变回 general 的国内了」）。
//
// ⚠️她 2026-09-05 报过一模一样的病，那次是行程：「资料丢了重新找回来，王爷就变成
//   在公寓里了」。当时给行程写了 SCHED_WORLD_RULE（engine.js），查手机没跟上——
//   施工规则/four-surfaces-same-context.md 那条老病，而查手机压根没在那张名单上。
//
// ⚠️查手机比别处更容易滑回去，因为【这个界面本身就是中文的】：微信、朋友圈、小红书、
//   仿 bilibili，连渲染层的钱都写死了 ¥。模型看见一屏中文 app，就默认这人在国内。
//   所以这一条要挑明：**界面语言不代表角色在哪儿**——中国人在国外照样用微信。
//
// ⚠️写的是判据不是示范（prompt-no-content-samples.md）：给了「曼大教授的邮件」
//   这种例子，每个角色的邮箱里都会长出一个教授。
const PHONE_WORLD_RULE = "\n\n【先认准角色在哪儿，再往手机里填东西】\n"
  + "· 这台手机的界面是中文的，**这不代表角色人在国内**：人在国外照样用中文 app。\n"
  + "· 每一条内容都要落在【TA真正生活的那个地方】：收到的信来自哪儿的机构和学校、"
  + "约人去的地方在哪座城、地址和电话是哪国的写法、价格用哪种货币、"
  + "刷到的热闹是哪儿的事、身边这些人是谁。\n"
  + "· 判据一句话：**这一条搬到另一座城市还成立吗？成立就说明写空了，重写。**\n"
  + "· TA在哪儿由上面【你自己住在哪儿】那一行、人设和世界书说了算；三处都没写才按人设的语感来推，"
  + "**绝不许因为界面是中文的就默认国内**。";

// 手机里的字用哪种语言（她 2026-09-14：「人设是日本人的话放查手机世界书让他们写中文
// 也没用，只有人设里写他说什么语言才比较稳定」；同一天：「把英文去掉了还是有惯性」）
// ─────────────────────────────────────────────────────────────
// 惯性不是模型记性好，是我们自己发回去的：刷新是【在旧那份上往下写】——🔒 钉死的身份、
// 🌱 演化那几栏、📚 累积和名册，全都原样发回去当料。人设里那句「他说英文」删掉之后，
// 手机里存着的那一堆英文还在，模型照着它们接着写，看起来就成了「改了没用」。
// 所以这一层要说的不只是【这一轮写什么语言】，还有【上面发回去那些旧的怎么办】。
// ⚠️拼在 _full 那一处，不是各 app 的 instruction 里——新加一个 app 时漏不掉
//   （施工规则/four-surfaces-same-context.md）。
const PHONE_LANG_MODES = ["persona", "zh", "native"];
const PHONE_LANG_ZH = { persona: "跟着人设", zh: "一律中文", native: "TA当地的语言" };
function phoneLangBlock(mode) {
  const head = "\n\n【手机里的字用哪种语言】\n";
  // ⚠️分两句说，不是一句「全改过来」也不是一句「全不动」。
  //   全改过来会出事：累积层的【名册按名字认人】（phoneGrowList），把一条名册的名字
  //   译成中文，合并那一步认不出它是同一条，于是原来那条还在、新写的又进来一条，
  //   攒成两份。全不动也不对：那样 🌱 沿用的那几栏（签名、备注、对她的评价）
  //   一旦是外语就永远是外语，她换了档也看不出有变化。
  //   所以界线画在【这个字是内容，还是这一条的身份】上。
  const carry = "\n· 这一档只管【你这一轮写出来的字】：正文、标题、说出口的话、心里那一句、批注、当前快照，全照这一档写。"
    + "上面发回给你的旧内容用的是什么语言，**不决定你这一轮写什么**。\n"
    + "· 只有两样原样照抄、一个字都不译：**账号和号码这类身份字段**，以及**名册里每一条的名字**"
    + "（会话名、书名、店名、便签抬头、想买的东西这些）——改了名字它就不再是同一条，会被当成新的攒进去，变成两份。";
  if (mode === "zh") return head
    + "· 这台手机里你要写的字**一律写中文**：标题、正文、别人说的话、TA心里那一句，都算。\n"
    + "· 人名、店名、歌名、地名这类专有名词照它本来的样子写，不必硬翻成中文。"
    + carry;
  if (mode === "native") return head
    + "· 用【TA真正生活的那个地方通行的语言】写。TA在哪儿由人设和世界书说了算。"
    + carry;
  return head
    + "· 看人设和世界书里写的**TA自己说什么语言**，照那个写。\n"
    + "· 两处都没写的，写中文。"
    + carry;
}

const PHONE_ANGLE = {
  wechat: "【取材层】有别人在场时的TA。这里每句话都是说给某个具体的人听的，会挑措辞、会留一手。【时间窗】这几天。",
  notes: "【取材层】完全没人看的时候，TA留给自己的东西——打字的和说出口的都在这儿。录下来的那些是**打字打不出来、只能说出来**的，这是它和打字条的分界。**这是TA最不设防的地方**：没人会看，所以写得比TA嘴上说的更直白、更难听、更黏糊都是正常的。【时间窗】这一两周，**不只是已经发生的事**——此刻的感受、还没做的打算、突然冒出来的念头，都落在这儿。",
  calls: "【取材层】TA和外面世界打交道时留下的硬痕迹：谁打来TA不接、谁给TA留了言、哪些人只配收到短信。**电话记录里最有东西的是没接通的那些。**【时间窗】这一周。",
  browser: "【取材层】没人看着的时候TA自己去找的东西。搜索框里的人是不修饰的——会打错字、会问很蠢的问题、会反复搜同一件事。【时间窗】这几天，标签页可以开了很久。",
  shopping: "【取材层】TA花钱的方式。买了什么、想买没买、绝不买什么、送到谁家——这四样加起来比TA自己说的任何一句都准。【时间窗】这一个月，想买清单可以惦记很久。",
  bili: "【取材层】TA消磨时间的口味，不是TA的心事——刷视频多半是没在想什么的时候。弹幕是例外：那是TA忍不住开口的地方。【时间窗】这几天。",
  latenight: "【取材层】深夜、独自一人、没打算被任何人看见的欲望。【时间窗】这阵子。",
  album: "【取材层】过去。**相册的主体不是这几天**，而是几个月到几年沉下来的东西：旧的人、去过的地方、早就结束的事。只有一两张属于最近。【时间窗】跨月跨年。",
  reading: "【取材层】TA一个人读到某一句停下来的那个瞬间。**批注和划线是不打算给任何人看的动作**，所以它比书单诚实得多；书架怎么分、怎么起名，也是TA自己对自己的说法。【时间窗】跨年，一架书是攒出来的，不是这个月买的。",
  liked: "【取材层】TA不会写下来、但会顺手点的东西。点赞和收藏没有措辞、不用解释，所以最诚实。【时间窗】这一两个月。",
  health: "【取材层】TA的身体和心神这一天经历了什么。**指标名和细分项都要长成这个角色世界里的样子**，不是通用体检报告。【时间窗】今天为主，一周做背景。",
  clipboard: "【取材层】TA复制过、但不一定发出去的东西。这里最重要的不是内容，是**发没发出去**。【时间窗】这几天。",
  takeout: "【取材层】TA怎么把自己喂饱。几点吃、吃什么、送到谁那儿、备注里写了什么——**备注那一栏比吃什么更暴露人**。【时间窗】这两周。",
  wallet: "【取材层】TA的谋生方式和消费水平，是长期的底子，不是这几天的心情。【时间窗】按月。",
  mail: "【取材层】TA对外那一面：工作、账单、订阅、学校、机构。**这里的TA是【对陌生人和上级说话】的样子**，跟微信里那个人是同一个，但措辞完全两回事。【时间窗】这一两周，订阅和账单可以更久。",
  tally: "【取材层】TA心里那本没结清的账——欠着的、替谁挡过的、放过的狠话、舍不得的、拿不准的。**跟谁有账就记谁**，用户只是其中一个人。**这本账不记钱**，钱在钱包里。【时间窗】从认识到现在，横跨很久；大多数条目应该已经挂了一阵子了。"
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
  return "\n\n【同一部手机 · 不许复读】这轮TA手机里别的 app 已经写了下面这些：\n" + lines.join("\n")
    + "\n**换一件别的事写。**一个人的手机里不会所有 app 都在说同一件事——备忘录记的、搜索框里搜的、买的东西、听的歌，本来就来自TA生活里互不相干的角落，"
    + "很多东西跟你以为最重要的那件事根本没关系。\n"
    + "上面已经出现过的事，这里【只能写它的侧面或后果】，绝不许重讲一遍：别处写了TA在等一个消息，这里可以是TA等的时候顺手买的东西，但不能又写一遍TA在等。\n"
    + "优先去写上面完全没提到的、属于TA自己的另一条线：工作、家里、旧朋友、身体、钱、没做完的事、纯粹的无聊。"
    // 不复读≠不认账（她 2026-10-06 转群友：相册写他爸去世了，备忘录又去给「老头老太太」备茶）。
    // 上面那些是这部手机里已经发生的事：后写的要跟它对得上。分先后——人设和记忆最大，
    // 别的 app 写的只补人设没写到的空白；跟人设冲突的，以人设为准，那一条当没看见。
    + "\n\n【同一部手机 · 不许打架】上面这些也是TA手机里【已经写定的事】：家里有谁、谁还在谁不在、在哪儿工作住哪儿、跟谁什么关系，"
    + "你这里写到同一件事就得跟它对得上，别另编一个版本。先后是：人设和记忆最大；上面别的 app 写的只补人设没写到的空白——"
    + "它要是跟人设对不上，以人设为准，那一条当没看见。";
}

// 「TA自己的一句话」这种自由栏最容易滑回训练先验：健康那份是 ♻️（每次整份重写），
// 模型没有任何上一轮的记忆，于是每次都从同一个先验里捞同一句出来——
// 她 2026-08-30：「这一块的 quote 就开始八股要连本带利收回来了」。
// 提示词里立判据只能降概率；这一道是代码保证：上一轮写过的原样发回去，说别再写。
// ⚠️只发【句子本身】，不搬整份报告——健康是 ♻️，报告不该跨轮累积（见四层手机数据模型）。
// ⚠️为什么只有健康吃这一块（合法差异，见 four-surfaces-same-context.md）：
// 每次整份重写、又没有累积避重的只有 health 和 reading 两个。但「别重复上一轮」
// 这句话对 reading 是【错的】——书架和书是TA这个人稳定的东西，一个人的书架不该每翻一次
// 就换一整套；健康那份报告写的却是【今天】，同一句话再出现一次本身就是没写今天。
// 所以这一块只挂在 health 上，别顺手推广。
function phoneQuoteAvoidBlock(key, known) {
  if (key !== "health" || !known || typeof known !== "object") return "";
  const said = [];
  const push = v => { const t2 = String(v || "").trim(); if (t2 && said.indexOf(t2) < 0) said.push(t2); };
  (Array.isArray(known.cards) ? known.cards : []).forEach(c => c && push(c.quote));
  push(known.tail);
  if (known.today && typeof known.today === "object") push(known.today.label);
  if (!said.length) return "";
  let body = said.slice(0, 20).map(x => "· " + x).join("\n");
  if (body.length > 900) body = body.slice(0, 900) + "…";
  return "\n\n【上一轮TA已经说过这些，一句都不许重复】\n" + body
    + "\n**连意思相近、换个说法的也算重复。**这一轮的每一句都得是新的、扣着今天这个读数说的。"
    + "如果你发现自己想写的又是上面某一句的同义句，说明你在套模板——换一个真正属于今天的角度重写。";
}

// 旧入口保留，算法迁到 character-pronoun.js。浏览器和纯函数测试共用同一份判断表。
function phoneTa(text, ta) {
  return (typeof CharacterPronoun !== "undefined" ? CharacterPronoun : require("./character-pronoun.js")).replace(text, ta);
}
function charTa(char) {
  return (typeof CharacterPronoun !== "undefined" ? CharacterPronoun : require("./character-pronoun.js")).ta(char);
}
// ── 一个人的好几种叫法（v59.18）─────────────────────────────
// 她 2026-08-31：「人设里写着 scar 和 prim 是双暗恋，但我建角色时写了 prim 全名，
// 所以现在查 scar 微信能看到 prim 实时互通的记录，外加一个假的 prim」。
// 病根：避重是把【真实会话的名字】原样发过去，让模型自己认。可「Prim」和
// 「Prim Whitlock」在模型眼里就是两个人——它照着人设里的叫法造了第二个。
// 规则那一层只能降概率，所以这里是【代码这一道】：按叫法归一，撞上的直接丢掉。
function phoneNameKeys(name) {
  const raw = String(name == null ? "" : name).trim();
  if (!raw) return [];
  const norm = s => String(s).toLowerCase().replace(/[\s·・‧.,'’"“”\-_—/|()（）【】\[\]、]/g, "");
  const keys = [];
  const push = k => { if (k && keys.indexOf(k) < 0) keys.push(k); };
  push(norm(raw));
  // 全名拆成一段一段：「Prim Whitlock」→ prim / whitlock。
  // 单字不收——「川」这种谁都能撞上。
  raw.split(/[\s·・‧.,\-_—/|、]+/).forEach(t => { const k = norm(t); if (k.length >= 2) push(k); });
  return keys;
}
// 两个名字指不指同一个人。
// 她那个例子（prim / Prim Whitlock）靠的是【拆词后精确相等】，不依赖包含。
// 包含这一条是给中文两字名用的（「陆闻」vs「陆闻那个嘴碎编修」），但它很危险：
// 「苏晚」和「苏晚晴」也是包含关系，那是两个人。
// 判据：**多出来的那截得是一串，不是一个字**——多一个字多半是另一个名字，
// 多好几个字才像是在本名后头挂了个称呼／头衔。所以要求长的比短的多 ≥2 个字。
function phoneSamePerson(a, b) {
  const ka = phoneNameKeys(a), kb = phoneNameKeys(b);
  if (!ka.length || !kb.length) return false;
  return ka.some(x => kb.some(y => {
    if (x === y) return true;
    const lo = x.length <= y.length ? x : y, hi = x.length <= y.length ? y : x;
    return lo.length >= 2 && hi.length - lo.length >= 2 && hi.indexOf(lo) >= 0;
  }));
}
// 微信刷回来之后：跟【已经有真实记录的那个人】撞车的假联系人／假私聊，一律丢掉。
// taken＝那些人的名字（真实会话名 + 对应角色卡的本名和备注）。
function phoneDropDupWechat(d, taken) {
  if (!d || typeof d !== "object") return d;
  const names = (Array.isArray(taken) ? taken : []).map(x => String(x || "").trim()).filter(Boolean);
  if (!names.length) return d;
  const dup = n => names.some(t => phoneSamePerson(n, t));
  const out = Object.assign({}, d);
  if (Array.isArray(d.contacts)) out.contacts = d.contacts.filter(c => !(c && dup(c.name)) && !(c && dup(c.remark)));
  // 群聊不管：一个群里当然可以有已经认识的人，重的只可能是【私聊】。
  if (Array.isArray(d.chats)) out.chats = d.chats.filter(c => !(c && c.type !== "group" && dup(c.name)));
  return out;
}
// 同一个人别用好几个别称各占一条（她 2026-08-31：「饭桌上的人有时候是同一个人
// 好几个别称」）。留先出现的那条——列表本来就按分量排。
// ── 这是【TA自己】的手机（v64.36，她 2026-09-06：「为什么查手机会互通素材，
//    这些都在陆衍手机里但是这些应该是沈屿白的信息」）────────────────────────
// 病根不在这一层，在上下文：查手机吃的是整份 ctxFor，里头有群回声、朋友圈回声、
// 记忆库里没绑角色的那些……那些TA【确实知道】，但知道不等于是TA的。
// 代码那一半在 app.js 的 phoneCtx（掐掉群回声）；这一句管剩下的那一半——
// 上下文里总还会有别人的名字和事，得说死「听说过 ≠ 发生在你身上」。
// ⚠️写成一个函数、只此一份：十几个 app 加上锁屏偷看那一处共用，新加一个也漏不掉。
function phoneOwnOnlyBlock(name) {
  const who = String(name || "TA");
  return "\n\n【这是TA自己的手机 · 最高优先】这台手机里只许有【" + who + "】自己的东西：TA自己的事、TA自己认识的人、TA自己的职业和日常。\n"
    + "· 上下文里会出现别人（别的角色、群里说过的话、记忆库里记着的事）。那些是TA**听说过**的，不是TA**经历过**的——**听说过绝不等于发生在TA身上**。\n"
    + "· **绝不许**把别人的职业、专业术语、项目、病人、同事、爱好、行程挪到TA名下写成TA的。判据一句话：这一条要是搬到另一个角色的手机里也照样成立，那它就不该出现在这里。\n"
    + "· 别人可以作为【TA生活里的人】出现（TA跟对方说话、提起对方、和对方约了什么），但事情本身必须是**TA这一头**的。";
}
function phoneProbeSpec(key, char, rel, actualWechat, avoidLines, known, money, weekly, bond, lang) {
  const relHint = rel && rel.length ? "关系网里的人（" + rel.join("、") + "）请优先出现。" : "";
  const visitHint = key === "health" ? phoneVisitHint(known) : "";
  // 书架：已经摆好了、而且这是例行刷新，就只问「这一周TA动了哪几本」
  const _shelves = (key === "reading" && known && Array.isArray(known.shelves)) ? known.shelves : [];
  const bookUpdOnly = key === "reading" && weekly && _shelves.length > 0;
  // 微信：会话已经够多了就只更新说的话（她 2026-09-01：「后续封顶了不应该生成新的」）
  const _wxChats = (key === "wechat" && known && Array.isArray(known.chats)) ? known.chats : [];
  const wxUpdOnly = key === "wechat" && _wxChats.length >= PHONE_WECHAT_ENOUGH;
  // 会话已经认全了，可关系网里有人还不在里面（群友 2026-10-21：后来才给他绑的配角，查手机怎么刷都没有）：
  //   「不许新增」只管凭空编的人，关系网里真有的这几位要开出来
  const _wxNorm = v => String(v == null ? "" : v).replace(/[\s（）()「」【】·,，.。!！?？:：;；]/g, "");
  const _wxHave = _wxChats.map(c => _wxNorm(c && c.name));
  const wxMissing = wxUpdOnly ? (rel || []).filter(n => n && !_wxHave.some(h => h && (h.indexOf(_wxNorm(n)) >= 0))).slice(0, 3) : [];
  // 全新生成那一路也一样（群友 2026-10-21：清空重新生成也没有那个配角）：原来只说「优先出现」，模型可以不理。
  //   关系网里的人（最多 5 个）必须各有一个私聊，占在那 5 个会话里；通讯录 contacts 里也要有。
  const wxFreshMust = key === "wechat" && !wxUpdOnly && (rel || []).length
    ? "\n【必须有】" + (rel || []).slice(0, 5).map(n => "「" + n + "」").join("") + " 是TA现实里认识的人：这一轮的会话里必须各有一个跟他们的私聊（算在那 5 个里），contacts 里也要有他们，名字照抄、不许改写。聊什么照你们是什么关系来。\n"
    : "";
  // 朋友圈底下的赞和评论（群友 2026-10-21：一个根本不认识发帖人的配角给他点了赞）：真微信里共同好友才看得见
  // 真角色（TA自己、关系网上不是配角的那几位）的朋友圈只认她那边真发过的，App 会原样摆进来——推演这一路不替他们写（她 2026-10-21）
  const _wxRealA = key === "wechat" && typeof window !== "undefined" && typeof window.__phoneRealMomentAuthors === "function" ? (window.__phoneRealMomentAuthors(char) || []) : [];
  const wxMomentRule = key === "wechat"
    ? (_wxRealA.length ? "\n【朋友圈的作者】" + [...new Set(_wxRealA)].map(n => "「" + n + "」").join("") + " 自己发的朋友圈会照实摆进来，moments 里**不许**写他们发的；只写别的联系人发的。\n" : "") + "\n【朋友圈的赞和评论】作者从TA的联系人里挑；likes 和 comments 里的人必须是【TA 和这条的作者都认识的】——真微信里不是共同好友的赞根本看不到。两个人认不认识照关系网和你们的设定来，拿不准就别写进去，宁可少几个赞。\n"
    : "";
  const wxMissingLine = wxMissing.length
    ? "\n【例外·关系网里的人】" + wxMissing.map(n => "「" + n + "」").join("") + " 是TA现实里认识的人，微信里却还没有跟他们的会话。这一轮给他们每人开一个私聊，写进 newChats：type 填 private，name 照抄这个名字，messages 4-8 条有来有回（照你们是什么关系来说），再给 last、time，以及 TA 给对方的微信备注 remark、一句 TA 对对方的看法 intro。除了这几位，别的照旧不许新开。\n"
    : "";
  const wxChatList = wxUpdOnly
    ? characterText(char, "\n【他微信里现有的会话（name 必须从这里面照抄）】\n") + _wxChats.map(function (c) {
        // 隔了几天就照实说（群里 2026-10-23：「过了一个星期还在说同一个」）——上次那件事早过去了，这回说的是这几天的
        const _lastAt = Math.max(0, Number(c._upd) || 0, Number(c._ts) || 0, ...((Array.isArray(c.messages) ? c.messages : []).map(m => Number(m && m._at) || 0)));
        const _days = _lastAt ? Math.floor((Date.now() - _lastAt) / 86400000) : 0;
        return "· " + (c.name || "") + (c.type === "group" ? "（群）" : "") + (c.last ? "：" + String(c.last).slice(0, 24) : "")
          + (_days >= 1 ? "（上次说话是 " + _days + " 天前，那件事已经过去了；这回说的是这几天新发生的）" : "");
      }).join("\n") + "\n"
    : "";
  const bookList = bookUpdOnly
    ? characterText(char, "\n【他架上现有的书（title 必须从这里面照抄）】\n") + _shelves.map(function (sh) {
        return "〔" + (sh.name || "") + "〕" + (Array.isArray(sh.books) ? sh.books : []).map(function (b) {
          return (b && b.title || "") + (b && b.readAt ? "（现在：" + b.readAt + "）" : "");
        }).filter(Boolean).join("、");
      }).join("\n")
    : "";
  const S = {
    wechat: {
      instruction: wxUpdOnly
        ? ("「" + char.name + "」的微信里人已经认全了，**这一轮不要另开新会话、不要新增联系人**。\n"
          + characterText(char, "人是慢慢认识的，话是天天在说的：一周之内他不会突然多出五个朋友，变的只是**那几个已有的会话里又说了什么**。\n")
          + "下面先给你 TA 手机里【真实已有、不可改写】的聊天摘要，避开其中的原话：\n" + (actualWechat || "目前没有可用的真实聊天。") + "\n"
          + "这一轮只回 updates：**这几天真的有新消息的那 1-3 个会话**，没动静的一个都别写。\n"
          + "每条给 name（**从下面这份会话名单里原样照抄**，一个字都不许改）、"
          + "messages（**接着往下说的新消息 4-8 条**，有来有回，不要把之前说过的再抄一遍）、"
          + "last（这个会话现在的最后一条）、time。\n"
          + "⚠️新消息要接得上原来那段话的走向——是同一段关系往前走了几步，不是换个话题重开。\n"
          + characterText(char, "moments 照旧给 1-2 条新的朋友圈（那是真发生的事，该有新的），作者从他已有的联系人里选。\n")
          + "me 这一栏【基本不要动】：朋友圈签名 signature 和封面 cover 不是每天换的东西。"
          + characterText(char, "只有他这几天的心境真的翻篇了（结束了什么、开始了什么、想通了什么），才在 me 里写新的那一两栏；")
          + "**不写就是照旧**，绝大多数轮次都该一栏都不写。\n"
          + wxChatList + relHint + wxMissingLine + wxMomentRule)
        : ("推演此刻「" + char.name + "」完整的微信。下面先给你 TA 手机里【真实已有、不可改写】的聊天摘要；你要避开其中已有会话名与原话，另外生成正好 5 个互不相同的新会话（私聊与群聊混合，至少各 2 个）。\n" + (actualWechat || "目前没有可用的真实聊天。") + "\n" + relHint + wxFreshMust + wxMomentRule) + "chats 每个会话给名字、private/group 类型、最后一条、时间及最近 8-12 条有来有回的对话，不要只给三两句。contacts 正好 5 个，不含用户本人：必须是与 TA 真有关系的人，含 TA 给对方的微信备注 remark 和一段具体、有个人态度的关系简介 intro。userContact 单独写【用户本人】：name 就用上面告诉你的那个用户名字，remark 必须是 TA 真会给对方起的微信备注，intro 必须写 TA 对对方的具体认识、情感和私下评价，不能写「以主聊天为准」之类占位话。moments 正好 3 条，作者从 contacts 里选；每条给点赞名单和评论，且 comments 中必须有一条来自「" + char.name + "」本人的自然评论。me 写 TA 自己给自己取的 wechatName（不是角色本名照抄，要像 TA 真会使用的微信昵称、符合 TA 的取名风格）、wechatId 和本轮新生成的朋友圈 signature；、以及 TA 朋友圈封面长什么样 cover（**一句画面描述**，不是图片：写清是什么画面、什么色调、为什么是这张，要能一眼看出是 TA 挑的，换个人就不成立）；并给最近看过的 3 篇公众号文章：标题、公众号、时间、较完整的文章摘要和 TA 看完的真实感想。所有内容贴合人物关系、近况和声纹，避免客服腔与泛泛而谈。",
      schemaHint: wxUpdOnly
        ? (wxMissing.length ? "{\"newChats\":[{\"type\":\"private\",\"name\":\"关系网里那个人的名字\",\"remark\":\"TA给对方的微信备注\",\"intro\":\"TA对对方的看法\",\"last\":\"最后一条\",\"time\":\"14:20\",\"messages\":[{\"from\":\"说话人\",\"text\":\"内容\"}]}]," : "{") + "\"updates\":[{\"name\":\"从名单里原样照抄的会话名\",\"messages\":[{\"from\":\"说话人\",\"text\":\"新说的话\"}],\"last\":\"最后一条\",\"time\":\"14:20\"}],\"moments\":[{\"author\":\"联系人\",\"time\":\"2小时前\",\"content\":\"朋友圈正文\",\"likes\":[\"姓名\"],\"comments\":[{\"from\":\"姓名\",\"text\":\"评论\"}]}],\"me\":{\"signature\":\"心境真变了才写，否则整个 me 都别给\",\"cover\":\"同上\"}}"
        : "{\"chats\":[{\"type\":\"private或group\",\"name\":\"会话名\",\"last\":\"最后一条\",\"time\":\"14:20\",\"messages\":[{\"from\":\"说话人\",\"text\":\"内容\"}]}],\"userContact\":{\"name\":\"用户本人的名字\",\"remark\":\"TA给用户的微信备注\",\"intro\":\"TA对用户具体而私人的感想\"},\"contacts\":[{\"name\":\"本名\",\"remark\":\"TA的备注\",\"intro\":\"关系与感想\"}],\"moments\":[{\"author\":\"联系人\",\"time\":\"2小时前\",\"content\":\"朋友圈正文\",\"likes\":[\"姓名\"],\"comments\":[{\"from\":\"姓名\",\"text\":\"评论\"}]}],\"me\":{\"wechatName\":\"TA的微信昵称\",\"wechatId\":\"微信号\",\"signature\":\"本轮生成的朋友圈签名\",\"cover\":\"朋友圈封面的一句画面描述\",\"accounts\":[{\"title\":\"文章标题\",\"source\":\"公众号\",\"time\":\"昨晚\",\"summary\":\"较完整文章摘要\",\"thought\":\"TA的感想\"}]}}"
    },
    notes: {
      instruction: "推演「" + char.name + characterText(char, "」手机便签里的东西（**8-12 条**）。这里既有他打字记下的，也有他说出口录下来的——**两种混在一起，本来就是一个 app**。\n")
        + "每条：kind（typed = 打字的 / voice = 录音的）、title（很短的一句抬头，可以就是正文第一句）、time、body（正文）、color（0-5 的整数，定便签颜色）。\n"
        + "kind=voice 的另给 duration（如 0:37 / 2:14）；它的 body 就是那段录音，照发语音的写法写：" + (typeof VOICE_PAUSE_MARK === "string" ? VOICE_PAUSE_MARK : "") + (typeof mmSoundHint === "function" ? mmSoundHint() : "") + "\n\n"
        + "【两种要真的不一样，这是这个 app 唯一重要的事】\n"
        + "**打字的**：清单、待办、半句话、气话、抄下来的一行字、一串数字、一个地址。不必是完整的想法，很多条根本没有情绪。可以短到只有四五个字。\n"
        + "**录下来的**：**只有打字打不出来、必须说出口的东西才会被录**。所以它有语气词、有停顿、有说到一半改口、有自己都嫌烦的叹气；转成字之后是不通顺的。录音在总数里是少数（三分之一以内），而且往往在深夜、在路上、在刚吵完架之后。\n"
        + "如果两种写出来一个味道，就等于这个 app 白做了。\n\n"
        + "【长短要差得开】有的一行，有的一大段。不许每条都是同一个长度、同一个句式。\n"
        // 她 2026-09-22：「便签也能字数多一点对吧」。上面那句只说了「差得开」，
        // 没说【长的那头能有多长】——模型就按最稳的那档写，条条三五行。
        + "**长的那几条是可以真的很长的**：一整页、几百上千字都算正常，想到哪写到哪、写完为止，"
        + "不许为了收尾而收尾，也不许把本来要说的话压成一句提要。\n\n"
        // 她 2026-09-22 转来的：「现在主要是记录了发生过的事情，感受类、未来计划类、
        // 发散联想类偏少，所以没有太多惊喜感，情感浓度也有点淡」。
        // ⚠️病根不在写得不好，在【取材只有一档】：上面那两条分的是「打字还是录音」，
        //   记的是什么则一个字都没说，于是默认全落在最安全的那一档——记事。
        //   这儿掷的是【轴】不是答案：只规定这几档各要有，写什么仍然由这个人自己长出来
        //   （施工规则/bans-make-it-dumber）。
        + "【一条便签在【记什么】——四档，四档都要有，不许全挤在第一档】\n"
        + "① **已经发生的事**：办完的、记下的、抄来的一行字、一串数字、一个地址。\n"
        + "② **此刻的感受**：没打算给任何人看的那种。可以只有半句，可以TA自己都没写明白在气什么、在高兴什么。\n"
        + "③ **往后的打算**：待办、清单、盘算。**也包括冲着某个具体的人去的盘算**——下次要怎么样、准备好了什么、等哪个时机用。\n"
        + "④ **没头没尾的**：忽然冒出来的念头、由一件小事扯远了的联想、以及TA一个人玩的那种自娱自乐——**拿一套一本正经的格式去写一件根本不正经的事**，或者给某个人、某件小事起一个只有TA自己在用的叫法。\n"
        + "⚠️④ 这一档最容易写没，也最是这个人的样子；但**别每条都这样**，一两条就够，多了就成了另一种八股。\n"
        + "⚠️全写成 ① 就是一本流水账——那是这个 app 最没意思的样子。\n\n"
        + "【关于用户】TA的便签里可以出现用户本人，用**TA私下里对TA的叫法**（不一定是当面叫的那个）；便签是没人看的地方，所以这里的语气可以比当面直白得多。十来条里有一两条是冲着用户去的就够了，不必条条都是。" + relHint,
      schemaHint: "{\"items\":[{\"kind\":\"typed\",\"title\":\"很短的抬头\",\"time\":\"昨天 21:03\",\"body\":\"正文\",\"color\":2},{\"kind\":\"voice\",\"title\":\"抬头\",\"time\":\"昨天 23:40\",\"duration\":\"0:37\",\"body\":\"录音转成的字，不通顺\",\"color\":4}],\"retired\":{\"items\":[\"划掉或者事情办完了的那条便签的抬头\"]}}"
    },
    calls: {
      instruction: "推演「" + char.name + "」手机上的电话和短信。\n\n"
        + characterText(char, "me：number（他自己的号码）。\n\n")
        + characterText(char, "calls 通话记录 **8-12 条**：name（对方怎么称呼，陌生号就留空）、number、dir（in 来电 / out 拨出）、time、duration（接通了才写；没接通留空）、answered（true/false）、gist（这通说了什么，一句；没接通就写没接通时他在干嘛）、thought（**他对这通电话的真实想法**，一句，可以刻薄、可以敷衍、可以是没接的理由）。\n")
        + characterText(char, "**这个 app 真正有东西的是没接通的那些**：谁打来他不接、他打给谁一直打不通、深夜那通只有几十秒的、同一个人一天打了好几遍。**至少三条是没接通的**，而且每一条不接的理由都不一样（在忙、不想接、故意晾着、没听见、正跟别人在一起）。\n\n")
        + characterText(char, "sms 短信 **5-8 串**：name、number、kind（通知 或 人）、time、unread（true/false）、msgs（1-4 条，各有 from = they／me、text、time）、thought（他对这串的想法，可空）。\n")
        + "**⚠️短信和微信收发的东西完全不是一回事，别把微信那套搬过来。**\n"
        + "短信里**绝大多数不是人**：验证码、账目通知、催缴、店家提醒、送货、推销、以及骗子。这些一条就是一条，没有来回，语气是机器或者陌生人的。kind=通知 的那几串占多数。\n"
        + characterText(char, "**熟人一旦出现在短信里，必有一个理由**：那会儿联不上网、对方被他删了或拉黑了、手机不在身边、或者是必须留个凭据的正事。**写熟人短信时，那个理由要能从内容里看出来**，不能写成日常闲聊——日常闲聊属于微信，不属于这里。\n")
        + "短信也**几乎没有表情、没有连发、没有撒娇**，句子是完整的、生硬的、像在办事。\n\n"
        + characterText(char, "voicemail 语音信箱 **2-4 条**：from、time、duration、transcript（留言转成的字，**要有停顿、改口、说到一半的句子**）、heard（他听没听过）、thought。\n")
        + characterText(char, "**留言是单向的，本身就说明对方联系不上他**——所以这几条里应该有他一直没听的那条。\n\n")
        + "frequent 常联系 **3-5 个**：name、count（通话次数）、why（一句为什么总跟这人通话）。**电话打给谁，和微信聊得多的，往往不是同一批人**：电话给的是办事的、家里的、以及不方便打字的。\n\n"
        + characterText(char, "blocked 拦截名单 **1-3 个**：name、why（一句为什么拉黑的）。可以是骗子，也可以是他不想再接的人。") + relHint,
      schemaHint: characterText(char, "{\"me\":{\"number\":\"他的号码\"},\"calls\":[{\"name\":\"对方称呼\",\"number\":\"号码\",\"dir\":\"in\",\"time\":\"今天 09:12\",\"duration\":\"04:32\",\"answered\":true,\"gist\":\"这通说了什么\",\"thought\":\"他的想法\"}],\"sms\":[{\"name\":\"发信方\",\"number\":\"号码\",\"kind\":\"通知\",\"time\":\"时间\",\"unread\":false,\"msgs\":[{\"from\":\"they\",\"text\":\"内容\",\"time\":\"时间\"}],\"thought\":\"可空\"}],\"voicemail\":[{\"from\":\"谁留的\",\"time\":\"时间\",\"duration\":\"0:41\",\"transcript\":\"留言转成的字\",\"heard\":false,\"thought\":\"他的想法\"}],\"frequent\":[{\"name\":\"谁\",\"count\":14,\"why\":\"为什么总跟这人通话\"}],\"blocked\":[{\"name\":\"谁\",\"why\":\"为什么拉黑\"}],\"retired\":{\"frequent\":[\"不再常联系的\"],\"blocked\":[\"放出黑名单的\"]}}")
    },
    browser: {
      instruction: "推演「" + char.name + "」浏览器里的全部东西。\n\n"
        + characterText(char, "me：他浏览器同步账号的昵称（不是本名照抄）和 uid。\n\n")
        + "tabs 没关掉的标签页 **8-12 个**：title（网页标题）、site（站点名或域名）、age（这一页开了多久，写成一句）、pinned（true/false，钉住的最多 2 个）、cover（0-5 整数定色）、gist（这一页上写着什么，一句）。\n"
        + characterText(char, "**一堆没关的标签页是这个人脑子的横截面**：有他正在办的正事、有查到一半忘了的、有想买没买的、有半夜看了没退出的、有开了很久舍不得关的。**至少有一个是开了很久、他自己也说不清为什么不关的。**\n\n")
        + characterText(char, "searches 搜索记录 **10-14 条**：q（他敲进搜索框的原话）、time、site（在哪儿搜的，可空）、results（这一次搜出来的结果，2-4 条）、opened（这几条里他真正点开的那条的 source，填其中一个）。\n")
        + characterText(char, "**搜索词比访问过的网页更暴露人**：人在搜索框里是不修饰的，会打错字、会问很蠢的问题、会反复搜同一件事、会在半夜搜白天绝不会问出口的东西。所以这十几条里要有：实用的、丢人的、重复搜过的、以及一两条他绝不会告诉任何人他搜过的。\n")
        + "results 每条：source（哪个站/哪个号发的）、title（那条结果的标题）、excerpt（摘要，一两句，像搜索结果页里那截被掐头去尾的正文，可以用「……」表示截断）。\n"
        + characterText(char, "**这一层要写成【搜索引擎会返回什么】，不是【他想看到什么】**：结果里该有权威一点的、有营销号味的、有答非所问的，也可以有一条正好戳到他心事的。\n")
        + characterText(char, "**opened 才是这一栏真正的东西**——搜了什么只说明他在想什么，点开了哪一条才说明他信谁、他到底想确认什么。这两个不必一致：他可以搜得很正经，然后点开最不正经的那条。\n\n")
        + characterText(char, "marks 书签 **3-4 个文件夹**：name（文件夹名，按他自己的分法起，不是「工作」「学习」这种）、items（2-4 条，各有 title 和 site）。**书签是他觉得以后还用得着的东西**，所以里面会有很久没点过的旧东西。\n\n")
        + characterText(char, "private 无痕标签页 **1-3 个**：title、site、gist。**这是他专门开了不留记录的那几页**，和上面那些不是一回事。\n\n")
        + characterText(char, "所有内容都要贴合他的身份和时代——古代角色的\"浏览器\"是他那个世界里查东西的方式，别硬套现代网站。") + relHint,
      schemaHint: characterText(char, "{\"me\":{\"name\":\"昵称\",\"uid\":\"账号\"},\"tabs\":[{\"title\":\"网页标题\",\"site\":\"站点\",\"age\":\"开了多久\",\"pinned\":false,\"cover\":0,\"gist\":\"这页上写着什么\"}],\"searches\":[{\"q\":\"他敲进去的原话\",\"time\":\"时间\",\"site\":\"在哪搜的\",\"opened\":\"他点开那条的 source\",\"results\":[{\"source\":\"哪个站或哪个号\",\"title\":\"结果标题\",\"excerpt\":\"摘要……\"}]}],\"marks\":[{\"name\":\"文件夹名\",\"items\":[{\"title\":\"标题\",\"site\":\"站点\"}]}],\"private\":[{\"title\":\"标题\",\"site\":\"站点\",\"gist\":\"这页上写着什么\"}],\"retired\":{\"marks\":[\"已经取消收藏的书签名\"]}}")
    },
    shopping: {
      instruction: "推演「" + char.name + "」网购 App 的整个界面。" + relHint + "\n"
        + characterText(char, "**所有金额、店铺、商品都必须贴合他的身份、时代和谋生方式**：古代角色买的是他那个世界里买得到的东西、逛的是那种铺子；普通人就是普通消费水平，不许人人都很有钱。\n\n")
        + characterText(char, "account 账户：name（**他在这个平台上的昵称**，不是本名照抄）、uid（会员号，一串数字）、member（会员等级的名字，按平台在他世界里的叫法起，可以带点调侃）、style（一句话概括他的购物风格）、monthSpend（本月消费，数字）、monthOrders（本月订单数）——**这两个只是占位，界面会用钱包的真实流水覆盖它们，给个大致数就行，别为它们编细节**、points（积分）、persona（一句更狠的购物性格：他买东西时最像他自己的那个毛病）。\n")
        + "shipping 在途包裹 **2-3 件**：status（派送中/运输中/已揽收）、eta（如「今日 18:00 前」）、shop、title（商品全名带规格）、progress（0-100 整数）、carrier、tail（运单尾号）、amount（数字）。\n"
        + "cart 购物车 **4-6 件**：shop、title、spec（颜色/尺码/款式）、price（现价数字）、was（原价数字，可为 0）、promo（优惠标签，可空）、qty。购物车装的是【还没下决心的东西】。\n"
        + characterText(char, "wish 想买清单 **4-6 件**：title、shop、price、why（**为什么想买，一句他自己的话**）。\n")
        + characterText(char, "**why 这一栏是整个 app 里最重要的东西**：它要暴露他的私心、旧事和惦记的人。这一句得落在【只有他才有的那个由头】上——某个具体的人、一件他自己记着的旧事、或者他身上某个说不出口的毛病。判据很硬：**换个角色还照样成立的，就是写坏了**。「质量好」「性价比高」这种谁都能说的话不算。\n")
        + characterText(char, "orders 我的订单 **6-8 单**：**id（这一单的编号，同一单以后刷新也必须是同一个 id——钱包靠它认账，换了 id 会被当成新的一单再扣一次钱）**、shop、status（已收货/待收货/已取消）、time、title、items（1-3 件，各有 name、spec、qty、price）、ship（运费数字）、paid（实付数字）、tags（2 个左右：品类和付款方式各一个）、review（收货后他写的一句，很短很实在）、reason（**一句下单理由**，可以牵涉到人）、addr（送到哪）。\n")
        + "habit 购物习惯：budget（单笔预算区间）、buys（常买什么）、avoids（**绝不买什么**——这一条比常买更像人）、how（下单习惯，什么时候翻、还不还价）。\n"
        + "shops 常逛店铺 **3-4 家**：name、cat（品类）、why（一句为什么是这家，要具体到掌柜脾气、货色成色这种）。\n"
        + "coupons 优惠券 **2-3 张**：rule（如「满300减50」）、name、scope（哪家或哪类可用）、until（到期日）。\n"
        + "viewed 最近浏览 **5-7 条**：title、shop、price、time。**看了没买的东西和购物车里的要错开**，那是另一层心思。\n"
        + characterText(char, "addrs 收货地址 **2-3 条**：label（地址别名）、tail（尾号）、detail（详细到门房怎么放的那种备注）、isDefault（只有一条 true）。**其中一条应当是「他常去的另一个地方」**，不是自己家。\n")
        + characterText(char, "gifts 相关往来 **3-5 条**：who（给谁买的，用他嘴里对那个人的叫法）、title、note（**一句只有他会写的备注**，如「嘴上说着不喜欢我吵，接了油纸包自己一口气吃了三块」）。\n")
        + characterText(char, "monthNote：本月购物概况，一段 60-110 字，账房口吻，别抒情。tail：最后一句他自己的念叨，一两句，可以很得意也可以很没出息。"),
      schemaHint: characterText(char, "{\"account\":{\"name\":\"平台昵称\",\"uid\":\"1043827\",\"member\":\"会员等级的叫法\",\"style\":\"一句购物风格\",\"monthSpend\":3260.5,\"monthOrders\":8,\"points\":18420,\"persona\":\"一句购物性格\"},\"shipping\":[{\"status\":\"派送中\",\"eta\":\"今日 18:00 前\",\"shop\":\"店铺\",\"title\":\"商品全名\",\"progress\":78,\"carrier\":\"快递\",\"tail\":\"9042\",\"amount\":340}],\"cart\":[{\"shop\":\"店铺\",\"title\":\"商品\",\"spec\":\"规格\",\"price\":680,\"was\":880,\"promo\":\"跨店满减\",\"qty\":1}],\"wish\":[{\"title\":\"商品\",\"shop\":\"店铺\",\"price\":560,\"why\":\"一句他自己的话\"}],\"orders\":[{\"id\":\"这一单的编号，同一单永远不变\",\"shop\":\"店铺\",\"status\":\"已收货\",\"time\":\"8月28日 14:15\",\"title\":\"订单标题\",\"items\":[{\"name\":\"商品\",\"spec\":\"规格\",\"qty\":2,\"price\":48}],\"ship\":0,\"paid\":128,\"tags\":[\"食品特产\",\"微信支付\"],\"review\":\"收货一句\",\"reason\":\"下单理由\",\"addr\":\"送到哪\"}],\"habit\":{\"budget\":\"...\",\"buys\":\"...\",\"avoids\":\"...\",\"how\":\"...\"},\"shops\":[{\"name\":\"店铺\",\"cat\":\"品类\",\"why\":\"为什么是这家\"}],\"coupons\":[{\"rule\":\"满300减50\",\"name\":\"券名\",\"scope\":\"哪儿可用\",\"until\":\"8月31日\"}],\"viewed\":[{\"title\":\"商品\",\"shop\":\"店铺\",\"price\":680,\"time\":\"今天 21:15\"}],\"addrs\":[{\"label\":\"王府侧门\",\"tail\":\"4819\",\"detail\":\"详细地址与备注\",\"isDefault\":true}],\"gifts\":[{\"who\":\"给谁\",\"title\":\"东西\",\"note\":\"一句备注\"}],\"monthNote\":\"一段\",\"tail\":\"最后一句念叨\",\"retired\":{\"wish\":[\"买到手或不想要了的\"],\"shops\":[\"已经不去了的那家\"]}}")
    },
    album: {
      instruction: "推演「" + char.name + "」手机相册里正好 25 张互不重复的照片。时间跨度要自然；date 必须写真实完整日期 YYYY-MM-DD HH:mm，必须带年份，禁止写周三、周五、昨天、最近等相对日期。每张分进且只分进五类之一：回忆(memory)、个人收藏(favorite)、最近保存(saved)、私密(private)、最近删除(deleted)，每类至少 4 张、不必平均。memory 是 TA 真正会反复翻看的重要瞬间，不是普通随手拍。caption 是很短的照片标题；desc 要具体写照片真正拍到了什么（人物、地点、构图、光线和细节），不能只写抽象心情；thought 单独写 TA 看到这张照片时真实、私人的想法。类别与内容要合理：私密不等于一律色情，最近删除也要写为什么舍不得或为什么删。",
      schemaHint: "{\"items\":[{\"id\":\"p01\",\"caption\":\"很短的标题\",\"date\":\"2026-08-28 18:42\",\"category\":\"memory或favorite或saved或private或deleted\",\"desc\":\"照片实际画面描述\",\"thought\":\"TA对此的私人想法\"}]}"
    },
    reading: {
      instruction: bookUpdOnly
        ? ("「" + char.name + "」的书架已经摆好了，**这一轮不要重摆**。\n"
          + characterText(char, "书是慢慢读的：一周之内，书架不会换、书目不会换，会变的只有**他读到哪儿了**和**他写下的批注**。\n")
          + characterText(char, "所以这一轮只回 updates：**这一周他真的翻过的那几本**，通常 1-4 本，**没动的一本都别写**。\n")
          + "每条给 title（**从下面这份书目里原样照抄**，一个字都不许改，改了就认不出是同一本）、"
          + characterText(char, "readAt（新的进度——要**比原来往前**，除非他这周把它放下了，那就写清停在哪儿）、")
          + characterText(char, "note（他读到这里新写下的批注，40-90 字，第一人称；没有新想法就别给这一栏）。\n")
          + "⚠️**不要新建书架、不要添新书、不要改书名。**这一轮 shelves 一栏根本不用出现。\n"
          + bookList)
        : ("推演「" + char.name + "」手机读书 App 里的整个书架。**正好 5 个书架、正好 30 本书（每架 6 本）。**\n\n")
        + characterText(char, "【书架名是这个功能的灵魂】书架名**不是分类标签**——不许写「历史」「科幻」「文学」「哲学」这种。它是【他自己给这堆书起的名字】，带着他的处境、身份、私心和自嘲——**一看名字就知道是谁的书架**，而且换个角色这名字就不成立了。\n")
        + characterText(char, "五个里至少有一个是【只有他会有的】：跟他的职业、他正在应付的麻烦、他藏着的身份、或者某个具体的人有关。") + relHint + "\n\n"
        + characterText(char, "【书必须是真的】真实存在、书名和作者都对得上，而且【是他在他所处的时代和世界里拿得到的】：古代角色的架子上不许出现现代出版物，现代角色可以有古籍和译本。同一架里的书要像同一个人挑的。\n\n")
        + characterText(char, "【每本都要有】title、author；readAt = 他读到哪儿。**这一栏是这一页的主角**——一个人自己的书架和书店的区别就在这儿。写法随意（「卷七·饮食果子」「第 3 章」「128/357 页」「62%」都行），但**尽量能看出走了多远**；**每一架里至少有一本是停住的**——写清它停在哪儿、放了多久（「停在第三章，搁着两个月没再动」），那比读完的那几本更像他；也允许有「还没翻开」「买来就放着」这种。note = 他的批注，40-90 字，第一人称。\n")
        + characterText(char, "批注要写他读到这里**真实想到的事**：可以跑题、可以刻薄、可以突然想到某个人、可以是很实际的念头、一个当场冒出来的打算。**不许写读后感、不许总结这本书讲了什么、不许出现「这本书让我明白了」「引发了我的思考」这类句子。**换个角色也说得通的批注就是写坏了。\n")
        + characterText(char, "quote 可选：他在这本里划的一句原文（书里的句子，不是他的话），没有就填空字符串——**多数书是没有的**。\n\n")
        + characterText(char, "【阅读档案 archive】name = **他在这个读书 app 上的昵称**（不是本名照抄）；uid = 书友号（一串数字）；favorite = 他最爱的一本（title+author，要在上面 30 本里）；weekTime = 本周读了多久（如「7小时5分」，按他的处境合理，忙的人可以只有二十分钟）；weekGoal = **他给自己定的每周阅读目标**（同样格式，如「5小时」；定得高还是低本身就是这个人的样子，也完全允许他这周没读到）；plan = 他打算下一本读的（title+author）。"),
      schemaHint: bookUpdOnly
        ? "{\"updates\":[{\"title\":\"从书目里原样照抄的书名\",\"readAt\":\"新的进度\",\"note\":\"读到这里新写下的批注\"}]}"
        : characterText(char, "{\"shelves\":[{\"name\":\"他自己起的书架名\",\"books\":[{\"title\":\"书名\",\"author\":\"作者\",\"readAt\":\"读到哪儿\",\"quote\":\"他划的原句，多数留空\",\"note\":\"40-90字第一人称批注\"}]}],\"archive\":{\"name\":\"书友昵称\",\"uid\":\"7742019\",\"favorite\":{\"title\":\"书名\",\"author\":\"作者\"},\"weekTime\":\"7小时5分\",\"weekGoal\":\"5小时\",\"plan\":{\"title\":\"书名\",\"author\":\"作者\"}}}")
    },
    liked: {
      instruction: "推演「" + char.name + "」在小红书那样的图文社区里的账号。\n"
        + characterText(char, "me：name（**他在这儿的昵称**，不是本名照抄；这种号往往随手起、有点敷衍或自嘲）、xhsId（一串数字号）、bio（一句简介，可以很敷衍甚至只有几个字）、tag（个人页上那颗小药丸：年纪、所在地、或一句自嘲，二选一）、posts（发过几条）、following、followers、likes（获赞与收藏总数）。**粉丝数按他这个人合理，多数人很少。**\n")
        + characterText(char, "tabs：他常看的频道 **4-6 个**，按他的口味起名（按他真正会点进去的东西起名，别用平台默认那几个大类）。\n")
        + characterText(char, "items **10-12 条**他【赞过或收藏过】的笔记，每条：author、title（社区那种口吻——夸张、口语、像在跟人诉苦或炫耀）、excerpt（正文一两句）、tab、tags（1-3 个）、likes、act（赞 或 收藏）、time、cover（0-5 的整数，定封面色）。\n")
        + characterText(char, "**点赞记录是一个人最诚实的东西**：他不会写下来，但他会点。这十来条要出现他【不主动说、也不觉得需要解释】的部分——某种审美、某个身体或情绪上的需要、一个他嘴上不承认的爱好、一条他其实想照做的建议、一件他偷偷惦记的事。也要有很没意思的（做饭、通勤、修东西），别每条都深刻。\n")
        + characterText(char, "mine **2-4 条**他自己发出去的笔记：title、excerpt、tags（1-3 个，和他赞的那些是同一套标签体系）、likes、time、cover。\n")
        + characterText(char, "**drafts 1-3 条：他写了却一直没发出去的草稿。**这是这个 app 最狠的一格——写完了、存着、就是没点发送。可以是矫情的、丢人的、太露骨的、或者写给某个具体的人却不敢发的。每条：title、excerpt、tags（1-3 个）、savedAt（存了多久，写成一句）。\n")
        + characterText(char, "**他发出去的、他赞过的、和他没发出去的，可以完全是三个人**：发出去的是他愿意给人看的，赞过的是他自己，草稿箱里的是他不敢承认的。\n")
        + characterText(char, "follows：他关注的 **4-6 个**账号，name ＋一句 desc。别全是正经账号。") + relHint,
      schemaHint: characterText(char, "{\"me\":{\"name\":\"昵称\",\"xhsId\":\"159193450\",\"bio\":\"简介\",\"tag\":\"24岁\",\"posts\":3,\"following\":254,\"followers\":12,\"likes\":153},\"tabs\":[\"频道名\",\"频道名\"],\"items\":[{\"author\":\"发帖人\",\"title\":\"标题\",\"excerpt\":\"正文一两句\",\"tab\":\"频道\",\"tags\":[\"标签\"],\"likes\":1204,\"act\":\"赞\",\"time\":\"3天前\",\"cover\":2}],\"mine\":[{\"title\":\"他发的\",\"excerpt\":\"正文\",\"tags\":[\"标签\"],\"likes\":12,\"time\":\"上周\",\"cover\":4}],\"drafts\":[{\"title\":\"没发出去的\",\"excerpt\":\"正文\",\"tags\":[\"标签\"],\"savedAt\":\"存了 11 天\"}],\"follows\":[{\"name\":\"账号名\",\"desc\":\"这号是干嘛的\"}],\"retired\":{\"follows\":[\"取关了的\"],\"drafts\":[\"发出去或删掉的草稿标题\"]}}")
    },
    health: {
      instruction: "推演「" + char.name + "」的【病历夹】与今天的读数。" + relHint + "\n\n"
        + characterText(char, "⚠️这不是一个给他打分的健康 App，是**一位看过他的大夫留下的东西**，加上自那次之后身上的几个读数。\n")
        + "所以：不出现「综合评分」「今日得分」「健康建议」这类字眼，一个都不要。\n\n"

        + "【visits 就诊记录】" + visitHint + "\n"
        + characterText(char, "一条包含：date（YYYY-MM-DD）、who（**这位大夫在他的世界里怎么被称呼**——现代是科室加姓，古代是医官、坐堂的、府里请的那位；同一个人以后还会再出现，叫法要固定）、")
        + characterText(char, "chief（**主诉：他自己说哪儿不舒服，用他的原话**，短，而且多半是轻描淡写、避重就轻的）、")
        + "exam（**查体：身体实际显示出什么**，成句，带上具体读数；现代角色写现代化验和体征，古代角色写脉象、舌苔、气色、按压之处——**绝不许给古人写血压和血氧**）、"
        + "impression（**印象：大夫据此判断什么**，一两句，是判断不是安慰）、"
        + characterText(char, "orders（**医嘱：让他去做什么**，具体到几天几次，不写「注意休息」这种）、")
        + characterText(char, "followup（**上一次约好的事他做到没有**——没来复查、药没吃完、说好戒的没戒。第一次就留空）。\n")
        + characterText(char, "⚠️**这一栏最要紧的是 chief 和 exam 之间的落差**：他嘴里说的和身上显示的，多半不是一回事。那道缝就是这个人。\n")
        + characterText(char, "⚠️大夫是**背着他**写这些的，写的是一个不在场的人。别写成对他说话，也别替他找补。\n\n")

        + "cards **正好这 " + HEALTH_SLOTS.length + " 项，一项不多一项不少，每项写一张**。每张必须带 slot（下面括号里那个英文 key，原样照抄，不要翻译不要改）：\n"
        + HEALTH_SLOTS.map(function (x) { return "· " + x.zh + "（slot: " + x.slot + "）"; }).join("\n") + "\n\n"
        + "【格位是死的，名字是活的 · 这是这个 app 的骨架】上面这 " + HEALTH_SLOTS.length + " 项是**每个人都有的同一套读数**，顺序和分档由 slot 决定，你不用管，也不许增删或合并。"
        + characterText(char, "你要做的是给每一项起一个**这个角色的世界里真会用的名字**放进 name：**不要照搬现代体检报告的词。**一个古代王爷不知道什么叫「屏幕使用时间」「正念冥想」，那两项在他那儿必须换成他会用的说法；现代角色就用现代说法。")
        + characterText(char, "**先想清楚这个人所处的是什么世界、他会怎么称呼这件事，再落名字。**换个角色还照样成立的名字，就是没改。\n\n")
        + "【intimacy / desire / closeness 这三项】身体私底下的那一面：欲念的起落、独处时身体怎么反应、克制与失控、离得近的时候身体先于话说出来的东西。**写的是身体的读数，不是情节**——跟别的卡一样有 value / tag / 三项细账，只是量的是这件事。分寸按这个角色的身份和你俩现在的关系来，含蓄或直白都行，但**必须落在身体上、落在今天**。写不出具体读数的就别硬凑成一句抒情。\n"
        + characterText(char, "**这三项的 quote 尤其容易滑进占有欲宣言和狠话**——那是网文腔，不是他。写他当下身体上的实感、以及他拿这件事没办法的地方。\n\n")

        + characterText(char, "【每张卡都要有】slot（照抄，见上）、name（这个角色对这一项的叫法，见上）、value（大数字或大词，如 6.2 / 11420 / 「不均」/「亢奋克制」）、unit（单位，大词就留空）、num（**把 value 折成一个 0-100 的整数**，只用来画这一项这些天的走势线，越大越好；「不均」这种没法折的就别给）、tag（四个字以内的状态词，说清此刻是好是坏）、note（一段 50-90 字的观测叙述）、stats（**正好 3 项**，各有 k 和 v）、quote（他自己的一句话）。\n")
        + "**不要给 score，也不要给 week。**这不是记分板。\n\n"
        + "【quote 是这份报告里最容易写成八股的一栏，落笔前过一遍这三条】\n"
        + "① **扣着这张卡今天这个读数说话**，不是放之四海皆准的宣言。换一张卡、换一天还照样成立的，就是写坏了。\n"
        + characterText(char, "② 是他心里过了一下、**没打算给谁听**的半句话；不是说给人听的狠话、承诺或预告。一旦写成「我要……」「早晚……」「一定会……」这种句式，就是滑回通用腔了，重写。\n")
        + characterText(char, "③ 语气是**他这个人**的，不是他这个类型的。他的身份、今天的处境、他自己嫌不嫌烦，都该听得出来。\n\n")
        + characterText(char, "【stats 那三项是最见功夫的地方】**它们的名字必须是这个角色专属的，绝不能用通用标签。**同样一张「步数」卡：三项拆的应该是**他今天真正走过的那几段路、真正喝下去的那几样东西**，名字要带上地点、场合、或某个具体的人。**换个角色还照样成立的三项，就是写坏了。**\n\n")
        + characterText(char, "【note】用查体那种冷静的观测口吻写，但内容必须是**他今天真实经历过的事**：熬夜看什么看到几点、为什么突然心跳飙起来、去了哪、跟谁吵了、吃了什么没吃成什么。不许写「建议保持规律作息」这类套话。\n")
        + characterText(char, "【quote】切回他本人的口气，带脾气、带私心，可以刻薄可以得意，**和上面那段冷静的观测形成反差**——那道反差跟 chief 与 exam 之间那道是同一道缝。\n\n")
        + characterText(char, "since：一句话，**自上次看大夫之后他身上发生了什么**（没看过大夫就写这几天身上的变化）。很短。\n")
        + "timeline **4-6 条**：time（HH:mm）、tag（两三个字的类别，用上面那些指标名里的词）、text（一句 25-45 字，说清那个时刻身体发生了什么、为什么）。按时间顺序。\n"
        + characterText(char, "tail：最后一句他自己的话，一两句。"),
      schemaHint: characterText(char, "{\"visits\":[{\"date\":\"2026-08-21\",\"who\":\"这位大夫在他世界里怎么被称呼\",\"chief\":\"他自己说哪儿不舒服，用他的原话\",\"exam\":\"身体实际显示出什么，带读数\",\"impression\":\"大夫据此判断什么\",\"orders\":\"让他去做什么\",\"followup\":\"上次约好的事他做到没有\"}],\"since\":\"自那次之后身上发生了什么\",\"cards\":[{\"slot\":\"上面那个英文key原样照抄\",\"name\":\"这个角色对这一项的叫法\",\"value\":\"6.2\",\"unit\":\"h\",\"num\":62,\"tag\":\"欠佳\",\"note\":\"一段观测叙述\",\"stats\":[{\"k\":\"角色专属项\",\"v\":\"02:15\"},{\"k\":\"角色专属项\",\"v\":\"1.1h\"},{\"k\":\"角色专属项\",\"v\":\"3次\"}],\"quote\":\"他自己的一句话\"}],\"timeline\":[{\"time\":\"02:34\",\"tag\":\"两三个字的类别\",\"text\":\"一句\"}],\"tail\":\"最后一句\"}")
    },
    clipboard: {
      instruction: "推演「" + char.name + characterText(char, "」手机剪贴板里最近躺着的东西（5-7 条）。每条给 text（复制的原文）、from（从哪个 app 复制的）、time、sent（true=后来发出去了；false=复制了但一直没发）。\n**必须至少有一条 sent=false，而且是他打给某个具体的人、却始终没发出去的话。**这是「差一点就说了」的物证，是这个 app 唯一重要的东西。它不必长，可以只有半句，可以很难看、很没出息、说到一半停住。\n其余的可以很杂很无聊：验证码、快递单号、店铺地址、一个人名、一句歌词、一个链接。别每条都深情。") + relHint,
      schemaHint: "{\"items\":[{\"text\":\"复制的原文\",\"from\":\"从哪个 app 复制的\",\"time\":\"昨天 02:11\",\"sent\":false}]}"
    },
    takeout: {
      instruction: "推演「" + char.name + "」点餐 App 的整个界面。" + relHint + "\n"
        + characterText(char, "**所有店铺、菜名、价格都要贴合他的身份、时代和谋生方式**：古代角色是从街市的铺子叫吃食、由跑腿送到门上；现代角色就是正常外卖。别人人都点贵的。\n\n")
        + characterText(char, "account：name（**他在这个平台上的昵称**，不是本名照抄；这种账号名往往随手起、有点敷衍或自嘲）、uid（平台号，一串数字或字母数字）、member（会员等级的叫法，按这个平台在他世界里的说法起）、monthOrders、monthSpend（数字）、persona（一句他点餐的性格：他叫外卖时最像他自己的那个毛病）。\n\n")
        + characterText(char, "today 今日推荐（一条）：addrLabel（送到哪，一两个字的地方别名）、addrDetail、date（如「8月28日 周五」）、meal（早餐/午餐/晚餐/夜宵）、shop、rating（店铺评分，如「4.6」）、eta（如「12:45送达」）、delivery（配送方式的叫法）、main（主推那道菜，**后面用括号带上他每次都要的规格**）、amount（数字）、status、note（下单备注）。\n\n")
        + characterText(char, "shops 常点商家 **4-5 家**：name、cat、times（点过多少次，写成一句）、usual（他每次都点的）、why（一句为什么总是这家，具体到掌柜脾气、火候、开到几时）、last（上次什么时候）、cover（0-5 整数定色）。\n\n")
        + "live 正在送的 **0-2 单**：status、eta、shop、items（一句话说清点了什么）、rider、step（0-3 的整数：0已下单 1商家接单 2配送中 3待送达）、amount、note。\n\n"
        + characterText(char, "orders 我的订单 **6-8 单**：**id（这一单的编号，同一单以后刷新也必须是同一个 id——钱包靠它认账）**、shop、time、meal（餐次）、status、main（主菜一行）、items（1-3 样，各有 name、spec 规格、qty、price）、pack（包装费数字）、fee（配送费数字）、amount（实付数字）、stars（1-5 整数）、rating（他写的评价，一句，很实在）、tags（2-3 个：品类、餐次、付款方式各一个）、addr、note（**下单备注**）、reason（**为什么这一单**，一句，可以牵涉到人）。\n")
        + characterText(char, "**note 那一栏是这个 app 的重点**：同样一句备注，写给谁、护着谁、怕吵着谁，是三个不同的人。要像真人当场打的字，宁可留空也别写成客服模板。**至少一单是深夜的，至少两单是送到别人那儿的（addr 写那个地方，不是他自己住处）。**\n")
        + "送到别人那儿的那几单，reason 要说清**送给谁、为什么是这个时候**——界面上「送到别人那儿」那一格就是把这几单按地方拢起来的，那儿读到的全部内容就是这一栏。\n\n"
        + characterText(char, "taste 口味：spicyTags（辣度，2-3 个短词的数组）、avoidTags（**忌口，3-4 个**——这一组比爱吃什么更像人。**别只写食材名**，要写清他嫌它哪一点，越具体越像他）、likeTags（偏好，3-4 个）、budget（一句预算）、habit（一句点餐习惯，什么时辰点、为什么点）。\n\n")
        + characterText(char, "coupons 红包卡券 **2-4 张**：amount（如「50」或「免跑腿脚钱2文」）、unit（如「元」，amount 已经是整句时留空）、name（券名，按他世界里的叫法起，别用现代满减券的套话）、scope（哪家可用）、until（到期）。\n\n")
        + characterText(char, "addrs 常用地址 **2-3 条**：label（地址别名，**后面用括号补一句这是谁的地方／去干嘛的**）、tail（尾号数字）、detail（详细到怎么送、怎么放、进哪个门——**要具体到只有常来的人才写得出**）、isDefault（只有一条 true）。**其中一条应当是【他常去投喂的另一个地方】，不是自己住处。**\n\n")
        + characterText(char, "wish 想吃清单 **3-5 条**：title（想吃的东西，可以很长很具体）、when（**什么时候会突然想起它**——写那个当下他在哪、在受什么罪、嘴里是什么味）。\n\n")
        + characterText(char, "monthNote：本周点餐概况，一段 70-110 字。tail：最后一两句他自己的念叨。"),
      schemaHint: characterText(char, "{\"account\":{\"name\":\"平台昵称\",\"uid\":\"88412037\",\"member\":\"会员等级的叫法\",\"monthOrders\":22,\"monthSpend\":1180,\"persona\":\"一句性格\"},\"today\":{\"addrLabel\":\"家\",\"addrDetail\":\"详细地址\",\"date\":\"8月28日 周五\",\"meal\":\"午餐\",\"shop\":\"店名\",\"rating\":\"4.6\",\"eta\":\"12:45送达\",\"delivery\":\"配送方式的叫法\",\"main\":\"主推菜（他每次都要的规格）\",\"amount\":68.5,\"status\":\"已送达\",\"note\":\"备注\"},\"shops\":[{\"name\":\"店\",\"cat\":\"品类\",\"times\":\"点过 24 次\",\"usual\":\"常点\",\"why\":\"为什么总是这家\",\"last\":\"今天中午\",\"cover\":0}],\"live\":[{\"status\":\"配送中\",\"eta\":\"预计 13:30 送达\",\"shop\":\"店\",\"items\":\"点了什么\",\"rider\":\"送的人怎么称呼\",\"step\":2,\"amount\":42,\"note\":\"\"}],\"orders\":[{\"id\":\"这一单的编号，同一单永远不变\",\"shop\":\"店\",\"time\":\"今天 12:10\",\"meal\":\"午餐\",\"status\":\"已完成\",\"main\":\"主菜\",\"items\":[{\"name\":\"菜\",\"spec\":\"规格\",\"qty\":1,\"price\":52}],\"pack\":0,\"fee\":2,\"amount\":68.5,\"stars\":5,\"rating\":\"一句评价\",\"tags\":[\"品类\",\"餐次\"],\"addr\":\"送到哪\",\"note\":\"备注\",\"reason\":\"为什么这一单\"}],\"taste\":{\"spicyTags\":[\"辣度短词\"],\"avoidTags\":[\"忌口，写清嫌它哪点\"],\"likeTags\":[\"偏好短词\"],\"budget\":\"一句\",\"habit\":\"一句\"},\"coupons\":[{\"amount\":\"50\",\"unit\":\"元\",\"name\":\"券名\",\"scope\":\"哪家可用\",\"until\":\"8月31日\"}],\"addrs\":[{\"label\":\"地址别名（这是谁的地方）\",\"tail\":\"3391\",\"detail\":\"详细与备注\",\"isDefault\":true}],\"wish\":[{\"title\":\"想吃的东西\",\"when\":\"什么时候会想起它\"}],\"monthNote\":\"一段\",\"tail\":\"最后一句\",\"retired\":{\"wish\":[\"不惦记了的\"],\"shops\":[\"已经不去了的那家\"]}}")
    },
    bili: {
      instruction: "推演「" + char.name + "」白天刷的视频站（仿 bilibili）。\n"
        + characterText(char, "me：他自己的账号——name（**他给自己取的用户名**，不是本名照抄；这种名字往往随手起、有点中二或自嘲）、uid（一串数字）、level（1-6 整数）、followers（关注了多少人，数字）、fans（粉丝数，数字，多数人很少）、coins（硬币数）。\n")
        + characterText(char, "tabs：他首页顶上的分区标签 **4-6 个**，按他真实的口味排（如「推荐」「科技」「生活」「鬼畜」「纪录片」）。\n")
        + characterText(char, "items **正好 10 条**视频，每条：title（真实感的视频标题，长短不一，可以有那种很长的标题党）、up（UP主名）、tab（属于上面哪个分区）、duration（如 08:24 / 1:12:05，按内容类型给合理长度）、views（播放量，如「12.4万」「873」）、danmaku（弹幕数，数字）、desc（视频简介一两句）、thought（**他看完的真实想法**，一句，可以很敷衍、可以骂、可以只是「行吧」）。\n")
        + characterText(char, "**myDanmaku：他自己在这个视频里发过的弹幕，0-3 条。**这是这个 app 最好的东西——**弹幕是他忍不住开口的地方**，短、脱口而出、没措辞，跟他在别处说话的样子可以完全不同。多数视频他是不发弹幕的（留空数组），只在真被戳到时才发。弹幕要短（十几个字以内），像真弹幕：可以是吐槽、接梗、数字刷屏、突然一句真心话。\n")
        + characterText(char, "【内容要贴人设】十条要有层次：他真正在追的、随手点开的、无聊到底的、别人推给他的、以及一两条跟他职业或麻烦事有关的。别十条都是同一类。视频要像那个世界里真会有的东西——不必强行套现代，但要是他刷得到的。") + relHint,
      schemaHint: characterText(char, "{\"me\":{\"name\":\"用户名\",\"uid\":\"3947201\",\"level\":5,\"followers\":128,\"fans\":37,\"coins\":412},\"tabs\":[\"分区名\",\"分区名\"],\"items\":[{\"title\":\"视频标题\",\"up\":\"UP主\",\"tab\":\"分区\",\"duration\":\"08:24\",\"views\":\"12.4万\",\"danmaku\":320,\"desc\":\"简介\",\"thought\":\"他看完的想法\",\"myDanmaku\":[\"他发的弹幕\"]}]}")
    },
    latenight: {
      instruction: "推演「" + char.name + "」深夜独自看的小电影（**正好 10 条**）。尺度该多大就多大，不要含糊其辞、不要写成文艺片。\n"
        + characterText(char, "每条：title（标题）、duration（如 00:18:42 / 01:45:20，符合这类片子的合理长度）、tags（2-4 个标签的字符串数组）、views（播放量）、thought（点开那一秒他在想什么，一句，赤裸、不修饰）。\n")
        + characterText(char, "另给 me：uid（这种站子上他没有名字，只有一串数字或字母）、lastAt（上次是什么时候，如「前天 03:12」）、note（一句他自己都不愿承认的旁白）。\n")
        // 病：所有角色都往「强势占有」那一头写（她 2026-08-29 报）。那不是哪个词写坏了，
        // 是这一栏除了「一个角色 + 深夜看的片」几乎没给别的约束，剩下的空白由训练先验补上，
        // 而这个题材的先验就是支配。治法跟人设被截断那次一样：不是加禁令，是把维度铺开，
        // 让TA必须先在几根互不相干的轴上各选一头，答案才有地方长出来。
        + characterText(char, "【先定他站在哪几根轴上，再写这十条】欲望不是一条从轻到重的直线，是好几根互不相干的轴。动笔前先想清楚这个人在下面每一根上偏向哪一头，**再让十条分散落在不同的轴上**：\n")
        + characterText(char, "· 他要的是自己掌控局面，还是要有人替他拿主意，还是根本不在这条轴上；\n")
        + characterText(char, "· 他是在看别人，还是在想象自己被看；\n")
        + characterText(char, "· 他要陌生、一次性的，还是要认识很久的那种熟；\n")
        + characterText(char, "· 他要用力和快，还是要慢和长；\n")
        + "· 要不要有情节、有没有对话，还是根本不需要；\n"
        + characterText(char, "· 他代入的是哪一边——也可能哪边都不代入，只是在旁边看着。\n")
        + characterText(char, "【这一栏最容易写坏的地方】不要默认每个人的欲望都往「支配 / 占有 / 强势」那一头去。那是最省事的答案，**也是换成任何一个角色都照样成立的答案——照样成立就等于没写**。有人要的是被照顾，有人要的是自己失控，有人要的是被当成平等的人，有人只是想有一段不必说话的时间。他要哪一种，从他的人设长出来，不从这个题材的惯例长出来。\n")
        + characterText(char, "【十条要有差别】不是同一个口味重复十遍：有他最常回去的那几条、有一次性点开就关的、有他自己都嫌过火的、也可以有跟某个具体的人有关的那种。标签要落到具体的场合、身份、动作或情境上，**别用那种换个角色照样贴得上的形容词**。")
        // 群里 2026-10-17：「深夜台有时候会自己脑补 bl、一直嗑 char」——没交代他喜欢谁，模型就拿他认识的别的角色互相配起来
        + characterText(char, "\n【他被谁吸引，照他自己的人设】性向和偏好以人设、关系里写的为准，没写就别替他另定一个方向，也别因为题材默认往哪一边写。"
          + "「跟某个具体的人有关」只能是他人设或关系里真对其有感觉的那个人；**别把他认识的其他角色拉进来互相配对**，那是旁观者在嗑 CP，不是他自己深夜会点开的东西。"),
      schemaHint: "{\"me\":{\"uid\":\"u_7741903\",\"lastAt\":\"前天 03:12\",\"note\":\"一句旁白\"},\"items\":[{\"title\":\"标题\",\"duration\":\"00:18:42\",\"tags\":[\"tag1\",\"tag2\"],\"views\":\"3.2万\",\"thought\":\"想法\"}]}"
    },
    mail: {
      instruction: "推演「" + char.name + "」的邮箱。\n"
        + characterText(char, "me：addr（他的邮箱地址，**从他的身份和年代来定**，不是随手编一串）、name（发件人显示名）、sign（邮件签名档，一到两行）。\n")
        + characterText(char, "inbox 收件箱 **8-12 封**：from（谁发的）、fromAddr、subject（主题）、time、kind（这封属于哪一类）、unread（true/false）、preview（列表里露出来的那一截）、body（正文，3-6 句，写成那类邮件真正的样子）、thought（他看完心里那句，一句，可空——大多数邮件他心里什么都没有，那就留空）。\n")
        + characterText(char, "sent 发出去的 **3-5 封**：to、subject、time、body（他写的正文）。\n")
        + characterText(char, "drafts 草稿 **1-3 封**：to、subject、body、savedAt（存了多久）——**草稿是这个 app 最有东西的一栏**：写了没发的那封，通常是他不敢发或者不知道怎么措辞的。\n\n")
        + characterText(char, "【这一栏的全部意义是【落差】】邮件里的他是【对陌生人和上级说话】的样子：客气、绕、留余地、把话说死之前先铺三层。")
        + characterText(char, "**这个腔调和他私下说话的差距，就是这个 app 要给出来的东西**——同一个人，一边是邮件里那套滴水不漏的说法，一边是他在便签里骂的那句。\n")
        + characterText(char, "【收件箱要杂】不是每封都重要：该有正事、有账单、有他懒得退订的推送、有群发的、有一封他一直没回的。**一直没回的那封最说明人。**\n")
        + "【不要和微信撞车】微信是熟人和随口，这儿是正式的往来。同一件事不要在两处各写一遍。",
      schemaHint: characterText(char, "{\"me\":{\"addr\":\"他的邮箱地址\",\"name\":\"发件人显示名\",\"sign\":\"签名档\"},\"inbox\":[{\"from\":\"谁发的\",\"fromAddr\":\"地址\",\"subject\":\"主题\",\"time\":\"今天 09:12\",\"kind\":\"哪一类\",\"unread\":true,\"preview\":\"列表里那一截\",\"body\":\"正文\",\"thought\":\"他心里那句\"}],\"sent\":[{\"to\":\"寄给谁\",\"subject\":\"主题\",\"time\":\"昨天 18:40\",\"body\":\"正文\"}],\"drafts\":[{\"to\":\"本来要寄给谁\",\"subject\":\"主题\",\"body\":\"正文\",\"savedAt\":\"存了多久\"}],\"retired\":{\"drafts\":[\"发出去或删掉的草稿主题\"]}}")
    },
    tally: {
      // 她 2026-08-31：「如果我和她不是恋人（她自己有 cp）这块写的还是我和她的账本
      // 而且会有点恋爱倾向的写法」。原来这一栏把「这本账」直接钉成了TA和用户之间那
      // 一本，还配了一整套恋爱腔的词（兜底、舍不得、放过的狠话）。于是不管什么关系，
      // 出来的都是一本情账。
      // 改成：这是【TA自己的一本账】，跟谁有账写谁；用户是其中一个人，占多大篇幅由
      // 真实关系决定。腔调也从关系里长出来，不预设是哪一种。
      instruction: "推演「" + char.name + "」心里那本【没结清的账】。\n"
        + "**这本账不记钱**——钱是钱包的事。这儿记的是没结清的东西：欠着的、替谁挡过的、放过的狠话、"
        + "舍不得的、拿不准的、看不顺眼又没发作的、受了没还的。\n"
        + characterText(char, "⚠️**这不是「他和用户之间」那一本，是他自己的那一本。** 每一条都要写清楚这笔账是【跟谁】的（who）：")
        + characterText(char, "可以是用户，也可以是他的家人、同伙、对头、旧相识、他自己的那个人。上面那一段写着他跟谁是什么关系，照它来。\n")
        + "⚠️**腔调从关系里长出来，别预设是哪一种。** 欠人情、赌一口气、敬着、瞧不上、亏欠、还不清——"
        + characterText(char, "全都是账。**把每一条都写成情账是这一栏最容易犯的错**：跟他不是那种关系的人，")
        + "写出来却字字含情，那就是写坏了。\n"
        + "所有内容必须从【真实发生过的事】里长出来（关系、记忆、印象、这阵子的来往）；写不出具体的，那一栏宁可少给两条，也不要拿泛泛的关系描述凑数。\n\n"
        + "五栏，各自的写法（每一栏的每一条都要有 who）：\n"
        + "① debts（4-7 条）没结清的账。每条：who 这笔是跟谁的、title 一句话说清欠的是什么、"
        + characterText(char, "dir 填 mine（他欠对方）/ theirs（对方欠他）/ open（两边都没说清、悬着）、note 一句他自己怎么想这笔。\n")
        + characterText(char, "   ⚠️theirs 那几条**不是他在讨债**——写成他自己惦记着的一件还没完的事，主语是他的在意，不是对方的亏欠。写成指责就是写坏了。三种都要有，别一边倒。\n")
        + characterText(char, "② policies（2-4 条）他给某个人兜的底，**写成保险条款那种腔调**：who 承保的是谁、name 险种名、scope 一句承保范围、terms 理赔条件（写成对方要做到什么，那句话里要看得出他的脾气）、clause 一句正文条款（承保人负责做什么）。\n")
        + characterText(char, "   条款体的用处是**逼他把说不出口的东西写成义务**——一个不肯说软话的人，在条款里反而什么都答应了。这层落差是这一栏的全部意义。")
        + "兜底不等于情话：可以是护着一个晚辈、担着一个同伙的烂摊子、也可以是给自己留的那一条。\n"
        + characterText(char, "③ statements（4-6 条）他盖过章的定论，每条一句他会亲口说出来的话。who 这句是冲谁去的、text 那句话本身、heat 这句话的温度（一个字或两个字，从这句话的力道来定，别都用同一个）、")
        + characterText(char, "truth 这句话底下真正的意思——**他嘴上这么说，心里其实是什么**。\n")
        + characterText(char, "   ⚠️truth 不是把 text 换个说法再讲一遍，也不是替他解释这句话什么意思。它要说的是【那句话没说出来的那一半】：")
        + "嘴上是硬的、底下是软的，嘴上是随口、底下是记了很久的。两句话之间必须有落差，没有落差就说明这一条写坏了。\n"
        + characterText(char, "④ treasures（3-5 条）他心里估价最高的东西，**用估值的语言说**：who 这样东西跟谁有关（也可以是他自己）、title 那样东西是什么（可以是一个瞬间、一个习惯、一份证据）、kind 归成哪一类、worth 他给的估价（用估价的口吻，不是数字）。\n")
        + characterText(char, "⑤ appraisals（3-5 条）他自己给自己的定论，问答体：q 一个悬着的问题（这个问题得是他真会在心里问自己的）、a 他的答案，一到两句，说死不留余地。这一栏的 who 多半是他自己。\n\n")
        + "【最容易写坏的地方】这本账要能一眼看出是【这个人】的账。换成任何一个角色都照样成立的条目就是写坏了——那种句子只是在描述「有点在乎某人」，谁都能写。"
        + characterText(char, "每一条都要能指回一件具体的事：某次没做到的、某次替谁挡下的、某句被记住的话、某个他不肯承认自己在留意的细节。"),
      schemaHint: characterText(char, "{\"debts\":[{\"who\":\"这笔是跟谁的\",\"title\":\"欠的是什么\",\"dir\":\"mine或theirs或open\",\"note\":\"他怎么想这笔\"}],\"policies\":[{\"who\":\"承保的是谁\",\"name\":\"险种名\",\"scope\":\"承保范围\",\"terms\":\"理赔条件\",\"clause\":\"条款正文\"}],\"statements\":[{\"who\":\"冲谁去的\",\"text\":\"他会亲口说的一句\",\"heat\":\"这句话的温度\",\"truth\":\"这句话底下真正的意思\"}],\"treasures\":[{\"who\":\"跟谁有关\",\"title\":\"那样东西\",\"kind\":\"归哪一类\",\"worth\":\"他给的估价\"}],\"appraisals\":[{\"who\":\"多半是他自己\",\"q\":\"悬着的问题\",\"a\":\"他的答案\"}]}")
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
  // 新加一个 app 时不必记得手动补，漏不掉（施工规则/four-surfaces-same-context.md）。
  const angle = PHONE_ANGLE[key] ? "\n\n" + PHONE_ANGLE[key] : "";
  // 输出天花板统一给满（同 StylePresets.OUT_CEILING / trpg 的 TOK_MAX）。
  // max_tokens 是【天花板】不是预付款：她按次计费，给大了不多花一分钱，给小了才要命——
  // 思考型模型的推理 token 也从这里扣，压小了推理吃完、正文只剩两百来字。
  // 以前这里每个 app 各写一个数（2200~30000），相册和微信被截断过就是因为那个数拍小了。
  // 控制篇幅的活儿交给 instruction 里写的条数和字数，不是拿额度去掐。
  // 已经钉死的身份（号码/账号/住址/忌口）原样发回去，让新写的内容跟它对得上——
  // 光在存的时候覆盖回去不够：模型不知道收货地址是哪儿，编的订单会送去别处，
  // 界面上一半是钉死的旧地址、一半是新编的，比不钉还乱。
  // 「TA跟谁有账」只发给账本这一栏：别处不需要，她按次计费。
  // ⚠️不是「四处一样喂」的例外——那条讲的是同一层能力要在四个场合都给到；
  // 这一段是账本这一栏专属的取材facts，别的 app 本来就不看。
  const bondBlock = (key === "tally" && bond) ? bond : "";
  const _full = spec.instruction + phoneOwnOnlyBlock(char.name) + bondBlock + angle + PHONE_WORLD_RULE + phoneMoneyBlock(key, money) + phoneIdentityBlock(key, known) + phoneEvolveBlock(key, known) + phoneRosterBlock(key, known) + phoneWatchDraftBlock(key, known) + phoneSelfAvoidBlock(key, known) + phoneQuoteAvoidBlock(key, known) + phoneAvoidBlock(avoidLines) + phoneLangBlock(lang) + (weekly ? PHONE_WEEKLY_HINT : "");
  return { ...spec, maxTokens: PHONE_OUT_CEILING, instruction: _full };
}
// 纯函数导出给 node --test；浏览器里没有 module，原样跳过
// phoneProbeSpec 也导出：测试该核【拼出来的那份提示词】，不是核源码里的字符串——
// 源码里一句话常被 + 断成好几段，照着源码写断言既难写又冻长相。
// 浏览器里没有 module，用一个全局挂出去给 app.js 调（跟 IfKit / GachaKit 一个叫法）
if (typeof window !== "undefined") window.PhoneKit = {
  ownOnlyBlock: phoneOwnOnlyBlock,
  nameKeys: phoneNameKeys, samePerson: phoneSamePerson,
  dropDupWechat: phoneDropDupWechat, keptLine: phoneKeptLine,
  dropEchoes: phoneDropEchoes, chatWhen: phoneChatWhen, gateVisits: phoneGateVisits,
  photoSig: phonePhotoSig, keptPhotos: phoneKeptPhotos, keepLoad: phoneKeepLoad,
  resetApp: phoneResetApp, archDropApp: phoneArchDropApp, resetStored: phoneResetStored,
  langBlock: phoneLangBlock, LANG_MODES: PHONE_LANG_MODES, LANG_ZH: PHONE_LANG_ZH
};
if (typeof module === "object" && module.exports) module.exports = { phoneResetStored, phoneResetApp, phoneArchDropApp, PHONE_LANG_MODES, PHONE_LANG_ZH, phoneLangBlock, PHONE_ACTION_WIDGETS, phoneTa, charTa, phoneProbeSpec, phoneOwnOnlyBlock, phoneKeptLine, phoneNameKeys, phoneSamePerson, phoneDropDupWechat, phoneDropEchoes, phoneGrowList, phoneChatWhen, phoneVisitHint, phoneGateVisits, phonePhotoSig, PHONE_VISIT_GAP_DAYS, phoneMergeShelves, phoneApplyBookUpdates, phoneGrowMerge, PHONE_RETIRE, PHONE_GROW, PHONE_WATCH_KEEP, PHONE_WATCH_KEEP_DAYS, phoneWatchKeep, phoneWatchDraftBlock, phoneMergeSaved, WATCH_BUY_APPS };
