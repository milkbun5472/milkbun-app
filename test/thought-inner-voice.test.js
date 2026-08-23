const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");

test("心声要求直接内在声音，而不是第三人称角色分析报告", () => {
  assert.match(app, /角色本人脑中此刻真正闪过、却没有说出口的一句第一人称念头/);
  assert.match(app, /不要总结互动、分析自己、规划回复/);
  assert.match(app, /不要写「我要表现得／显得／装出某种样子」/);
});

test("每轮都写真实心声，但不强迫它深刻或紧扣话题", () => {
  assert.match(app, /每轮必须写一句，禁止 null、空串或省略/);
  assert.match(app, /不要求重要、深刻或紧扣话题/);
  assert.match(app, /【本轮心声·普通角色必填】/);
  assert.match(app, /thought 必须是非空字符串/);
});

test("四条心声写入路径全部过 ThoughtVoiceGuard，群线下不留旁路", () => {
  // 单聊线上 / 单聊线下 / 群线上 / 群线下 —— 任何一条把 thought 写进状态卡前都必须过守卫
  assert.match(app, /const guardedThought = window\.ThoughtVoiceGuard\.accept\(rawThought\)/);
  assert.match(app, /parsed\.thought = guardedThought/);
  assert.match(app, /const offlineThought = res\.thought && window\.ThoughtVoiceGuard \? window\.ThoughtVoiceGuard\.accept\(res\.thought\)/);
  assert.match(app, /const gThink = rawGThink && window\.ThoughtVoiceGuard \? window\.ThoughtVoiceGuard\.accept\(rawGThink\)/);
  assert.match(app, /const gOffThought = b\.thought && window\.ThoughtVoiceGuard \? window\.ThoughtVoiceGuard\.accept\(b\.thought\)/);
});

test("旧导演稿不再作为下一轮心声范文回喂", () => {
  assert.doesNotMatch(app, /lastThoughtRaw/);
  assert.match(app, /const thoughtSpec = "本轮必须填写：一句角色本人此刻没说出口的第一人称心声"/);
});

test("普通角色心声守卫拒绝时不再冻结旧快照，言秋仍保持自愿", () => {
  assert.match(app, /parsed\.thought = guardedThought/);
  assert.doesNotMatch(app, /guardedThought \|\| \(!_s\.engineerEyes && rawThought/);
  assert.match(app, /else if \(!_s\.engineerEyes\)/);
  assert.match(app, /st\.thought = null; st\.thoughtUpdatedAt = 0;/);
  assert.match(app, /普通角色本轮没有产出有效心声时立刻清掉旧快照/);
});
