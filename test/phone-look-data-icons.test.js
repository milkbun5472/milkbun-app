// 她 2026-10-19：查手机桌面「外观」「数据」两格美化不了——没挂点，也不在逐个换图标的列表里。
const test = require("node:test");
const assert = require("node:assert/strict");
const ui = require("fs").readFileSync(require("path").join(__dirname, "../js/phone-ui.js"), "utf8");
test("两格挂 phoneicon，能换图", () => {
  assert.match(ui, /key: "__look", "data-wk": "phoneicon", "data-app": "__look"/);
  assert.match(ui, /key: "__data", "data-wk": "phoneicon", "data-app": "__data"/);
  assert.match(ui, /look\.icons\["__look"\]/);
  assert.match(ui, /look\.icons\["__data"\]/);
  assert.match(ui, /\{ key: "__look", zh: "外观", glyph: "settings" \}, \{ key: "__data", zh: "数据", glyph: "notes" \}/);
});
