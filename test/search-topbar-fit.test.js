const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("购物/外卖搜索条不撑出屏幕：外层 minWidth 0，输入框 width 0", () => {
  const i = src.indexOf("function searchTopBar(");
  const seg = src.slice(i, src.indexOf("return topBar;", i));
  assert.match(seg, /borderRadius: 999, paddingLeft: 12, paddingRight: 3, minWidth: 0 \}/);
  assert.match(seg, /marginLeft: 7, minWidth: 0, width: 0 \}/);
});
