// 秋秋卡住了能叉掉、再重新生成（她 2026-10-09）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("node:fs").readFileSync(require.resolve("../js/assistant.js"), "utf8");

test("ask 带着放手信号进 callAI", () => {
  assert.match(src, /async function ask\(active, ctx, history, text, pic, signal\)/);
  assert.match(src, /stream: true, signal: signal \|\| undefined \}\)/);
});
test("叉掉的不算「没答上来」，留一颗重新生成", () => {
  assert.match(src, /cancelled: true, q: q,/);
  assert.match(src, /"data-wk": "qqregen", onClick: \(\) => C\.regen\(m\)/);
});
test("整页和悬浮屏用同一个「在想…＋叉」", () => {
  assert.equal((src.match(/C\.busy \? h\(Thinking, \{ C/g) || []).length, 2);
  assert.match(src, /"data-wk": "qqcancel", onClick: C\.cancel/);
  assert.match(src, /minWidth: 40, minHeight: 40/);
});
