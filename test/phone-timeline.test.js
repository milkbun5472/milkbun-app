// 时间线：把 16 个 app 的碎片按时间串起来。
// 这一层的全部价值就在【排序是对的】——排错一条，它讲的故事就是假的。
// 所以这份测试大头在时间解析：模型写出来的时间串写法五花八门，每一种都得验。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

// 只抽纯函数那一段跑，不碰 React。
// ⚠️vm 里造出来的数组属于另一个 realm，deepStrictEqual 会判「结构相同但不是同一个 Array」，
// 所以比较前一律 Array.from 拉回本 realm。
function loadPure() {
  const want = ["const PHONE_APPS =", "PHONE_LABEL =", "phoneStableHash =", "PHONE_CN_NUM =", "phoneNum =",
    "function phoneWhenTs", "phoneEntryId =", "function phoneTimeline", "function phoneDayLabel", "phoneClock ="];
  const lines = SRC.split("\n");
  const chunks = [];
  for (const w of want) {
    const i = lines.findIndex(l => l.includes(w));
    assert.ok(i >= 0, "源码里找不到 " + w);
    // 从这一行起，配平花括号取到该声明结束
    let depth = 0, out = [], started = false;
    for (let j = i; j < lines.length; j++) {
      out.push(lines[j]);
      for (const ch of lines[j]) { if (ch === "{") { depth++; started = true; } else if (ch === "}") depth--; }
      if (started && depth === 0) break;
      if (!started && /;\s*$/.test(lines[j])) break;
    }
    chunks.push(out.join("\n"));
  }
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(chunks.join("\n") + "\n;this.API={phoneWhenTs,phoneTimeline,phoneDayLabel,phoneClock,phoneEntryId,phoneNum};", ctx);
  return ctx.API;
}
const P = loadPure();

// 2026-08-29 周六 15:00，固定住，免得测试半夜跑起来结果不一样
const NOW = new Date(2026, 7, 29, 15, 0, 0, 0).getTime();
const ymdhm = ts => {
  const d = new Date(ts);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()].join("/");
};

test("各 app 写法不一的时间串都能落到同一根轴上", () => {
  const cases = [
    ["今天 09:12", "2026/8/29/9/12"],
    ["昨天 21:03", "2026/8/28/21/3"],
    ["前天 03:12", "2026/8/27/3/12"],
    ["14:20", "2026/8/29/14/20"],
    ["2026-08-28 18:42", "2026/8/28/18/42"],
    ["8月28日 14:15", "2026/8/28/14/15"],
    ["8月28日", "2026/8/28/12/0"],
    ["3天前", "2026/8/26/12/0"],
    ["存了 11 天", "2026/8/18/12/0"],
    ["开了 11 天", "2026/8/18/12/0"],
    ["上周", "2026/8/22/12/0"],
    ["两周前", "2026/8/15/12/0"],
    ["昨晚", "2026/8/28/22/0"],
    ["今早", "2026/8/29/8/0"],
    ["今天", "2026/8/29/12/0"],
    ["今晚 23:40", "2026/8/29/23/40"]
  ];
  for (const [input, want] of cases) {
    const ts = P.phoneWhenTs(input, NOW);
    assert.ok(ts != null, `「${input}」应该认得出来，却返回了 null`);
    assert.strictEqual(ymdhm(ts), want, `「${input}」`);
  }
});

test("相对时刻按小时/分钟往回退", () => {
  assert.strictEqual(P.phoneWhenTs("2小时前", NOW), NOW - 2 * 3600000);
  assert.strictEqual(P.phoneWhenTs("开了 2 小时", NOW), NOW - 2 * 3600000);
  assert.strictEqual(P.phoneWhenTs("40分钟前", NOW), NOW - 40 * 60000);
  assert.strictEqual(P.phoneWhenTs("刚刚", NOW), NOW - 300000);
});

test("论坛那种毫秒时间戳原样收下", () => {
  assert.strictEqual(P.phoneWhenTs(1756400000000, NOW), 1756400000000);
  assert.strictEqual(P.phoneWhenTs("1756400000000", NOW), 1756400000000);
});

test("跨年：八月里写「12月28日」是去年的，不是四个月后", () => {
  const ts = P.phoneWhenTs("12月28日", NOW);
  assert.strictEqual(new Date(ts).getFullYear(), 2025);
  assert.ok(ts < NOW, "去年的日子必须排在今天前面");
});

test("认不出来的时间一律返回 null，绝不瞎猜一个时刻", () => {
  // 排错一条，整条时间线讲的故事就是假的——宁可让它沉底显示「时间不详」
  for (const bad of ["", null, undefined, "改天", "有空的时候", "很久以前", "——", {}, []]) {
    assert.strictEqual(P.phoneWhenTs(bad, NOW), null, JSON.stringify(bad) + " 不该被猜出一个时刻");
  }
});

test("同一天里，只知道日子不知道点的条目按早/午/晚分开落位", () => {
  const morning = P.phoneWhenTs("今早", NOW);
  const noon = P.phoneWhenTs("今天", NOW);
  const night = P.phoneWhenTs("今晚", NOW);
  assert.ok(morning < noon && noon < night, "早 < 午 < 晚");
});

// ── 时间线本身 ──────────────────────────────────────────────

const DATA = {
  calls: {
    calls: [{ name: "", number: "1885522", dir: "in", time: "昨天 23:41", answered: false, gist: "没接。", thought: "深更半夜。" }],
    sms: [], voicemail: []
  },
  clipboard: { items: [{ text: "其实我", from: "微信", time: "昨天 23:52", sent: false }] },
  latenight: { me: { uid: "u1", lastAt: "昨天 00:14", note: "看完就删。" } },
  notes: { items: [{ kind: "typed", title: "算了", time: "今天 01:03", body: "" }] },
  browser: { searches: [{ q: "她说算了是什么意思", time: "今天 02:41", site: "" }], tabs: [] }
};

test("四个 app 的碎片按时间倒着串成一条线", () => {
  const tl = P.phoneTimeline(DATA, null, NOW);
  const seq = Array.from(tl, x => x.app + "@" + x.when);
  assert.deepStrictEqual(seq, [
    "browser@今天 02:41",
    "notes@今天 01:03",
    "clipboard@昨天 23:52",
    "calls@昨天 23:41",
    "latenight@昨天 00:14"
  ]);
});

test("认不出时间的沉到最底下，不插进有时刻的中间", () => {
  const tl = P.phoneTimeline({
    ...DATA,
    liked: { items: [{ author: "a", title: "没头没尾的一条", excerpt: "x", time: "改天" }] }
  }, null, NOW);
  assert.strictEqual(tl[tl.length - 1].app, "liked");
  assert.strictEqual(tl[tl.length - 1].ts, null);
  // 前面那些必须还是严格倒序
  const timed = Array.from(tl).filter(x => x.ts != null).map(x => x.ts);
  assert.deepStrictEqual(timed, [...timed].sort((a, b) => b - a));
});

test("真数据（论坛/日历）也进时间线，跟生成的那些混排", () => {
  const forumTs = new Date(2026, 7, 29, 10, 0).getTime();
  const tl = P.phoneTimeline(DATA, {
    forumAccounts: [{ label: "匿名", posts: [{ title: "只有这儿敢说", body: "正文", ts: forumTs }], comments: [] }],
    calendar: { items: [{ title: "她生日", date: "2026-08-29", time: "20:00", kind: "事件", note: "" }] }
  }, NOW);
  const apps = Array.from(tl, x => x.app);
  assert.ok(apps.includes("forum"), "论坛没进时间线");
  assert.ok(apps.includes("calendar"), "日历没进时间线");
  assert.strictEqual(tl[0].app, "calendar", "今晚 20:00 的日程该排最前");
  assert.strictEqual(tl[1].app, "forum", "上午 10:00 的匿名帖排第二");
});

test("空数据 / 脏数据不炸", () => {
  for (const bad of [null, undefined, {}, [], "字符串", { calls: null }, { calls: { calls: "不是数组" } },
    { notes: { items: [null, 3, { title: "只有标题" }] } }]) {
    const tl = P.phoneTimeline(bad, null, NOW);
    assert.ok(Array.isArray(tl), JSON.stringify(bad) + " 应该返回数组");
  }
});

test("标题和正文都空的条目不占一行", () => {
  const tl = P.phoneTimeline({ notes: { items: [{ kind: "typed", title: "", body: "", time: "今天 10:00" }] } }, null, NOW);
  assert.strictEqual(tl.length, 0);
});

// ── delta 的指纹 ────────────────────────────────────────────

test("指纹只由内容决定：同样的内容再来一遍，认得出是同一条", () => {
  const a = P.phoneTimeline(DATA, null, NOW);
  const b = P.phoneTimeline(JSON.parse(JSON.stringify(DATA)), null, NOW + 3600000);
  assert.deepStrictEqual(Array.from(a, x => x.id), Array.from(b, x => x.id),
    "同样的内容换个时刻再算，指纹必须一样——否则刷新一次全变「新」，delta 就废了");
});

test("内容改一个字，指纹就变（不然新条目会被当成看过的）", () => {
  const a = P.phoneTimeline(DATA, null, NOW)[0].id;
  const changed = JSON.parse(JSON.stringify(DATA));
  changed.browser.searches[0].q = "她说算了到底是什么意思";
  const b = P.phoneTimeline(changed, null, NOW)[0].id;
  assert.notStrictEqual(a, b);
});

test("指纹带 app 前缀：两个 app 里出现同样一句话，算两条", () => {
  const same = { text: "算了", from: "", time: "今天 10:00", sent: false };
  const tl = P.phoneTimeline({
    clipboard: { items: [same] },
    notes: { items: [{ kind: "typed", title: "算了", time: "今天 10:00", body: "" }] }
  }, null, NOW);
  assert.strictEqual(tl.length, 2);
  assert.notStrictEqual(tl[0].id, tl[1].id);
});

// ── 分天标题 ────────────────────────────────────────────────

test("按天分段的标题", () => {
  const day = (dd, hh) => new Date(2026, 7, dd, hh || 12).getTime();
  assert.strictEqual(P.phoneDayLabel(day(29), NOW), "今天");
  assert.strictEqual(P.phoneDayLabel(day(28), NOW), "昨天");
  assert.strictEqual(P.phoneDayLabel(day(27), NOW), "前天");
  assert.strictEqual(P.phoneDayLabel(day(20), NOW), "8月20日 周四");
  assert.strictEqual(P.phoneDayLabel(new Date(2025, 11, 28, 12).getTime(), NOW), "2025年12月28日 周日");
  assert.strictEqual(P.phoneDayLabel(null, NOW), "时间不详");
});

test("时刻显示补零", () => {
  assert.strictEqual(P.phoneClock(new Date(2026, 7, 29, 3, 7).getTime()), "03:07");
  assert.strictEqual(P.phoneClock(null), "");
});

// ── 未来 vs 过去 ────────────────────────────────────────────
// 日历接真数据以后，时间线里第一次有了【还没发生】的条目。
// 一起倒序排会让后天的事压在今天上面，整条线读起来是乱的。

test("还没发生的排最前面一段，而且正序（近的在前）", () => {
  const tl = Array.from(P.phoneTimeline(DATA, {
    calendar: {
      items: [
        { title: "后天要去的", date: "2026-08-31", time: "12:00", kind: "事件" },
        { title: "明天要去的", date: "2026-08-30", time: "09:00", kind: "事件" }
      ]
    }
  }, NOW));
  assert.strictEqual(tl[0].title, "明天要去的", "近的未来排前面");
  assert.strictEqual(tl[1].title, "后天要去的");
  assert.ok(tl[0].ahead && tl[1].ahead, "未来的条目要打上 ahead 标记");
  // 后面全是过去的，而且严格倒序
  const rest = tl.slice(2);
  assert.ok(rest.every(r => !r.ahead), "过去那一段里不许混进未来的条目");
  const ts = rest.filter(r => r.ts != null).map(r => r.ts);
  assert.deepStrictEqual(ts, [...ts].sort((a, b) => b - a));
});

test("今天稍早发生的不算未来（一小时内的算刚刚过去）", () => {
  const tl = Array.from(P.phoneTimeline({}, {
    calendar: { items: [{ title: "半小时前那件", date: "2026-08-29", time: "14:30", kind: "事件" }] }
  }, NOW));
  assert.strictEqual(tl.length, 1);
  assert.ok(!tl[0].ahead, "刚过去半小时的事不该被当成未来");
});

test("明天/后天的分段标题", () => {
  const day = (dd, hh) => new Date(2026, 7, dd, hh || 12).getTime();
  assert.strictEqual(P.phoneDayLabel(day(30), NOW), "明天");
  assert.strictEqual(P.phoneDayLabel(day(31), NOW), "后天");
  assert.strictEqual(P.phoneDayLabel(day(9, 12) + 86400000 * 5, NOW), "8月14日 周五");
});

test("只有日历那一路能算「还没发生」", () => {
  // 别的 app 全是【推演出来的今天】——模型写一整天的痕迹时不管现在几点，
  // 你早上七点翻手机，它照样会写「今天 14:20」。那不是预告，是这一天的记录。
  // 照时钟去判的话，早上翻手机会看到大半天的事被推进「未来」，今天这格反而空了。
  const EARLY = new Date(2026, 7, 29, 7, 0).getTime();
  const tl = Array.from(P.phoneTimeline({
    notes: { items: [{ kind: "typed", title: "下午那条", time: "今天 14:20", body: "" }] },
    calls: { calls: [{ name: "程策", time: "今天 09:12", answered: true, gist: "问事" }] }
  }, {
    calendar: { items: [{ title: "晚上要去", date: "2026-08-29", time: "20:00", kind: "日程" }] }
  }, EARLY));
  const ahead = tl.filter(r => r.ahead);
  assert.deepStrictEqual(Array.from(ahead, r => r.app), ["calendar"], "只有日历能进未来那一段");
  assert.strictEqual(tl[0].app, "calendar");
  // 生成的那两条留在过去，而且倒序
  const rest = tl.slice(1);
  assert.deepStrictEqual(Array.from(rest, r => r.title), ["下午那条", "程策"]);
});
