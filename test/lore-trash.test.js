const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("deleted worldbook entries go to a 30-day trash and can be restored", () => {
  assert.match(app, /const loreTrashLive = \(\) => [\s\S]{0,200}30 \* 86400000/);
  assert.match(app, /saveJSON\("x_loreTrash", \[\{ entry: gone, deletedTs: Date\.now\(\) \}\]/);
  assert.match(app, /onRestore: id =>[\s\S]{0,300}saveLore\(\[hit\.entry\]/);
  assert.match(scr, /function WorldBook\(\{ entries, characters, onBack, onSave, onDelete, trash, onRestore \}\)/);
  assert.match(scr, /"最近删除 · " \+ trash\.length/);
});
