// 她 2026-10-05：「美化改错了想恢复前一步现在没办法咋办」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const ts = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio-ui.js"), "utf8");
test("每次正式存之前留下被盖掉那一版，最多 10 版；能一键退回", () => {
  assert.match(ts, /const HIST_KEY = "x_theme_studio_hist", HIST_MAX = 10;/);
  assert.match(ts, /saveJSON\(HIST_KEY, \[\{ at: Date\.now\(\), raw: prev \}\]\.concat\(histList\(\)\)\.slice\(0, HIST_MAX\)\)/);
  assert.match(ts, /history, restoreHist, current,/);
  assert.match(ui, /studio\.restoreHist\(0\)/);
});
