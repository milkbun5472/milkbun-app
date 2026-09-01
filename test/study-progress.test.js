"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadStudy() {
  const sandbox = {
    window: {},
    loadJSON: function (_key, fallback) { return fallback; },
    saveJSON: function () {},
    extractJSON: function (raw) { return JSON.parse(raw); },
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/study.js"), "utf8"), sandbox);
  return sandbox.window.Study;
}

const Study = loadStudy();
const units = [
  { id: "u1", grammar: [{ id: "a" }, { id: "b" }] },
  { id: "u2", grammar: [{ id: "c" }] }
];

test("本节独立答对后进度条会动，但不会冒充完成整节", () => {
  const ratio = Study.studyProgressRatio(units, { current_unit: "u1", completed: [], mastery: { a: 2, b: 0 } });
  assert.equal(ratio, 0.225);
  assert.ok(ratio < 0.5);
});

test("完成小节仍是进度的权威边界", () => {
  assert.equal(Study.studyProgressRatio(units, { current_unit: "u2", completed: ["u1"], mastery: {} }), 0.5);
  assert.equal(Study.studyProgressRatio(units, { current_unit: "u2", completed: ["u1", "u2"], mastery: { c: 3 } }), 1);
});

test("题卡兼容 point_id 和 pointId 两种模型字段", () => {
  const base = { type: "true_false", prompt: "天空是蓝色吗？", answer: true };
  assert.equal(Study.parseQuiz(JSON.stringify(Object.assign({ quiz: Object.assign({ point_id: "a" }, base) }))).pointId, "a");
  assert.equal(Study.parseQuiz(JSON.stringify(Object.assign({ quiz: Object.assign({ pointId: "b" }, base) }))).pointId, "b");
});

test("填空题卡可携带原生词块，中文词块间空格不影响本地判定", () => {
  const q = Study.parseQuiz(JSON.stringify({ quiz: {
    type: "fill_blank", prompt: "拼成一句话", point_id: "a", answer: "我喜欢猫",
    word_bank: ["我", "喜欢", "猫", "狗"]
  } }));
  assert.deepEqual(Array.from(q.wordBank), ["我", "喜欢", "猫", "狗"]);
  assert.equal(Study.normalizeQuizAnswer("我 喜欢 猫"), Study.normalizeQuizAnswer("我喜欢猫"));
});

test("识别题第一次答对不冒充主动掌握，重复独立识别或主动填空才升级", () => {
  const choice = { type: "choice", pointId: "a" };
  assert.equal(Study.quizMasteryLevel(choice, "correct", "none", "sure", []), 1);
  assert.equal(Study.quizMasteryLevel(choice, "correct", "none", "sure", [{ pointId: "a", quizId: "old", result: "correct", support: "none", confidence: "sure" }]), 2);
  assert.equal(Study.quizMasteryLevel({ type: "fill_blank", pointId: "a" }, "correct", "none", "sure", []), 2);
  assert.equal(Study.quizMasteryLevel({ type: "fill_blank", pointId: "a", isReview: true }, "correct", "none", "sure", []), 3);
});

test("老师收到当前要点的稳定 id，题卡不再靠猜外键", () => {
  const text = Study.outlineSlice({ level: "入门", units: [{ id: "u1", title: "第一节", grammar: [{ id: "u1__a", label: "核心点" }] }] }, "u1", "测试课");
  assert.match(text, /\[u1__a\] 核心点/);
});

test("普通题只准考当前与已完成小节，结课题只准考当前小节", () => {
  const progress = { current_unit: "u2", completed: ["u1"] };
  assert.deepEqual(Array.from(Study.allowedQuizPointIds(units, progress, false)), ["a", "b", "c"]);
  assert.deepEqual(Array.from(Study.allowedQuizPointIds(units, progress, true)), ["c"]);
  assert.deepEqual(Array.from(Study.allowedQuizPointIds(units, { current_unit: "u1", completed: [] }, false)), ["a", "b"]);
});

test("结课只认绑定题卡的结构化答案，普通消息不能冒充", () => {
  const ticket = { quizId: "q_exit", unitId: "u1", askedAt: 100 };
  const ordinary = { transcript: [{ id: "u1", role: "user", content: "等一下", ts: 110 }] };
  assert.equal(Study.exitAnswerEntry(ordinary, ticket), null);
  const answered = { transcript: ordinary.transcript.concat([{
    id: "qa", role: "user", studyAction: "quiz_answer", quizId: "q_exit", quizPointId: "a", quizLevel: 2, ts: 120
  }]) };
  assert.equal(Study.exitAnswerEntry(answered, ticket).id, "qa");
});

test("结课必须答过绑定题，并覆盖当前小节全部要点", () => {
  const unit = { id: "u1", grammar: [{ id: "a" }, { id: "b" }] };
  const ticket = { quizId: "q_exit", unitId: "u1", askedAt: 100 };
  const answer = [{ id: "qa", role: "user", studyAction: "quiz_answer", quizId: "q_exit", quizPointId: "a", quizLevel: 2, ts: 120 }];
  assert.equal(Study.unitCompletionGate(unit, { mastery: { a: 2, b: 1 } }, ticket, answer).passed, false);
  assert.deepEqual(Array.from(Study.unitCompletionGate(unit, { mastery: { a: 2, b: 1 } }, ticket, answer).missing), ["b"]);
  assert.equal(Study.unitCompletionGate(unit, { mastery: { a: 2, b: 2 } }, ticket, answer).passed, true);
});

test("一起研究截断前先把旧记录放进待摘要缓冲，普通课程仍只保留尾部", () => {
  const transcript = Array.from({ length: 5 }, function (_, i) { return { id: "m" + i, role: i % 2 ? "char" : "user", name: "同伴", content: "内容" + i, ts: i }; });
  const research = Study.compactStudyTranscript({ mode: "costudy", transcript: transcript, progress: { running_summary: "旧摘要" } }, 3);
  assert.deepEqual(Array.from(research.transcript, function (m) { return m.id; }), ["m2", "m3", "m4"]);
  assert.deepEqual(Array.from(research.progress.summary_buffer, function (m) { return m.id; }), ["m0", "m1"]);
  assert.equal(research.progress.running_summary, "旧摘要");
  const lesson = Study.compactStudyTranscript({ mode: "teach", transcript: transcript, progress: {} }, 3);
  assert.equal(lesson.transcript.length, 3);
  assert.equal(lesson.progress.summary_buffer, undefined);
});

test("进度提示只注入当前小节的掌握度和错误", () => {
  const text = Study.progressText(units, {
    current_unit: "u2", completed: ["u1"], mastery: { a: 0, c: 2 },
    mistakes: [{ pointId: "a", note: "旧错", resolved: false }, { pointId: "c", note: "当前错", resolved: false }]
  });
  assert.doesNotMatch(text, /a:|旧错/);
  assert.match(text, /c:基本会|当前错/);
});
