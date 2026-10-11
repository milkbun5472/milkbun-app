// 日程能编辑（她 2026-10-11）：AI 排的那一段点开能改做什么、几点到几点、在哪
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const cmp = fs.readFileSync(require.resolve("../js/components.js"), "utf8");
test("改完按开始时间排好、重新编号、估算清掉，跟删一段落的是同一个形状", () => {
  const seg = app.slice(app.indexOf("const editSchedSeq = "), app.indexOf("const schedWeekKeysFrom"));
  assert.match(seg, /\.sort\(\(a, b\) => toMin\(a && a\.time\) - toMin\(b && b\.time\)\)\.map\(\(q, i\) => \(\{ \.\.\.q, seq: i \+ 1 \}\)\)/);
  assert.match(seg, /estTime: null/);
  assert.match(seg, /saveJSON\("x_schedules", n\)/);
  assert.match(app, /onEditSchedSeq: \(c, dayKey, seqNo, patch\) => \{/);
});
test("详情里有「改这一段」，改的页四格、存好", () => {
  assert.match(cmp, /"data-part": "editseq"/);
  assert.match(cmp, /"data-wk": "calseqedit"/);
  assert.match(cmp, /onEditSchedSeq\(curChar, seqEdit\.dk, seqEdit\.seq,/);
});
