// 她 2026-09-23：「一起学我怎么感觉老师出题都只是 multiple choice，没有别的比如填空……
// 还有是不是应该搞个错题本，可以放在课程里随时回看，自行选择要不要移走，然后老师也能看得到这些。」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
const fn = name => { const i = src.indexOf("function " + name + "("); assert.ok(i > 0, "抠不出 " + name); return src.slice(i, src.indexOf("\n  }\n", i) + 4); };

// 桩照【写存档的那段】来：课程存在 loadCurricula/saveCurricula 那一张表里，卡片由 updateCurriculumReview 写
function harness(seed) {
  let store = JSON.parse(JSON.stringify(seed || [{ id: "c1", subject: "日语", memory: { summaries: [], review_items: [] } }]));
  const ctx = { Date, Math, JSON, Number, String, Array, Object,
    loadCurricula: () => JSON.parse(JSON.stringify(store)), saveCurricula: a => { store = JSON.parse(JSON.stringify(a)); } };
  vm.createContext(ctx);
  vm.runInContext("const DAY_MS = 86400000;\n" + ["updateCurriculumReview", "inMistakeBook", "mistakeBookItems", "removeFromMistakeBook", "quizAnswerText", "mistakeBookText", "progressText"].map(fn).join("\n")
    + "\nthis.rev = updateCurriculumReview; this.items = mistakeBookItems; this.drop = removeFromMistakeBook; this.text = mistakeBookText; this.prog = progressText;", ctx);
  ctx.cur = () => store[0];
  return ctx;
}
const Q = { type: "fill_blank", prompt: "「食べる」的て形是？", pointId: "te", answer: "食べて", options: [] };
const sess = { id: "s1" };

test("答错进本子，记着她当时写了什么、错了几次", () => {
  const H = harness();
  H.rev("c1", sess, Q, { result: "incorrect", support: "none", confidence: "sure", ts: 1000, answer: "食べって" });
  const it = H.items(H.cur());
  assert.equal(it.length, 1);
  assert.equal(it[0].lastAnswer, "食べって", "没记她当时写的——错题本最有用的就是看自己怎么错的");
  assert.equal(it[0].wrongCount, 1);
  H.rev("c1", sess, Q, { result: "incorrect", support: "none", confidence: "sure", ts: 2000, answer: "食べで" });
  assert.equal(H.items(H.cur())[0].wrongCount, 2);
});

test("后来答对了也不自己消失——移不移她说了算；移出去只动本子，不动复习时间", () => {
  const H = harness();
  H.rev("c1", sess, Q, { result: "incorrect", support: "none", confidence: "sure", ts: 1000, answer: "x" });
  H.rev("c1", sess, Object.assign({ isReview: true, reviewKey: "te" }, Q), { result: "correct", support: "none", confidence: "sure", ts: 5000, answer: "食べて" });
  const it = H.items(H.cur());
  assert.equal(it.length, 1, "做对一次就被拿走了，她没来得及决定");
  assert.equal(it[0].lastResult, "correct");
  const due = H.cur().memory.review_items[0].nextReviewAt;
  H.drop("c1", "te");
  assert.equal(H.items(H.cur()).length, 0);
  assert.equal(H.cur().memory.review_items[0].nextReviewAt, due, "移出错题本把复习时间也动了");
  assert.ok(H.cur().memory.review_items[0].removedAt);
});

test("移出去之后又答错：回到本子里", () => {
  const H = harness();
  H.rev("c1", sess, Q, { result: "incorrect", support: "none", confidence: "sure", ts: 1000, answer: "x" });
  H.drop("c1", "te");
  H.rev("c1", sess, Q, { result: "incorrect", support: "none", confidence: "sure", ts: 9000, answer: "y" });
  const it = H.items(H.cur());
  assert.equal(it.length, 1);
  assert.equal(it[0].removedAt, null);
});

test("老卡（没有错题本那几格）：上一次没答对的就算在本子里，一打开就有东西", () => {
  const H = harness([{ id: "c1", memory: { review_items: [
    { key: "a", prompt: "旧题A", lastResult: "incorrect" }, { key: "b", prompt: "旧题B", lastResult: "correct" }] } }]);
  assert.deepEqual(Array.from(H.items(H.cur())).map(x => x.key), ["a"]);
});

test("老师看得到：还留着的（她上次答了什么）、她自己移出去的", () => {
  const H = harness();
  H.rev("c1", sess, Q, { result: "incorrect", support: "none", confidence: "sure", ts: Date.now(), answer: "食べって" });
  const Q2 = Object.assign({}, Q, { pointId: "masu", prompt: "「行く」的ます形是？", answer: "行きます" });
  H.rev("c1", sess, Q2, { result: "incorrect", support: "none", confidence: "sure", ts: Date.now(), answer: "行くます" });
  H.drop("c1", "masu");
  const t = H.text(H.cur());
  assert.match(t, /【她的错题本】/);
  assert.match(t, /她上次答「食べって」，答案是「食べて」/);
  assert.match(t, /她自己移出去的（她觉得已经会了）：\n· 「行く」的ます形是？/);
  assert.doesNotMatch(t, /逐题/, "给成了任务——一节课会变成念清单");
  // 接进老师每轮都读的那一段
  assert.match(src, /const book = mistakeBookText\(cur\);/);
});

test("题型跟着进度走：选择题答对过、填空还没对过的点——点名下一张用填空", () => {
  const H = harness();
  const units = [{ id: "u1", title: "て形", grammar: [{ id: "te", label: "て形" }, { id: "masu", label: "ます形" }] }];
  const progress = { current_unit: "u1", completed: [], mastery: { te: 1, masu: 2 }, evidence: [
    { pointId: "te", result: "correct", quizType: "choice" },
    { pointId: "masu", result: "correct", quizType: "choice" }, { pointId: "masu", result: "correct", quizType: "fill_blank" }] };
  const t = H.prog(units, progress);
  assert.match(t, /【这几个要点她已经认得出了，再考就用 fill_blank，让她自己写出来】て形/);
  assert.doesNotMatch(t, /自己写出来】[^\n]*ます形/, "已经自己写出来过的点还在被点名");
  // 出题说明里写清了判据；题型列表不再把 choice 摆第一
  assert.match(src, /【题型怎么挑】看她对这个要点到了哪一步/);
  assert.match(src, /\\"type\\":\\"fill_blank\|choice\|true_false\\"/);
  // 作答记录带上题型——上面那一段要靠它认
  assert.match(src, /quizId: entry\.id, quizType: entry\.quiz\.type, result: grade\.result/);
  assert.match(src, /confidence: confidence, ts: now, answer: selected \}\);/, "答案没记进复习卡");
});

test("错题本是课程里的一整页；重做答对不自动移走；移出先问一句", () => {
  assert.match(src, /if \(bookOpen\) return h\(MistakeBook, \{/);
  assert.match(src, /"还有 " \+ bookCount \+ " 道 ›"/);
  const i = src.indexOf("function MistakeBook("), j = src.indexOf("function CurriculumConsole(", i);
  const mb = src.slice(i, j);
  assert.doesNotMatch(mb, /h\(Sheet/, "做成半窗了");
  assert.match(mb, /做对了——要不要移出错题本，你来定/);
  assert.doesNotMatch(mb.slice(mb.indexOf("async function answer("), mb.indexOf("function drop(")), /removeFromMistakeBook/, "重做答对就自动移走了");
  assert.match(mb, /requestAppConfirm\("移出错题本？"/);
});
