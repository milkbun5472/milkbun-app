// 开吧可以选吧主（群里 2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const ui = rd("screens-ui.js"), app = rd("app.js"), sc = rd("screens.js"), ts = rd("theme-studio.js");
test("开吧、编辑吧都存吧主", () => {
  assert.match(ui, /rules: rules, owner: owner(, lore: lore)? \}/);
  assert.match(ui, /rules: rules, owner: owner(, lore: lore)?, createdAt/);
  assert.match(ui, /owner: b\.owner \|\| null, (lore: [^\n]*?, )?editOf: tab/);   // 2026-11-07 中间多了挂的世界书
  assert.match(ui, /"data-wk": "foboardowner"/);
  assert.match(ts, /"foboardowner"/);
});
test("吧主进这个吧的说明，置顶里挂着", () => {
  assert.match(app, /\+ forumOwnerLine\(b\)( \+ forumBoardLore\(b\))?;/);
  assert.match(sc, /function forumBoardOwnerName\(name, chars\)/);
  assert.match(ui, /\.concat\(ownerNm \? \["吧主：" \+ ownerNm\] : \[\]\)/);
});
