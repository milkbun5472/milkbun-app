// 刷刷评论区（她 2026-10-15）：他在评论区还是他本人那个腔调；条数不固定
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(__dirname + "/../js/shua.js", "utf8");
test("被回的角色照平时跟她说话的样子回，不因为网友看着换腔调", () => {
  assert.match(src, /TA平时怎么跟她说话，在评论区还是那个样子/);
  assert.ok(!/当着网友的面打字回：短/.test(src));
});
test("条数随机而且要多：最少三个路人，热闹时十来个", () => {
  const m = src.match(/const CROWD_N = (\[[^\]]+\])/); assert.ok(m);
  const opts = JSON.parse(m[1]); assert.ok(Math.min(...opts) >= 3 && Math.max(...opts) >= 10);
  assert.match(src, /n: String\(nTotal\)/);
  assert.match(src, /写接在后面的正好 " \+ o\.n \+ " 条/);
});
