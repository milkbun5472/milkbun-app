const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("世界书「TA 用哪几条」里顶上切「全部 / 只看没用的」，不再另起一栏（2026-10-26）", () => {
  assert.doesNotMatch(comp, /title: "世界书 · TA 没用的"/);
  assert.match(comp, /"data-wk": "chatloreview"/);
  assert.match(comp, /\[\[false, "全部"\], \[true, "只看没用的"/);
  assert.match(comp, /const shown = offOnly \? live\.filter\(e => !uses\(e\)\) : live;/);
  assert.match(comp, /const items = shown\.filter\(e => fOf\(e\) === fd\);/);
  assert.match(fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8"), /"chatloreview"/);
});
