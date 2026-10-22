// 他手机锁屏的通知能清掉（群友 2026-10-22「锁屏的那些消息能不能不显示或者有个叉掉」）
const test = require("node:test");
const assert = require("node:assert/strict");
const ui = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "phone-ui.js"), "utf8");
test("锁屏有「× 清除」，清掉的按 id 记着，新来的照样出", () => {
  assert.ok(ui.includes('"data-wk": "phonelockclear"'));
  assert.ok(ui.includes("filter(r => !r.ahead && !cleared.has(String(r.id)))"));
  assert.ok(ui.includes('const lockKey = "x_phoneLockClear";'));
});
