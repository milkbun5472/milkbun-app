// 一起学资料分两摞（群友 2026-10-09：老师写的和导入的混在一起不好找）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = fs.readFileSync(path.join(__dirname, "../js/study.js"), "utf8");

test("资料页分「全部／我传的／老师给的」，老师给的就是 handout", () => {
  const fn = S.slice(S.indexOf("function MaterialShelf("), S.indexOf("function StudyCalendar("));
  assert.match(fn, /given = all\.filter\(function \(m\) \{ return m\.kind === "handout"; \}\)/);
  assert.match(fn, /mine = all\.filter\(function \(m\) \{ return m\.kind !== "handout"; \}\)/);
  assert.match(fn, /"data-wk": "studymatpiles"/);
  assert.match(fn, /mine\.length && given\.length \?/, "只有一种的时候不摆隔板");
});
