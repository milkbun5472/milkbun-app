// 开吧可以选吧主（群里 2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const ui = rd("screens-ui.js"), app = rd("app.js"), sc = rd("screens.js"), ts = rd("theme-studio.js");
test("开吧、编辑吧都存吧主", () => {
  assert.match(ui, /rules: rules, owner: owner \}/);
  assert.match(ui, /rules: rules, owner: owner, createdAt/);
  assert.match(ui, /owner: b\.owner \|\| null, editOf: tab/);
  assert.match(ui, /"data-wk": "foboardowner"/);
  assert.match(ts, /"foboardowner"/);
});
test("吧主进这个吧的说明，置顶里挂着", () => {
  assert.match(app, /\+ forumOwnerLine\(b\);/);
  assert.match(sc, /function forumBoardOwnerName\(name, chars\)/);
  assert.match(ui, /\.concat\(ownerNm \? \["吧主：" \+ ownerNm\] : \[\]\)/);
});
