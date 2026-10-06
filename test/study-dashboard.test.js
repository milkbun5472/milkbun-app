// 她 2026-09-28：一起学的仪表盘——学了几天 / 掌握度彩带 / 最容易栽的三个坑 / 今天到期几道。零新数据，纯展示。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
const i = src.indexOf("  function studyDashboard("), j = src.indexOf("  // ── 知识地图（", i);
assert.ok(i > 0 && j > i, "抠不出 studyDashboard");
const causeSrc = (() => { const a = src.indexOf("  const MISTAKE_CAUSE = {"), b = src.indexOf("  // ── 答一张复习卡", a); assert.ok(a > 0 && b > a, "抠不出错因"); return src.slice(a, b).replace(/  function setMistakeCause[\s\S]*?\n  }\n/, ""); })();
const dash = new Function(causeSrc + src.slice(i, j) + "\nreturn studyDashboard;")();

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
  const body = grab("  function parseUnitTest(", "  // ── 错因");
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


// ── 快刷 / 错因 / 周报（她 2026-09-28：「接着做快刷模式和错因分类周报吧」）──
const H2 = (() => {
  const vm = require("node:vm");
  let store = [{ id: "c1", subject: "日语", memory: { summaries: [], review_items: [] } }];
  const ctx = { Date, Math, JSON, Number, String, Array, Object,
    loadCurricula: () => JSON.parse(JSON.stringify(store)), saveCurricula: a => { store = JSON.parse(JSON.stringify(a)); },
    gradeQuizAnswer: async (a, q, v) => ({ result: v === q.answer ? "correct" : "incorrect" }),
    rateFlashcard: () => null, CB: () => "", callAI: async () => "" };
  vm.createContext(ctx);
  const one = name => { const x = src.indexOf("  function " + name + "("); assert.ok(x > 0, name); return src.slice(x, src.indexOf("\n  }\n", x) + 4); };
  const asy = name => { const x = src.indexOf("  async function " + name + "("); assert.ok(x > 0, name); return src.slice(x, src.indexOf("\n  }\n", x) + 4); };
  const rd = src.slice(src.indexOf("const REVIEW_DAYS = "), src.indexOf("\n", src.indexOf("const REVIEW_DAYS = ")));
  // findCurriculum / saveCurriculum 是一行的函数，按「到下一个 }」抠会抠过头——照写存档那一对的意思直接给
  vm.runInContext("const DAY_MS = 86400000;\nfunction findCurriculum(id) { return loadCurricula().find(function (c) { return c.id === id; }) || null; }\n"
    + "function saveCurriculum(c) { saveCurricula(loadCurricula().map(function (x) { return x.id === c.id ? c : x; })); }\n" + rd + "\n" + src.slice(src.indexOf("  const MISTAKE_CAUSE = {"), src.indexOf("  // ── 答一张复习卡"))
    + ["updateCurriculumReview", "inMistakeBook", "quizAnswerText", "reviewStageText", "upcomingReviewDays", "weekStart", "examCountdown", "setExam", "studyTime", "minutesText", "pointLabels", "fileSafe", "todayStr", "ankiExport", "mistakeBookHtml", "weeklyReport", "saveWeeklyNote", "mistakeBookItems", "mistakeBookText", "curriculumMemoryText"].map(one).join("\n")
    + asy("answerReviewItem")
    + "\nconst STUDY_GAP_MS = 10 * 60000;\nthis.api = { updateCurriculumReview, setMistakeCause, answerReviewItem, weeklyReport, saveWeeklyNote, mistakeBookText, weekStart, examCountdown, setExam, studyTime, curriculumMemoryText, ankiExport, mistakeBookHtml };", ctx);
  ctx.cur = () => store[0];
  return ctx;
})();
test("错因是她点的：重做一次也不丢，老师看错题本时看得见", async () => {
  const Q = { type: "fill_blank", prompt: "て形？", pointId: "te", answer: "食べて", options: [] };
  H2.api.updateCurriculumReview("c1", { id: "s" }, Q, { result: "incorrect", support: "none", ts: 1000, answer: "x" });
  H2.api.setMistakeCause("c1", "te", "mixup");
  const item = H2.cur().memory.review_items[0];
  assert.equal(item.cause, "mixup");
  const r = await H2.api.answerReviewItem({}, "c1", item, "还是错", "quick-drill");
  assert.equal(r.ok, true);
  assert.equal(r.result, "incorrect");
  assert.equal(H2.cur().memory.review_items[0].cause, "mixup", "重做一次把错因冲掉了");
  assert.match(H2.api.mistakeBookText(H2.cur()), /她自己说是「记混了」/);
});
test("快刷和「该复习了」走同一份判卷：MistakeBook 里不再自己拼 quiz 调 gradeQuizAnswer", () => {
  const mb = src.slice(src.indexOf("  function MistakeBook("), src.indexOf("  function FlashDeck("));
  assert.doesNotMatch(mb, /gradeQuizAnswer\(/);
  assert.match(mb, /answerReviewItem\(/);
  const qd = src.slice(src.indexOf("  function QuickDrill("), src.indexOf("  // ── 周报页"));
  assert.match(qd, /answerReviewItem\(/);
  assert.match(qd, /rateReviewCard\(/);
});
test("周报：这周新升到基本会的、从会掉回去的、复习次数和单元测都算对，评语按周存", () => {
  const now = new Date(2026, 8, 30, 12).getTime(), day = 86400000;   // 周三
  const mon = H2.api.weekStart(now);
  assert.equal(new Date(mon).getDay(), 1);
  const cur = { id: "c1", memory: { review_items: [{ pointId: "ta", updatedAt: now - day, lastResult: "correct", lastSupport: "none", stage: 1, nextReviewAt: now + 2 * day }],
    tests: [{ unitTitle: "动词变形", score: 3, total: 4, ts: now - day }, { unitTitle: "旧的", score: 1, total: 4, ts: mon - 3 * day }] } };
  const sess = [{ curriculum_id: "c1", outline: { units: [{ grammar: [{ id: "te", label: "て形" }, { id: "nai", label: "ない形" }] }] },
    transcript: [{ role: "user", ts: now }, { role: "user", ts: mon - day }],
    progress: { evidence: [
      { pointId: "te", level: 1, ts: mon - 2 * day }, { pointId: "te", level: 2, ts: now - day },
      { pointId: "nai", level: 2, ts: mon - 2 * day }, { pointId: "nai", level: 1, ts: now - 1000 } ] } }];
  const r = JSON.parse(JSON.stringify(H2.api.weeklyReport(cur, sess, now)));
  assert.deepEqual(r.learned, ["て形"]);
  assert.deepEqual(r.slipped, ["ない形"]);
  assert.equal(r.days, 2, "周一之前那天不该算进这周");
  assert.equal(r.reviewed, 1);
  assert.deepEqual(r.tests, [{ title: "动词变形", score: 3, total: 4 }]);
  assert.equal(r.nextWeek, 1);
});
test("控制台挂上了快刷和这周两格", () => {
  assert.match(src, /cell\("drill", "快刷"/);
  assert.match(src, /cell\("week", "这周"/);
  assert.match(src, /if \(bookOpen === "drill"\) return h\(QuickDrill,/);
  assert.match(src, /if \(bookOpen === "week"\) return h\(WeeklyPage,/);
});


// ── 考试倒计时 / 学习时长（她 2026-09-28：「接着做考试倒计时和学习时长吧」）──
test("考试倒计时按本地日期数天，老师看得到；考完了就不再催", () => {
  const now = new Date(2026, 8, 28, 22, 0).getTime();
  const cur = { id: "c1", subject: "日语", exam: { name: "N4", date: "2026-10-05" } };
  assert.equal(H2.api.examCountdown(cur, now).days, 7);
  assert.equal(H2.api.examCountdown({ exam: { date: "2026-09-28" } }, now).days, 0);
  assert.equal(H2.api.examCountdown({ exam: { date: "乱写" } }, now), null);
  // 这一句按【真的今天】判考没考完（不收 now）：日子写死在不远的将来，过了那天这条就自己红了（2026-10-06 就红过一次）
  assert.match(H2.api.curriculumMemoryText({ ...cur, exam: { name: "N4", date: "2099-10-05" } }), /【她在备考】「N4」在 2099-10-05/);
  assert.doesNotMatch(H2.api.curriculumMemoryText({ id: "c1", exam: { name: "旧", date: "2020-01-01" } }), /备考/);
});
test("学习时长：课页里连着说话的算进去，隔太久断开；番茄钟按课名认；重叠只算一次", () => {
  const now = new Date(2026, 8, 30, 22, 0).getTime(), min = 60000;
  const base = new Date(2026, 8, 30, 20, 0).getTime();
  const sess = [{ curriculum_id: "c1", transcript: [
    { ts: base }, { ts: base + 5 * min }, { ts: base + 9 * min },   // 一段：1 + 9 分钟
    { ts: base + 40 * min } ] }];                                     // 隔了 31 分钟，另起一段：1 分钟
  const pomo = [
    { task: "背日语单词", focusedMinutes: 25, ts: base + 70 * min },   // 25 分钟，跟上面没重叠
    { task: "日语", focusedMinutes: 5, ts: base + 8 * min },           // 完全落在第一段里，不重复算
    { task: "写论文", focusedMinutes: 60, ts: base } ];                 // 不是这门课
  const r = H2.api.studyTime({ id: "c1", subject: "日语" }, sess, pomo, now);
  assert.equal(r.today, 10 + 1 + 25);
  assert.equal(r.total, 36);
});
test("概况挂上了倒计时和时长，周报把时长和考试也递给老师", () => {
  assert.match(src, /time: studyTime\(cur, props\.sessions, loadJSON\("x_pomodoro_saves", \[\]\)\)/);
  assert.match(src, /"＋ 设个考试日期，倒着数"/);
  assert.match(src, /离「" \+ report\.exam\.name \+ "」还有 "/);
});


// ── 导出 / 番茄钟选课（她 2026-09-28：「接着做导出吧，然后开番茄钟选一门课」）──
test("Anki 导出：带表头，一行一张，字段里的换行和制表符不会把一张卡拆开，标签带课名和要点", () => {
  const cur = { id: "c1", subject: "日语 N4", flashcards: [
    { id: "f1", front: "食べる\tて形", back: "食べて\n一段动词", aside: "别加促音", pointId: "te" },
    { id: "f2", front: "<b>行く</b>", back: "行った" } ] };
  const txt = H2.api.ankiExport(cur, [{ outline: { units: [{ grammar: [{ id: "te", label: "て形" }] }] } }]);
  const lines = txt.trim().split("\n");
  assert.deepEqual(lines.slice(0, 4), ["#separator:tab", "#html:true", "#tags column:3", "#deck:日语 N4"]);
  assert.equal(lines.length, 6);
  assert.deepEqual(lines[4].split("\t"), ["食べる て形", "食べて<br>一段动词<br><br><i>别加促音</i>", "日语_N4 て形"]);
  assert.equal(lines[5].split("\t")[0], "&lt;b&gt;行く&lt;/b&gt;", "字段里的尖括号得转义，不然 Anki 当成 HTML");
});
test("错题本导出：只有还在本子里的，题目、她上次写的、答案、错因都在，内容全转义", () => {
  const cur = { id: "c1", subject: "日语", memory: { review_items: [
    { key: "a", pointId: "te", type: "fill_blank", prompt: "<script>x</script>", answer: "食べて", lastAnswer: "食べって", lastResult: "incorrect", inBook: true, wrongCount: 2, cause: "mixup", updatedAt: 2 },
    { key: "b", pointId: "ta", type: "fill_blank", prompt: "已经移出去的", answer: "行った", inBook: false, updatedAt: 1 } ] } };
  const html = H2.api.mistakeBookHtml(cur, []);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /上次写的：食べって/);
  assert.match(html, /答案：食べて/);
  assert.match(html, /错因：记混了/);
  assert.doesNotMatch(html, /已经移出去的/);
});
test("番茄钟选了课的按课认，别的课不算；没选课的老记录才看任务名", () => {
  const now = new Date(2026, 8, 30, 22, 0).getTime(), min = 60000;
  const pomo = [
    { curId: "c1", task: "随便写的", focusedMinutes: 20, ts: now - 60 * min },
    { curId: "c2", task: "日语", focusedMinutes: 30, ts: now - 120 * min },   // 写着日语但选的是别的课
    { task: "日语单词", focusedMinutes: 10, ts: now - 200 * min } ];          // 老记录
  const r = H2.api.studyTime({ id: "c1", subject: "日语" }, [], pomo, now);
  assert.equal(r.total, 30);
  assert.equal(H2.api.studyTime({ id: "c3", subject: "" }, [], [{ task: "什么", focusedMinutes: 9, ts: now }], now).total, 0, "课名空着时不该把没选课的记录全吞进来");
});
test("导出按钮挂在闪卡页和错题本页；番茄钟把选的课记在场次和往期记录上", () => {
  assert.match(src, /right: all\.length \? h\(ExportBtn, \{ kind: "anki"/);
  assert.match(src, /right: !due && items\.length \? h\(ExportBtn, \{ kind: "book"/);
  const pomo = fs.readFileSync(path.join(__dirname, "..", "js", "pomodoro.js"), "utf8");
  assert.match(pomo, /const next = \{ char: c, charId: c\.id, curId: curId \|\| null,/);
  assert.match(pomo, /task: s\.task, curId: s\.curId \|\| null,/);
  assert.match(pomo, /setCurId\(restored\.curId \|\| ""\)/);
});
