// 发出去之前再兜一道：又长又只靠空格断句的再拆（她 2026-11-01「随机出现、预测不了」）
require("node:test")("单聊群聊最后都有这一道，带译文的跳过", () => {
  const assert = require("node:assert/strict");
  const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /if \(_splitOn && typeof splitLongBubble === "function"\) words = words\.reduce\(\(acc, w\) => \{/);
  assert.match(app, /_biZh\.has\(bilingualKey\(t\)\) \|\| _biCovered\.has\(bilingualKey\(t\)\)/);
  assert.match(app, /if \(gAllowComma\) gBubbles = gBubbles\.reduce\(\(acc, w\) => \{ const t = typeof w === "string" \? w : "";/);
  assert.equal((app.match(/splitLongBubble\(/g) || []).length, 5, "单聊、群聊、通话，加这两道兜底");
});
