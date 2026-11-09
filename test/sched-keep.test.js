// 排日程时一直记着的那句（群友 2026-11-04：许愿每次都要重打）：存 x_schedKeep，三处排日程都带
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const a = R("app.js");
test("一份存、一份读，单天和整周都接", () => {
  assert.match(a, /const schedKeepLine = id =>/);
  assert.match(a, /schedPeerBlock\(char, \[dayKey\]\) \+ schedMapRule\(char\) \+ schedKeepLine\(char\.id\)/);
  assert.match(a, /schedPeerBlock\(char, want\) \+ schedMapRule\(char\) \+ schedKeepLine\(char\.id\)/);
});
test("日历加号里能写", () => {
  assert.match(R("components.js"), /"data-part": "keep"/);
  assert.match(a, /schedKeepOf: schedKeepOf, onSchedKeep:/);
});
