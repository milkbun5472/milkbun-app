// 架空地图：点版块名字就能改那一块（她 2026-10-15「改吧宝宝」）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/map.js"), "utf8");
test("版块名字可点，点了借这一块第一个地点开改块表单；按钮写明改名字", () => {
  assert.ok(/openRegEdit\(r\.name\)/.test(src));
  assert.ok(/const openRegEdit = function \(rn\)/.test(src));
  assert.ok(/"改这一块的名字"/.test(src));
});
