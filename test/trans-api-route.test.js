// 翻译专用线路（群友 2026-11-25）：挑了就先走它，翻不成退免费；没挑照旧只走免费
const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const e = fs.readFileSync("js/engine.js", "utf8"), ui = fs.readFileSync("js/screens-ui.js", "utf8");
test("挑了翻译线路排在最前", () => {
  assert.match(e, /const tp = transApiProfile\(\);\n\s*const chain = \[\n\s*\.\.\.\(tp \? \[\{ by: "模型", run: \(\) => _transModel\(text, tp\) \}\] : \[\]\),\n\s*\{ by: "免费", run: \(\) => _transGoogle/);
  assert.match(e, /const names = \(tp \? \["翻译线路"\] : \[\]\)\.concat/, "失败原因对得上号");
});
test("设置里有这一栏，存 x_transApi", () => {
  assert.match(ui, /routeBox\("翻译模型",/);
  assert.match(ui, /saveJSON\("x_transApi", id \|\| null\)/);
  assert.match(e, /loadJSON\("x_transApi", null\)/);
});
