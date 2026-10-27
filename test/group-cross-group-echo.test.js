const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("群里每个人也带着他在别的互通群最近聊的：按时间窗和字数，不按条数（她 2026-10-27）", () => {
  const i = app.indexOf("const memberPrivateContextFor = (c, split, opts) => {"), body = app.slice(i, app.indexOf("\n  };", i));
  assert.match(body, /crossRecentFor\(c\.id, \{ surfaces: \["group"\], excludeGroup: opts\.groupId \}\)/);
  assert.match(body, /otherGroups && c\.name \+ " 在别的群里最近聊的/);
  const j = app.indexOf("const crossRecentFor = (charId, opts = {}) => {"), cr = app.slice(j, app.indexOf("\n  };", j));
  assert.match(cr, /if \(surfaces\.includes\("group"\)\)/);
  assert.match(cr, /g\.id === opts\.excludeGroup \|\| !gsFor\(g\.id\)\.memoryInterop/);
  assert.match(app, /spectate: !imInGroup\(group\) \|\| !!gs\.spectate, groupId: group\.id \}\)/);
});

test("单聊带的群聊近况也走同一份（她 2026-10-27「换了」）", () => {
  assert.match(app, /groupEcho: \(\(\) => \{ let t = ""; try \{ t = crossRecentFor\(char\.id, \{ surfaces: \["group"\] \}\); \}/);
  assert.ok(!/groupEcho: \(groups \|\| \[\]\)\.filter/.test(app), "旧的按条数那份还在");
});
