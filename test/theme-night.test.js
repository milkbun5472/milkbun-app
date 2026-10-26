const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8"), st = fs.readFileSync(__dirname + "/../js/theme-studio-ui.js", "utf8");
test("一键夜间配色：一份，主题色页和主题工作台顶上都有（群友 2026-10-26）", () => {
  assert.match(ui, /const THEME_NIGHT = \{ bg: "#[0-9a-f]{6}", bg2: "#[0-9a-f]{6}", ink: "#[0-9a-f]{6}", sub: "#[0-9a-f]{6}", fog: "#[0-9a-f]{6}", line: "#[0-9a-f]{6}" \};/);
  assert.match(ui, /if \(v\) \{ saveJSON\("x_themeDay", theme\); setOn\(true\); onSave\(\{ \.\.\.theme, \.\.\.THEME_NIGHT \}\); \}/);
  assert.equal((ui.match(/"data-wk": "themenight"/g) || []).length, 1, "夜间那一行只写一份");
  assert.match(ui, /h\(ThemeNightRow, \{ theme: th, onSave:/);
  assert.match(st, /h\(window\.ThemeNightRow, \{ theme: theme, onSave: onSaveTheme \}\)/);
});
