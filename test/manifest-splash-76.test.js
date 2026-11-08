const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const m = JSON.parse(fs.readFileSync(__dirname + "/../manifest.json", "utf8"));
// 群里 2026-11-08 截图：安卓装到桌面后的启动页，图标是一块比底色浅的方块——底色跟图标自己的边色对不上
test("启动页底色跟图标的边色一样，图标不会浮成一块方块", () => {
  assert.equal(m.background_color.toLowerCase(), "#f6ecd9");
});
