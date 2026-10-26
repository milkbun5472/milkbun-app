const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("世界书文件夹能自己排顺序（群友 2026-10-26）", () => {
  assert.match(ui, /loadJSON\("x_loreFolderOrder", \[\]\)/);
  assert.match(ui, /setFolderOrderRaw\(cur\); saveJSON\("x_loreFolderOrder", cur\);/);
  assert.match(ui, /"data-wk": "lorefoldersort"/);
  assert.match(ui, /"data-wk": "lorefoldermove", "data-part": dir < 0 \? "up" : "down"/);
  assert.match(ui, /fd && !folderSorting \? h\("button", \{ onClick: \(\) => requestAppConfirm\("拆掉「"/);
});
