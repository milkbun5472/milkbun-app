// 她 2026-09-16：「那个 ThoughtVoiceGuard 的保护也收了吧」。
//
// 我在复查 68.68 之后那几版时扫到的：十一处调用【三种写法混着来】——
// 有的写 `window.ThoughtVoiceGuard && …`，有的直接点上去。那个脚本在 index.html 里
// 是必加载的，所以平时不出事；可它哪天没加载上，不带保护的那几处会【整轮抛异常】，
// 跟 _histCache 一模一样的形状：一条错误毁掉整条回复，屏幕上只剩一句看不懂的报错。
//
// ⚠️兜底的语义是【原样放行，不是丢掉】：守卫的活是「挑出导演腔」，
//   不是「决定有没有心声」。它缺席时把心声全丢掉，比放行一条偶尔出戏的更坏。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const code = app.slice(app.indexOf("const TVG = {"), app.indexOf("\n};", app.indexOf("const TVG = {")) + 3);
const build = win => new Function("window", code + " return TVG;")(win);
const real = build({ ThoughtVoiceGuard: require("../js/thought-voice-guard") });
const bare = build({});                       // 守卫没加载上的那一天
const broken = build({ ThoughtVoiceGuard: {} }); // 加载了但缺方法（半截的更阴）

test("守卫在的时候，行为跟直接调它一个样", () => {
  const G = require("../js/thought-voice-guard");
  const director = "我得先安抚她，再把话题引向别的";
  assert.equal(real.accept(director), G.accept(director));
  assert.equal(real.accept(director), null, "导演稿照旧拦住");
  assert.equal(real.accept("我有点想她。"), "我有点想她。");
  assert.deepEqual(real.turnPatch({ thoughtSkips: 2 }, "", 9), G.turnPatch({ thoughtSkips: 2 }, "", 9));
});

test("守卫没加载：不抛异常，而且心声原样放行", () => {
  for (const T of [bare, broken]) {
    assert.doesNotThrow(() => T.accept("我有点想她。"));
    assert.equal(T.accept("我有点想她。"), "我有点想她。", "守卫缺席就把心声全丢掉，比放行更坏");
    // 空/字符串 "null" 仍然不算心声——这一条跟真身一致
    assert.equal(T.accept(""), null);
    assert.equal(T.accept("null"), null);
    assert.equal(T.accept("NULL"), null);
    assert.equal(T.accept(null), null);
    assert.equal(T.normalizeAction("靠在门框上"), "靠在门框上");
    assert.equal(T.normalizeAction("null"), null);
  }
});

test("⚠️「没有新心声就清掉旧的」这条铁律，守卫缺席时也得成立", () => {
  // 不清的话，状态卡会永远冻在上一句——她 2026-09-15 撞到过一次了
  for (const T of [bare, broken]) {
    assert.deepEqual(T.turnPatch({ thoughtSkips: 2 }, "", 9), { thought: null, thoughtUpdatedAt: 0, thoughtSkips: 3 });
    assert.deepEqual(T.turnPatch({}, "null", 9), { thought: null, thoughtUpdatedAt: 0, thoughtSkips: 1 });
    assert.deepEqual(T.turnPatch({ thoughtSkips: 5 }, "她怎么在这儿", 9), { thought: "她怎么在这儿", thoughtUpdatedAt: 9, thoughtSkips: 0 });
    assert.equal(T.turnPatch({ thoughtSkips: 98 }, "", 9).thoughtSkips, 99, "计数封顶那一条也要照抄");
    assert.equal(T.turnPatch({ thoughtSkips: 99 }, "", 9).thoughtSkips, 99);
  }
});

test("app.js 里不许再留裸的 window.ThoughtVoiceGuard 调用", () => {
  const live = app.split("\n").map(l => l.split("//")[0]).join("\n");
  const inside = code;
  const outside = live.split(inside).join("");
  assert.ok(outside.indexOf("window.ThoughtVoiceGuard") < 0,
    "又有人绕过 TVG 直接点 window.ThoughtVoiceGuard——那一处在守卫没加载时会整轮抛异常");
  // 四条心声通道 + 两处动作，全走这一个入口
  assert.ok((live.match(/TVG\.(accept|turnPatch|normalizeAction)\(/g) || []).length >= 8);
});
