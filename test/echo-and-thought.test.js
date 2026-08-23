const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-08-22：「心声也好久不更新了」「而且还在反问我」。
// 两条都是【提示词写了但压不住】——和句尾句号那次一样，得上确定性的刀 / 把状态喂回去。

const strip = (() => {
  const i = engine.indexOf("function stripEchoQuestion(words, userText) {");
  return new Function(engine.slice(i, engine.indexOf("\n}", i) + 2) + "\nreturn stripEchoQuestion;")();
})();

test("回声反问：她刚说过那个词才削，只削第一泡", () => {
  assert.deepEqual(strip(["自拍？", "行，别后悔"], "那自拍"), ["行，别后悔"]);
  assert.deepEqual(strip(["喝酒？", "嗯，跟程策"], "你在喝酒吗"), ["嗯，跟程策"]);
});

test("真反问一个都不许误杀", () => {
  // 她没说过这个词 → 是他自己在惊讶
  assert.deepEqual(strip(["真的吗？", "我不信"], "我把工作辞了"), ["真的吗？", "我不信"]);
  // 连问是情绪，不是回声
  assert.deepEqual(strip(["自拍？现在？", "行吧"], "那自拍"), ["自拍？现在？", "行吧"]);
  // 没问号不算
  assert.deepEqual(strip(["你说什么", "我没听清"], "那自拍"), ["你说什么", "我没听清"]);
  // 长句不算，那是有内容的问句
  assert.deepEqual(strip(["你真要看自拍？", "行"], "那自拍"), ["你真要看自拍？", "行"]);
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

// —— 心声断档 ——
test("心声断档轮数要喂回给模型，不能只在本地数着", () => {
  assert.match(app, /const thoughtStale = Number\(\(statesRef\.current\[charId\] \|\| \{\}\)\.thoughtSkips\) \|\| 0;/);
  assert.match(app, /thoughtStale >= 3 \?/, "断档到一定程度才提醒，别每轮都催");
  assert.match(app, /【心声已经断档 " \+ thoughtStale \+ " 轮】/);
});

test("提醒的口气不能变成「每轮必须有」——那正是 v2 去掉的东西", () => {
  assert.match(app, /心声本来就不必每轮都有/);
  assert.match(app, /真的没有才留空/, "得给它留「确实没有」这条路");
  assert.match(app, /不要复述刚才的对话、不要规划怎么回她/, "别为了凑心声又写成导演稿");
});
