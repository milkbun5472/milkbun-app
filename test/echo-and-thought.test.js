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

// v55.12：加了提醒她还是四轮没等到。查出来是计数器本身的 bug——
// 原本写作 else if (_live.thought)，心声一旦断掉被清空就再也进不来，
// 计数器冻在原地，靠它触发的提醒永远等不到。
test("断档计数必须一直数下去，不能只在还挂着旧念头时才数", () => {
  assert.match(app, /\} else \{\n          \/\/ ⚠️v55\.12：这里原本是 else if \(_live\.thought\)/);
  assert.match(app, /const skips = Math\.min\(\(Number\(_live\.thoughtSkips\) \|\| 0\) \+ 1, 99\);/);
  // 清空旧念头这件事仍然只对「确实还挂着」的情况有意义
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

test("断得越久说得越硬，但仍留「确实空白」这条路", () => {
  assert.match(app, /thoughtStale >= 8 \?/);
  assert.match(app, /断这么久几乎不可能是真的心里空白/);
  assert.match(app, /除非此刻确实一片空白，否则这一轮把 thought 填上/);
});

test("催不动就说实话：多半是模型不认可选字段", () => {
  assert.match(app, /if \(skips === 12\) toast\(/, "只在越过那一轮说一次，别每轮念");
  assert.match(app, /多半是这个聊天模型不吐 thought 这类可选字段，和之前不发图是同一个毛病/);
});
