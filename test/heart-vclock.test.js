const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/heart.js", "utf8");
test("心上的日子照 TA 那只钟", () => {
  assert.match(src, /const vcTs = \(ts, id\) => \(typeof vclockMap === "function" && id != null \? vclockMap\(ts, id\) : ts\);/);
  assert.match(src, /function fmtDay\(ts, id\) \{ const d = new Date\(vcTs\(ts, id\)\);/);
  const page = src.slice(src.indexOf("window.HeartPage = function"));
  assert.doesNotMatch(page, /fmtDay\([^)]*\)(?<!char\.id\))/);
  assert.match(page, /todayKey = new Date\(vcTs\(Date\.now\(\), char\.id\)\)/);
  assert.match(src, /"今天是 " \+ new Date\(vcTs\(_now, char\.id\)\)/);
});
