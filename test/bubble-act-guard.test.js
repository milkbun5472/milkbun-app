
// 【自己的名字 + 动作】跨几个气泡：挪进动作行，后面的话照旧是气泡（她 2026-11-01）
require("node:test")("【周树生 看着…】这种自己写自己的，挪进动作行", () => {
  const assert = require("node:assert/strict");
  const G = require("../js/bubble-act-guard.js");
  const r = G.split(["……I love you", "【周树生 看着蛋糕上的英文耳朵瞬间热了一圈", "嘴硬地轻咳了一声】", "你英语水平见长啊"], { secondPerson: true, selfNames: ["周树生"] });
  assert.deepEqual(r.words, ["……I love you", "你英语水平见长啊"]);
  assert.deepEqual(r.acts, ["周树生 看着蛋糕上的英文耳朵瞬间热了一圈，嘴硬地轻咳了一声"]);
  assert.deepEqual(G.split(["【周树生 别过脸】行吧"], { selfNames: ["周树生"] }).words, ["行吧"]);
  assert.deepEqual(G.split(["【周树生 说", "嗯"], { selfNames: ["周树生"] }).acts, []);   // 没合上：不动
  assert.deepEqual(G.split(["【张三 来了】", "嗯"], { selfNames: ["周树生"] }).acts, []);   // 不是自己的名字：不动
});
