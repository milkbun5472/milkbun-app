// 来新消息时聊天窗口起点不动，顶上那条不被摘掉（她 2026-10-31：往上翻着，每来一条往下跳一截）
require("node:test")("新消息只往后接，不从顶上摘", () => {
  const assert = require("node:assert/strict");
  const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
  const i = c.indexOf("function useChatWindow("), seg = c.slice(i, i + 2600);
  assert.match(seg, /else if \(total > lastTotalRef\.current && !limit\) \{/);
  assert.match(seg, /winNow = winN \+ add;/);
  assert.match(seg, /const winStart = Math\.max\(0, total - \(limit \|\| winNow\)\);/);
});
