// 设置「谁会自己动」把言秋也列进来（她 2026-10-22）
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("设置页的自动名单不再筛掉 engineerEyes", () => {
  assert.ok(/\n    autoCharacters: liveChars,\n/.test(app));
  assert.ok(!/autoCharacters: liveChars\.filter\(c => !settingsFor\(c\.id\)\.engineerEyes\)/.test(app));
});
