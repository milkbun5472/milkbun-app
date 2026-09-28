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

// ── 打卡日历 / 知识地图 / 单元测（她 2026-09-28：「按你说的顺序来，先做123」）──
test("连续打卡从今天往回数；今天还没学就从昨天数起，不算断", () => {
  const mk = offs => [{ id: "s", curriculum_id: "c1", updated_at: now, outline, progress: {},
    transcript: offs.map(o => ({ role: "user", ts: now - o * day })) }];
  assert.equal(dash({ id: "c1" }, mk([0, 1, 2, 4]), now).streak, 3);
  assert.equal(dash({ id: "c1" }, mk([1, 2]), now).streak, 2, "今天没学不该把连续清零");
  assert.equal(dash({ id: "c1" }, mk([3]), now).streak, 0);
});
test("每日目标：今天学过 + 到点的复习清零，两样都齐才算", () => {
  const d = dash(cur, sessions, now);
  assert.equal(d.goal.studied, false, "今天没开口也没做复习卡");
  assert.equal(d.goal.reviewsClear, false);
  const done = dash({ id: "c1", memory: { review_items: [{ pointId: "te", nextReviewAt: now + day, updatedAt: now - 1000 }] } }, sessions, now);
  assert.equal(done.goal.done, true, "今天做过复习卡也算学过");
});

const grab = (a, b) => { const x = src.indexOf(a), y = src.indexOf(b, x); assert.ok(x > 0 && y > x, "抠不出 " + a); return src.slice(x, y); };
const kmap = new Function(grab("  function knowledgeMap(", "  // ── 单元测") + "\nreturn knowledgeMap;")();
test("知识地图：同名小节并成一个，掌握度取最后那一节，证据和复习卡挂在点上", () => {
  const withEv = sessions.map(x => x.id === "s2" ? { ...x, progress: { ...x.progress, evidence: [{ pointId: "te", result: "correct", support: "none", ts: now - day }] } } : x);
  const units = kmap(cur, withEv);
  assert.equal(units.length, 1);
  const te = units[0].points.find(p => p.id === "te");
  assert.equal(te.level, 3);
  assert.equal(te.evidence.length, 1);
  assert.equal(te.mistakes.length, 1);
  assert.equal(te.item.wrongCount, 2);
  assert.equal(units[0].points.find(p => p.id === "ta").level, 0);
});

function testHarness() {
  let store = [{ id: "c1", subject: "日语", memory: { summaries: [], review_items: [] } }];
  const reviewed = [];
  const body = grab("  function parseUnitTest(", "  window.Study = {");
  const api = new Function("extractJSON", "parseQuiz", "updateCurriculumReview", "findCurriculum", "saveCurriculum", "TEST_CAP",
    body + "\nreturn { parseUnitTest, recordUnitTest, lastUnitTest, testByPoint };")(
    s => { try { return JSON.parse(s); } catch (e) { return null; } },
    raw => { const q = JSON.parse(raw).quiz; return q && q.prompt ? { type: q.type, prompt: q.prompt, pointId: q.point_id, options: q.options || [], answer: q.answer, aliases: [], explanation: q.explanation || "" } : null; },
    (curId, s, quiz, outcome) => reviewed.push({ quiz, outcome }),
    id => JSON.parse(JSON.stringify(store.find(c => c.id === id) || null)),
    c => { store = store.map(x => x.id === c.id ? c : x); }, 40);
  return { api, reviewed, store: () => store[0] };
}
test("单元测：只收这个单元的要点，每道都走复习卡那条路（错的进错题本），成绩单存下来能跟上次比", () => {
  const H = testHarness();
  const qs = H.api.parseUnitTest(JSON.stringify({ quizzes: [
    { point_id: "te", type: "fill_blank", prompt: "食べる→？", answer: "食べて" },
    { point_id: "zzz", type: "fill_blank", prompt: "别的单元", answer: "x" },
    { point_id: "ta", type: "true_false", prompt: "行った 对吗", answer: "true" }
  ] }), ["te", "ta"]);
  assert.equal(qs.length, 2, "别的单元的点混进来了");
  assert.ok(qs.every(q => q.isReview && q.hints.length === 0), "单元测不给提示");
  const unit = { key: "动词变形", title: "动词变形" };
  const first = H.api.recordUnitTest("c1", unit, [{ quiz: qs[0], answer: "食べって", result: "incorrect" }, { quiz: qs[1], answer: "true", result: "correct" }]);
  assert.equal(first.score, 1);
  assert.equal(H.reviewed.length, 2);
  assert.equal(H.reviewed[0].outcome.support, "none");
  assert.equal(H.reviewed[0].outcome.result, "incorrect");
  assert.equal(H.store().memory.tests.length, 1);
  const second = H.api.recordUnitTest("c1", unit, [{ quiz: qs[0], answer: "食べて", result: "correct" }, { quiz: qs[1], answer: "true", result: "correct" }]);
  const prev = H.api.lastUnitTest(H.store(), unit.key, second.id);
  assert.equal(prev.id, first.id);
  assert.deepEqual(H.api.testByPoint(second).te, { right: 1, total: 1 });
});
test("控制台挂上了知识地图和单元测两格", () => {
  assert.match(src, /cell\("map", "知识地图"/);
  assert.match(src, /cell\("test", "单元测"/);
  assert.match(src, /if \(bookOpen === "map"\) return h\(KnowledgeMap,/);
  assert.match(src, /if \(bookOpen === "test"\) return h\(UnitTest,/);
});
