const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("朋友圈：言秋不进评论区；每个开口的人都带人设（她 2026-10-26）", () => {
  assert.match(app, /const momLive = \(\) => liveChars\.filter\(c => !\(settingsFor\(c\.id\) \|\| \{\}\)\.engineerEyes\);/);
  assert.match(app, /const canSeeMain = momLive\(\)\.filter/);
  assert.match(app, /reps = reps\.filter\(r => !momBodyName\(r\.author\)\);/);
  assert.match(app, /d\.reactions = d\.reactions\.filter\(r => r && !momBodyName\(r\.name\)\)/);
  assert.ok(!/String\(c\.persona \|\| ""\)\.slice\(0, 70\)/.test(app), "正主人设还只截 70 字");
  assert.match(app, /const system = bundle \+ _rosterBlock \+/);
});
