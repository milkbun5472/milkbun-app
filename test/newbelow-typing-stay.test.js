// 往上翻着时「正在输入」冒出来／收起来不拽人（群友 2026-10-31）
require("node:test")("没来新消息、人不在底下：原地不动", () => {
  const assert = require("node:assert/strict");
  const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
  const i = c.indexOf("function useNewBelow("), seg = c.slice(i, i + 1600);
  assert.match(seg, /if \(!atBottomRef\.current && added <= 0\) return false;/);
});
