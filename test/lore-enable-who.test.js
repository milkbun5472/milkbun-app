const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("世界书多选「启用」先问给谁：照原来 / 所有角色 / 只给这几个人（群友 2026-10-26）", () => {
  assert.match(ui, /\["启用", \(\) => \{ setOnPick\(\[\]\); setOnOpen\(true\); \}\]/);
  assert.match(ui, /k === "all" \? \(x => \(\{ \.\.\.x, enabled: true, charIds: \[\], offFor: \[\] \}\)\) : \{ enabled: true \}/);
  assert.match(ui, /bulk\(x => \(\{ \.\.\.x, enabled: true, charIds: ids, offFor: \(x\.offFor \|\| \[\]\)\.filter\(id => !ids\.includes\(id\)\) \}\)\)/);
  assert.match(fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8"), /"loreenable"/);
});
