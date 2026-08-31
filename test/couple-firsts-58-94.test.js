const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const K = require("../js/couple-firsts.js");
const app = R("app.js"), scr = R("screens.js");
const DAY = 86400000;
const NOW = Date.UTC(2026, 7, 31, 12);

// 言秋提、她 2026-08-31 拍板。这一层的全部价值在一句话上：
// **从已有数据推出来，一个钩子都不挂。** 挂钩子＝五处会腐烂（这个库反复栽的那个形状），
// 而且在这之前发生过的事永远补不回来。推导没有这个问题。
test("一个钩子都不挂：没有任何地方在「记一笔第一次」", () => {
  ["x_firsts", "x_coupleFirsts", "x_milestone", "addFirst(", "markFirst("].forEach(k =>
    assert.ok(app.indexOf(k) < 0, "挂钩子了：" + k));
  assert.match(app, /const coupleFirstsFor = cid => \{/, "没有推导那一处");
  const fn = app.slice(app.indexOf("  const coupleFirstsFor = cid => {"), app.indexOf("  const DRAWER_CAP"));
  ["callAI", "runProbe", "await "].forEach(k => assert.ok(fn.indexOf(k) < 0, "里程碑册花调用了：" + k));
  assert.ok(fn.indexOf("saveJSON") < 0, "推导那一处还落了盘——推出来的东西不该存");
});

test("只认最早的那一条", () => {
  const r = K.coupleFirsts({
    since: NOW - 400 * DAY,
    offlines: [{ startTs: NOW - 10 * DAY }, { startTs: NOW - 300 * DAY }, { startTs: NOW - 50 * DAY }]
  }, NOW);
  const off = r.find(x => x.key === "offline");
  assert.equal(off.ts, NOW - 300 * DAY, "拿了最近那一场，不是第一场");
});

// 「他写的第一封信」——我自己写的那封不算
test("作者分得清：我写的不算他写的", () => {
  const r = K.coupleFirsts({
    letters: [{ authorId: "user", createdAt: NOW - 380 * DAY, title: "我写的" },
              { authorId: "c1", createdAt: NOW - 50 * DAY, title: "他写的" }]
  }, NOW);
  const lt = r.find(x => x.key === "letter");
  assert.equal(lt.ts, NOW - 50 * DAY);
  assert.equal(lt.note, "他写的", "引错了那一封");
});

// 天数只列【已经走到的】。没走到的列出来就成了倒计时——那是「我们的日子」那一页的活
test("天数走到了才算数，没到的不列", () => {
  const r = K.coupleFirsts({ since: NOW - 150 * DAY }, NOW);
  const days = r.filter(x => /^day/.test(x.key)).map(x => x.key);
  assert.deepEqual(days, ["day100"], "列了还没走到的天数：" + days.join(" "));
  // 在一起当天算第 1 天：第 100 天是 since + 99 天
  assert.equal(r.find(x => x.key === "day100").ts, NOW - 150 * DAY + 99 * DAY, "第 100 天算错了一天");
  assert.deepEqual(K.coupleFirsts({}, NOW).filter(x => /^day/.test(x.key)), [], "没有起始日也硬算天数");
});

test("按时间从早到晚排，缺的那几项不占位", () => {
  const r = K.coupleFirsts({ since: NOW - 400 * DAY, drawer: [{ ts: NOW - 2 * DAY, title: "从檐下捡的" }] }, NOW);
  for (let i = 1; i < r.length; i++) assert.ok(r[i].ts >= r[i - 1].ts, "没排好序");
  ["call", "duo", "letter", "exdiary", "note", "pact", "card", "ssr"].forEach(k =>
    assert.ok(!r.some(x => x.key === k), "没有的项也列出来了：" + k));
  assert.equal(K.coupleFirsts({}, NOW).length, 0, "什么都没有的时候不该凭空长出条目");
  assert.equal(K.coupleFirsts(null, NOW).length, 0);
});

test("SSR 那一条只认 SSR", () => {
  const r = K.coupleFirsts({ cards: [
    { ts: NOW - 9 * DAY, r: "R", name: "他相册里的一张" },
    { ts: NOW - 5 * DAY, r: "SR", name: "一句他此刻没说出口的话" },
    { ts: NOW - 3 * DAY, r: "SSR", name: "他的一段过去" }] }, NOW);
  assert.equal(r.find(x => x.key === "card").ts, NOW - 9 * DAY, "第一次抽卡拿错了");
  assert.equal(r.find(x => x.key === "ssr").ts, NOW - 3 * DAY, "第一张 SSR 拿错了");
  assert.equal(r.find(x => x.key === "ssr").note, "他的一段过去");
});

// 言秋原提案里「配一句角色口吻的注」要花调用。这儿改成【引原物】——
// 引来的是真发生过的那一句，比现编一句更像回事，而且零成本。
test("底下那句注是引原物，不是现编的", () => {
  const long = "这一句特别特别长，长到必须被截断才不会把那一行撑爆，后面还有好多字好多字好多字";
  const r = K.coupleFirsts({ notes: [{ createdAt: NOW - DAY, content: long }] }, NOW);
  const n = r.find(x => x.key === "note").note;
  assert.ok(long.indexOf(n.replace("…", "")) === 0, "注不是从原物上摘的");
  assert.ok(n.length <= 27, "没截断，会把那一行撑爆");
  assert.match(n, /…$/, "截断了却没留省略号");
  // 换行/多余空白要压平，不然时间轴上一条会顶掉三行
  const r2 = K.coupleFirsts({ notes: [{ createdAt: NOW - DAY, content: "上面一行\n\n  下面一行" }] }, NOW);
  assert.equal(r2.find(x => x.key === "note").note, "上面一行 下面一行");
});

test("接进情侣空间，是整页", () => {
  assert.match(scr, /sub === "firsts"\) \{/, "情侣空间里没有这一页");
  assert.match(scr, /tile\("firsts", \{ e: "🏷", zh: "第一次们"/, "首页上没有入口");
  assert.match(app, /coupleFirstsOf: coupleFirstsFor,/, "没传下去");
  const ui = scr.slice(scr.indexOf("function CoupleFirstsBook({"));
  assert.ok(ui.indexOf("h(Sheet") < 0, "用半窗了");
  assert.match(ui, /className: "h-full flex flex-col"/);
  assert.match(ui, /className: "flex-1 min-h-0 overflow-y-auto/);
  assert.match(ui, /paddingTop: safeTop\(10\)/, "顶栏没吃安全区");
});
