const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");

test("心声要求直接内在声音，而不是第三人称角色分析报告", () => {
  assert.match(app, /角色本人脑中此刻真正出现、却没有说出口的一句第一人称念头/);
  assert.match(app, /不要总结互动、分析自己、规划回复/);
  assert.match(app, /不要写「我要表现得／显得／装出某种样子」/);
});

test("没有真实意识片段允许 null，不强迫每轮编转念", () => {
  assert.match(app, /thought 完全可选/);
  assert.match(app, /否则填 null 或省略，绝不为交字段硬编/);
});

test("旧导演稿不再作为下一轮心声范文回喂", () => {
  assert.doesNotMatch(app, /lastThoughtRaw/);
  assert.match(app, /const thoughtSpec = ""; \/\/ 仅供旧协议常量兼容；v2 不发送它/);
});
