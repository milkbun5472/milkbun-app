const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("世界书文件夹全部展开／全部收起（群友 2026-10-26）", () => {
  assert.match(ui, /"data-wk": "lorefoldall", onClick: \(\) => setFolderShut\(allShut \? \{\} : Object\.fromEntries/);
  assert.match(ui, /allShut \? "全部展开" : "全部收起"/);
});
