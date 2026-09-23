// 她 2026-09-23：「老师出题都只是 multiple choice，没有别的比如填空或者一摞 flashcard」——闪卡这一半。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
const fn = name => { const i = src.indexOf("function " + name + "("); assert.ok(i > 0, "抠不出 " + name); return src.slice(i, src.indexOf("\n  }\n", i) + 4); };
const cst = name => { const i = src.indexOf("const " + name + " = "); assert.ok(i > 0, "抠不出 " + name); return src.slice(i, src.indexOf(";\n", i) + 2); };

// 桩照写存档那几段：大纲由 draftSessionOutline 出（units[].grammar[{id,label,note}]），
// 课页由 confirm() 存（curriculum_id + outline），卡由 addFlashcards 存在 cur.flashcards 上。
function harness() {
  let store = [{ id: "c1", subject: "日语", mode: "teach", character_ids: ["t1"], memory: { summaries: [], review_items: [] } }];
  const ctx = { Date, Math, JSON, Number, String, Array, Object, Set,
    extractJSON: raw => { try { return JSON.parse(raw); } catch (e) { return null; } },
    loadCurricula: () => JSON.parse(JSON.stringify(store)), saveCurricula: a => { store = JSON.parse(JSON.stringify(a)); } };
  vm.createContext(ctx);
  vm.runInContext("const DAY_MS = 86400000;\n" + cst("REVIEW_DAYS") + cst("FLASH_CAP") + cst("FLASH_RATE")
    + ["findCurriculum", "saveCurriculum", "updateCurriculumReview", "inMistakeBook", "mistakeBookItems", "curriculumPoints", "flashReviewKey", "flashItemOf",
       "rateFlashcard", "flashQueue", "parseFlashcards", "addFlashcards", "removeFlashcard", "dueReviewCards"].map(fn).join("\n")
    + "\nObject.assign(this, { rate: rateFlashcard, queue: flashQueue, parse: parseFlashcards, add: addFlashcards, del: removeFlashcard, points: curriculumPoints, book: mistakeBookItems, dueCards: dueReviewCards });", ctx);
  ctx.cur = () => store[0];
  return ctx;
}
const sessions = [{ id: "s1", curriculum_id: "c1", outline: { units: [{ title: "て形", grammar: [{ id: "u1__te", label: "て形", note: "动词连接" }], vocab: ["食べる"] }] } },
  { id: "s2", curriculum_id: "other", outline: { units: [{ title: "x", grammar: [{ id: "nope", label: "别的课" }] }] } }];

test("老师只许照这门课真的教过的要点做卡：编出来的 pointId、重复的正面都丢掉", () => {
  const H = harness();
  const pts = H.points(H.cur(), sessions);
  assert.equal(JSON.stringify(pts.map(p => p.id)), JSON.stringify(["u1__te"]), "别的课的要点混进来了");
  const raw = JSON.stringify({ cards: [
    { pointId: "u1__te", front: "食べる → て形", back: "食べて", aside: "" },
    { pointId: "made_up", front: "a", back: "b" },
    { pointId: "u1__te", front: "食べる → て形", back: "重复" },
    { pointId: "u1__te", front: "飲む → て形", back: "" }] });
  const cards = H.parse(raw, pts, []);
  assert.equal(cards.length, 1);
  assert.equal(H.parse(raw, pts, ["食べる → て形"]).length, 0, "已经有的那张又做了一遍");
});

test("翻卡走的是同一条艾宾浩斯线：记得挪到明天，不记得当天再来还进错题本", () => {
  const H = harness();
  const [a, b] = H.parse(JSON.stringify({ cards: [{ pointId: "u1__te", front: "A", back: "a" }, { pointId: "u1__te", front: "B", back: "b" }] }), H.points(H.cur(), sessions), []);
  H.add("c1", [a, b]);
  assert.equal(H.queue(H.cur()).length, 2, "新卡没进这一轮");
  const t = Date.now();
  H.rate("c1", a, "good");
  H.rate("c1", b, "miss");
  const items = H.cur().memory.review_items;
  const ia = items.find(x => x.key === "fc_" + a.id), ib = items.find(x => x.key === "fc_" + b.id);
  assert.equal(ia.type, "flashcard");
  assert.ok(ia.nextReviewAt - t >= 86400000 - 5000 && ia.nextReviewAt - t < 2 * 86400000, "记得那张没排到一天后");
  assert.ok(ib.nextReviewAt - t <= 4 * 3600000 + 5000, "不记得那张没当天再来");
  assert.equal(JSON.stringify(H.book(H.cur()).map(x => x.key)), JSON.stringify(["fc_" + b.id]), "不记得的没进错题本（或记得的也进了）");
  assert.equal(H.queue(H.cur()).length, 0, "刚翻过的又排进来了");
  // 第二次翻＝隔时复习，曲线往后挪一格
  H.rate("c1", a, "good");
  assert.equal(H.cur().memory.review_items.find(x => x.key === "fc_" + a.id).stage, 1);
});

test("闪卡不混进课上的题卡；删一张连它的复习卡一起走", () => {
  const H = harness();
  const [a] = H.parse(JSON.stringify({ cards: [{ pointId: "u1__te", front: "A", back: "a" }] }), H.points(H.cur(), sessions), []);
  H.add("c1", [a]);
  H.rate("c1", a, "miss");
  assert.equal(H.dueCards(H.cur(), Date.now() + 86400000).length, 0, "课上开场复习抽到了闪卡，题卡界面画不出来");
  H.del("c1", a.id);
  assert.equal((H.cur().flashcards || []).length, 0);
  assert.equal(H.cur().memory.review_items.length, 0, "卡删了，复习卡还留在错题本里");
});

test("出卡：料在 system、user 一句话、上限开满、坏了带着原文", () => {
  const g = fn("genFlashcards");
  assert.match(g, /callAI\(active, sys, \[\{ role: "user", content: "开始。" \}\], \{ maxTokens: 65535 \}\)/);
  assert.match(g, /老师这回写的是：\\n" \+ String\(raw \|\| ""\)\.slice\(0, 320\)/);
  assert.match(g, /curriculumMemoryText\(cur\)/, "老师做卡时看不见错题本");
});
