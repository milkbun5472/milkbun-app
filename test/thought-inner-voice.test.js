const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

// ⚠️v67.49 起心声那一段住在 engine.js 的 THOUGHT_MEANING 里（线上线下共用一份），
//   app.js 只剩一个 ${THOUGHT_MEANING}——要验的是【拼起来的那一份】。
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8")
  + fs.readFileSync(require.resolve("../js/engine.js"), "utf8");

test("四条心声写入路径全部过 ThoughtVoiceGuard，群线下不留旁路", () => {
  // 单聊线上 / 单聊线下 / 群线上 / 群线下 —— 任何一条把 thought 写进状态卡前都必须过守卫
  // v68.88：四条通道都走公共的 TVG（它内部再委托给 window.ThoughtVoiceGuard）
  assert.match(app, /const guardedThought = TVG\.accept\(rawThought\)/);
  assert.match(app, /parsed\.thought = guardedThought/);
  assert.match(app, /const offlineThought = TVG\.accept\(res\.thought\)/);
  assert.match(app, /const thought = TVG\.accept\(rawThought\)/);
  assert.match(app, /thought: a\.thought, mood: a\.mood/);
});

test("旧导演稿不再作为下一轮心声范文回喂", () => {
  assert.doesNotMatch(app, /lastThoughtRaw/);
  // ⚠️v66.12：thoughtSpec 跟着那条不再发送的 A/B 基线一起删了。
  //   真正在跑的是 _normalThoughtTurnHint（Protocol v2 每轮任务串里）。
  assert.match(app, /const _normalThoughtTurnHint = "\\n【本轮心声·普通角色必填】/);
  assert.match(app, /_normalThoughtTurnHint \+ "\\n" \+ MOOD_TURN_RULE/, "没拼进真正在跑的那一串");
  assert.ok(!/thoughtSpec/.test(app.replace(/\/\/[^\n]*/g, "")), "旧 spec 还有活的引用");
});

test("普通角色心声守卫拒绝时不再冻结旧快照，言秋仍保持自愿", () => {
  assert.match(app, /parsed\.thought = guardedThought/);
  assert.doesNotMatch(app, /guardedThought \|\| \(!_s\.engineerEyes && rawThought/);
  assert.match(app, /\|\| !_s\.engineerEyes\) \{/);
  // 「没有新心声就清掉旧的」搬进了公共那一份（群聊那一处原来就缺这条）
  const guard = fs.readFileSync(require.resolve("../js/thought-voice-guard.js"), "utf8");
  assert.match(guard, /return \{ thought: null, thoughtUpdatedAt: 0, thoughtSkips:/);
  assert.match(app, /普通角色本轮没有产出有效心声时立刻清掉旧快照/);
});
