const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const r = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
test("外语日记跟着「带翻译」自带中文（她 2026-10-26）", () => {
  assert.match(r("app.js"), /sayZh: !!settingsFor\(charId\)\.bilingual && !settingsFor\(charId\)\.engineerEyes \}\);/);
  assert.match(r("app.js"), /\{ zh: String\(p\.zh\)\.trim\(\)\.slice\(0, 2000\) \}/);
  assert.match(r("engine.js"), /if \(opts\.sayZh\) parts\.push\("【zh·paras 每一段的追加项】/);
  assert.match(r("screens-ui.js"), /if \(p\.zh\) return h\("div", \{ key: i, "data-wk": "diaryzh"/);
  assert.match(r("theme-studio.js"), /\["diaryzh", /);
});
