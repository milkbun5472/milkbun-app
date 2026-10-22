const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("关系页「照我的人设写一份」照面具筛子挑的那张写，不是只认主面具", () => {
  assert.match(ui, /draftProfile: maskProfile/);
  assert.match(ui, /onDraftMyNpc\(c\.npcName, c\.npcRel, draftProfile \|\| profile\)/);
  assert.match(app, /const draftMyNpc = async \(ask, rel, me\) =>/);
  assert.match(app, /generateMyNpc\(p, me \|\| profile,/);
});
