// 一起学：say 里的 {"voice":…} 每条路都过 sayStr，不许 String 成「[object Object]」（她 2026-10-18 截图）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "../js/study.js"), "utf8");
test("老师带同学那一路、学生那一路都过 sayStr", () => {
  assert.match(s, /\[t\.say\] : \[\]\)\)\.map\(sayStr\)\.map\(stripName\)/);
  assert.match(s, /text: sayStr\(t\) \}; \}\);/);
  assert.doesNotMatch(s, /\[t\.say\] : \[\]\)\)\.map\(stripName\)/, "又跳过了 sayStr");
});
