const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("自己开的吧：简介就是设定，压过普通吧的隐私规矩；能写 300 字", () => {
  assert.match(app, /简介是她给这个吧定的设定，说了算/);
  assert.match(ui, /String\(\(newBoard && newBoard\.about\) \|\| ""\)\.trim\(\)\.slice\(0, 300\)/);
  assert.match(ui, /帖子写什么照这一格来/);
});
