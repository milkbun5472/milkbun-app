// 她 2026-09-28：一起学的仪表盘——学了几天 / 掌握度彩带 / 最容易栽的三个坑 / 今天到期几道。零新数据，纯展示。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
const i = src.indexOf("  function studyDashboard("), j = src.indexOf("  window.Study = {", i);
assert.ok(i > 0 && j > i, "抠不出 studyDashboard");
const dash = new Function(src.slice(i, j) + "\nreturn studyDashboard;")();

// 桩照写存档那几段来（stub-from-the-writer）：
//   mastery 由答题/结课写成 { [pointId]: level }；mistakes 是 { pointId, note, resolved }；
//   复习卡由 updateCurriculumReview 写 { pointId, wrongCount, hintedCount, nextReviewAt }；
//   transcript 里她的话是 { role:"user", ts }；课与课程靠 curriculum_id 挂上。
const day = 86400000, now = new Date(2026, 8, 28, 12, 0).getTime();
const outline = { units: [{ id: "u1", grammar: [{ id: "te", label: "て形" }, { id: "ta", label: "た形" }, { id: "nai", label: "ない形" }] }] };
const sessions = [
  { id: "s1", curriculum_id: "c1", updated_at: now - 3 * day, outline,
    progress: { mastery: { te: 1, ta: 0 }, mistakes: [{ pointId: "te", note: "促音", resolved: false }] },
    transcript: [{ role: "user", ts: now - 3 * day }, { role: "assistant", ts: now - 2 * day }] },
  { id: "s2", curriculum_id: "c1", updated_at: now - day, outline,
    progress: { mastery: { te: 3, nai: 2 }, mistakes: [] },
    transcript: [{ role: "user", ts: now - day }, { role: "user", ts: now - day + 60000 }] },
  { id: "x", curriculum_id: "other", updated_at: now, outline, progress: { mastery: { te: 0 } }, transcript: [{ role: "user", ts: now }] }
];
const cur = { id: "c1", memory: { review_items: [
  { pointId: "te", wrongCount: 2, hintedCount: 1, nextReviewAt: now - 1000 },
  { pointId: "ta", wrongCount: 1, hintedCount: 0, nextReviewAt: now + 3 * 3600000 },
  { pointId: "nai", wrongCount: 0, hintedCount: 0, nextReviewAt: now + 3 * day }
] } };

test("学了几天按她自己开口的本地日期数，别的课不算", () => {
  const d = dash(cur, sessions, now);
  assert.equal(d.days, 2);
  assert.equal(d.sessions, 2);
  assert.equal(d.since, now - 3 * day);
});
test("掌握度取最后更新那一节的值，分四档", () => {
  const d = dash(cur, sessions, now);
  assert.deepEqual(d.dist, { steady: 1, ok: 1, review: 0, fresh: 1 });
  assert.equal(d.points, 3);
});
test("坑按栽的次数排，同一次错不在两边重复算", () => {
  const d = dash(cur, sessions, now);
  assert.deepEqual(d.pits.map(x => [x.label, x.count]), [["て形", 3], ["た形", 1]]);
});
test("今天到期算到今晚为止，另外报现在就能做的", () => {
  const d = dash(cur, sessions, now);
  assert.equal(d.dueToday, 2);
  assert.equal(d.dueNow, 1);
});
test("一节课都没上过也能画，不报错", () => {
  const d = dash({ id: "c9" }, [], now);
  assert.equal(d.days, 0);
  assert.deepEqual(d.pits, []);
  assert.equal(d.dueToday, 0);
});
test("控制台真的挂上了这张纸，点坑进错题本、点到期进该复习了", () => {
  assert.match(src, /h\(StudyDash, \{ dash: studyDashboard\(cur, props\.sessions\), accent: accent,/);
  assert.match(src, /onPits: function \(\) \{ setBookOpen\("book"\); \}, onDue: function \(\) \{ setBookOpen\("due"\); \}/);
});
