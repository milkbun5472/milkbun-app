const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
test("画牵手：没写十指相扣就画最简单的握法", () => {
  assert.match(eng, /if \(\/牵手\|牵着\|握着\.\{0,4\}手\|手牵\|十指相扣\|拉着\.\{0,3\}手\/\.test\(String\(sceneDesc \|\| ""\)\)\) parts\.push\(/);
  assert.match(eng, /simple palm grip/);
});
