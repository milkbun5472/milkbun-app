// 合影上限收成一个数、放到 10（2026-11-02：五人群合照只出四个人）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("GROUP_SHOT_MAX = 6，四处挑人都用它，没人再写死 3 : 4", () => {
  assert.match(app, /const GROUP_SHOT_MAX = 10;/);
  assert.equal((app.match(/GROUP_SHOT_MAX - 1 : GROUP_SHOT_MAX/g) || []).length, 3);
  assert.match(app, /withRef\.slice\(0, GROUP_SHOT_MAX\)\.map/);
  assert.doesNotMatch(app, /refPhoto\) \? 3 : 4|refPhoto \? 3 : 4/);
});
