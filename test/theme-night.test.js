const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("一键夜间配色，关了换回原来那套（群友 2026-10-26）", () => {
  assert.match(ui, /const THEME_NIGHT = \{ bg: "#[0-9a-f]{6}", bg2: "#[0-9a-f]{6}", ink: "#[0-9a-f]{6}", sub: "#[0-9a-f]{6}", fog: "#[0-9a-f]{6}", line: "#[0-9a-f]{6}" \};/);
  assert.match(ui, /if \(v\) \{ saveJSON\("x_themeDay", th\); const n = \{ \.\.\.th, \.\.\.THEME_NIGHT \};/);
  assert.match(ui, /const d = loadJSON\("x_themeDay", null\);[^\n]*saveJSON\("x_themeDay", null\);[^\n]*onSave\(n\);/);
});
