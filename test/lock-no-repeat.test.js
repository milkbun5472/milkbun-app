// 已经是他的锁屏的那张，不再摆给他、不再换一遍（她 2026-11-04：连着两轮都显示把锁屏换成了这张）
const test = require("node:test");
const assert = require("node:assert/strict");
const a = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("存下来源、换之前查一下、提示之前也查一下", () => {
  assert.match(a, /lockFrom: lockSrcId\(src\)/);
  assert.match(a, /if \(lockIsAlready\(charId, src\)\) return;/);
  assert.match(a, /if \(_lockSrc && !_lockSrc\.alts && lockIsAlready\(charId, _lockSrc\)\) _lockSrc = null;/);
});
