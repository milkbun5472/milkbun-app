// 带译文的外语句不按逗号拆（她 2026-11-01）
require("node:test")("单聊群聊：bi 有就不按逗号拆", () => {
  const assert = require("node:assert/strict");
  const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /splitLongBubble\(bi \? bi\.text : w, bi \? false : _commaOk\)/);
  assert.match(app, /splitLongBubble\(bi \? bi\.text : x, bi \? false : gAllowComma\)/);
});
