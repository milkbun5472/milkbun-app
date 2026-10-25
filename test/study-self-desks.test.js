const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/study.js", "utf8");
const fnSrc = src.slice(src.indexOf("  async function selfStudyTalk"), src.indexOf("  function SelfStudyList"));
test("自习室每人一条进度：跟着这一次开口一起报，只往前走，事情定下不换（群友 2026-10-25）", async () => {
  assert.ok(fnSrc.length > 100);
  assert.match(fnSrc, /desks\\":\[/); assert.match(fnSrc, /只往前走/);
  assert.match(src, /if \(r\.desks && Object\.keys\(r\.desks\)\.length\) commit/);
  assert.match(src, /"data-wk": "selfdesk"/); assert.match(src, /myPct: \(\(Number\(sessRef\.current\.myPct\) \|\| 0\) \+ 25\) % 125/);
  assert.match(fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8"), /"selfdesks"/);
});
