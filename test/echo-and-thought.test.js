const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-08-22：「心声也好久不更新了」「而且还在反问我」。
// 两条都是【提示词写了但压不住】——和句尾句号那次一样，得上确定性的刀 / 把状态喂回去。

// v55.70 起判据抽成共用的 isEchoOfUser（线上线下同一套），抠函数时要连它一起带上
const strip = (() => {
  const g = n => { const i = engine.indexOf(n); return engine.slice(i, engine.indexOf("\n}\n", i) + 2); };
  const consts = engine.slice(engine.indexOf("const ECHO_TAIL ="), engine.indexOf("function echoCore("));
  return new Function(consts + g("function echoCore(") + g("function isEchoOfUser(")
    + g("function stripEchoQuestion(") + "\nreturn stripEchoQuestion;")();
})();

test("回声反问：她刚说过那个词才削", () => {
  assert.deepEqual(strip(["自拍？", "行，别后悔"], "那自拍"), ["行，别后悔"]);
  assert.deepEqual(strip(["喝酒？", "嗯，跟程策"], "你在喝酒吗"), ["嗯，跟程策"]);
});

// v55.13：头一版只认「整个第一泡就是回声」，模型立刻学会了绕——把本该分开的两泡
// 硬合成一泡发（她 2026-08-22 当场抓到：「为了把反问发出来硬生生二合一了」）。
test("合并型也要削：挤进同一条消息不算逃过", () => {
  assert.deepEqual(strip(["自拍？行，别后悔"], "那自拍"), ["行，别后悔"]);
  assert.deepEqual(strip(["喝酒？嗯，跟程策", "待会聊"], "你在喝酒吗"), ["嗯，跟程策", "待会聊"]);
  // 合并型不受「必须还剩别的泡」限制——削完本来就还剩后半句
  assert.equal(strip(["自拍？行"], "那自拍").length, 1);
  // 提示词那边也要堵这条后路，不然它换个花样还来
  assert.match(engine, /把它和后半句挤进同一条消息里也一样是回声，别用这个办法把它留下来/);
});

test("真反问一个都不许误杀", () => {
  // 她没说过这个词 → 是他自己在惊讶
  assert.deepEqual(strip(["真的吗？", "我不信"], "我把工作辞了"), ["真的吗？", "我不信"]);
  // 连问是情绪，不是回声——分开发、挤一起发都不动
  assert.deepEqual(strip(["自拍？现在？", "行吧"], "那自拍"), ["自拍？现在？", "行吧"]);
  assert.deepEqual(strip(["自拍？现在？行吧"], "那自拍"), ["自拍？现在？行吧"]);
  // 没问号不算
  assert.deepEqual(strip(["你说什么", "我没听清"], "那自拍"), ["你说什么", "我没听清"]);
  // 长句不算，那是有内容的问句
  assert.deepEqual(strip(["你真要看自拍？", "行"], "那自拍"), ["你真要看自拍？", "行"]);
  assert.deepEqual(strip(["你真要看自拍？行"], "那自拍"), ["你真要看自拍？行"]);
});

test("绝不把话削光：只有一泡时宁可留着回声", () => {
  assert.deepEqual(strip(["自拍？"], "那自拍"), ["自拍？"]);
  assert.deepEqual(strip([], "那自拍"), []);
});

test("接在单聊气泡流水线上，engineerEyes 照旧跳过", () => {
  assert.match(app, /if \(!_s\.engineerEyes && typeof stripEchoQuestion === "function"\) \{/);
  assert.match(app, /words = stripEchoQuestion\(words, _lastSaid \? _lastSaid\.content : ""\);/);
  // 要拿【她最近一条】来比，不是整段历史
  assert.match(app, /\[\.\.\.\(history \|\| \[\]\)\]\.reverse\(\)\.find\(m => m && m\.role === "user"\)/);
});

// —— 心声刷新 ——
test("普通角色每轮强制刷新，言秋仍由自己的协议决定", () => {
  assert.match(app, /【本轮心声·普通角色必填】/);
  assert.match(app, /每轮必须写一句，禁止 null、空串或省略/);
  assert.match(app, /else if \(!_s\.engineerEyes\)/);
  assert.match(app, /言秋由自己的协议决定是否写心声/);
});

test("缺失计数必须一直数下去，不能只在还挂着旧念头时才数", () => {
  assert.match(app, /const skips = Math\.min\(\(Number\(_live\.thoughtSkips\) \|\| 0\) \+ 1, 99\);/);
  assert.match(app, /普通角色本轮没有产出有效心声时立刻清掉旧快照/);
  // 言秋清空旧念头仍只对「确实还挂着」的情况有意义
  assert.match(app, /if \(_live\.thought && skips >= THOUGHT_SKIP_LIMIT\)/);
  assert.ok(!/\} else if \(_live\.thought\) \{/.test(app), "旧写法不许留着");
});

test("从零开始也能涨到提醒阈值", () => {
  // 把这段判定原样跑一遍：一次心声都没有过的角色，第 3 轮就该够到提醒
  let live = {}, LIMIT = 4;
  const step = () => {
    const st = {}, skips = Math.min((Number(live.thoughtSkips) || 0) + 1, 99);
    st.thoughtSkips = skips;
    if (live.thought && skips >= LIMIT) st.thought = null;
    live = { ...live, ...st };
    return skips;
  };
  assert.equal(step(), 1);
  assert.equal(step(), 2);
  assert.equal(step(), 3, "第 3 轮就要够到提醒阈值");
  for (let i = 0; i < 9; i++) step();
  assert.equal(live.thoughtSkips, 12, "一直数得下去");
});

test("普通角色连续缺失时提示模型协议不稳定", () => {
  assert.match(app, /if \(skips === 12\) toast\(/, "只在越过那一轮说一次，别每轮念");
  assert.match(app, /多半是当前聊天模型不稳定支持 thought 字段，建议换个模型试试/);
});
