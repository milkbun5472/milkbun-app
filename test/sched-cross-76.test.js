// 别人此刻的日程里写着跟TA在一起：TA 也知道（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("schedNowFor 带上别人此刻安排里点了TA名字的那一项，没有自己日程的配角也有", () => {
  assert.match(s, /const schedCrossFor = char => \{/);
  assert.match(s, /return schedCrossFor\(char\)\.trim\(\);/);
  assert.match(s, /out \+= schedCrossFor\(char\);/);
});
