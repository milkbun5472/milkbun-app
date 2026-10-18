// 日记看过没看（群里 2026-10-18 许愿）：TA 新写的带 unread，翻到就去掉；旧日记没有这一格＝看过
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "../js/screens-ui.js"), "utf8");
test("新写的日记带 unread，看过去掉", () => {
  assert.match(app, /unread: true,\s+\/\/ TA 新写的/);
  assert.match(app, /const markDiaryRead = \(charId, ids\) =>/);
  assert.match(app, /onMarkRead: markDiaryRead,/);
});
test("翻到那一篇就标看过；列表挂小红点；目录、封面都数没看的；有一键已读", () => {
  assert.match(ui, /if \(e && e\.unread\) onMarkRead\(curId, \[e\.id\]\);/);
  assert.match(ui, /e\.unread \? h\("div", \{ "data-wk": "diunread"/);
  assert.match(ui, /篇没看 · " : ""\) \+ "共 "/);
  assert.match(ui, /"data-wk": "diallread"/);
  assert.match(ui, /" 篇没看" : ""\) : "还是空的"/);
});
test("翻开某一本时列表顶上也有一键已读（她 2026-10-18：只在目录页找不到）", () => {
  assert.match(ui, /"data-wk": "diallread", "data-part": "book"/);
});
