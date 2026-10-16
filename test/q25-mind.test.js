// 群友 2026-10-14：25 问反过来——我出题 TA 猜、TA 出题我猜、轮流
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "games.js"), "utf8");
test("开局页能挑谁出题，非系统出题走 MindGame", () => {
  assert.match(g, /\{ key: "me", zh: "我出题" \}, \{ key: "ta", zh: "TA 出题" \}, \{ key: "turns", zh: "轮流" \}/);
  assert.match(g, /q25Host: game\.key === "q25" \? q25Host : undefined/);
  assert.match(g, /session\.config\.q25Host !== "system"\) return h\(MindGame/);
});
test("我出题时答案不进 TA 的提示词；TA 出题时答案只在 TA 那头", () => {
  const i = g.indexOf("const taTurn = function"), j = g.indexOf("const lockSecret", i);
  assert.ok(i > 0 && j > i);
  assert.doesNotMatch(g.slice(i, j), /secret/, "TA 猜的时候拿到了答案");
  assert.match(g, /答案是「" \+ r\.secret \+ "」（绝对不许说出来/);
  assert.match(g, /const MIND_ANS = \["是", "不是", "不确定", "有点沾边"\]/);
});
