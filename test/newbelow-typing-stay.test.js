// 往上翻着时「正在输入」冒出来／收起来不拽人（群友 2026-10-31）
require("node:test")("没来新消息、人不在底下：原地不动", () => {
  const assert = require("node:assert/strict");
  const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
  const i = c.indexOf("function useNewBelow("), seg = c.slice(i, i + 1600);
  assert.match(seg, /if \(!atBottomRef\.current && added <= 0\) return false;/);
});
require("node:test")("点过「↓ N 条新消息」，这一轮剩下的跟到底，不再拉回这一轮第一条；她一发言清掉", () => {
  const assert = require("node:assert/strict");
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(src, /const go = \(\) => \{ const el = ref\.current; chasedRef\.current = true;/);
  assert.match(src, /if \(last && last\.role === "user"\) chasedRef\.current = false;/);
  assert.match(src, /if \(!_last \|\| _last\.role === "user" \|\| \(nb\.chased && nb\.chased\.current\)\) turnTopRef\.current = null;/);
});
