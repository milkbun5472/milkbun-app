const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("「Ta 眼里」只对言秋关，本体模式照常有（后台复看、上下文、状态卡那一页）", () => {
  assert.match(app, /const noGaze = id => !!\(settingsFor\(id\) \|\| \{\}\)\.engineerEyes;/);
  assert.match(app, /gazeOn: !roomCard && !!window\.Gaze && !noGaze\(scc\.id\) && !scc\.npc/);
  assert.equal((app.match(/if \(noGaze\(char\.id\) \|\| !autoRefreshOn\("gaze", char\.id\)\) return;/g) || []).length, 2);
  assert.match(app, /const gazeFor = charId => \{\n\s*if \(noGaze\(charId\)/);
});
