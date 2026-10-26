// 群幸运字符（2026-10-26 群友许愿）：100 条点亮一个字，一天最多算 200 条，一整天没人说话熄一个
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");
const a = src.indexOf("const LUCKY_PER"), b = src.indexOf("// 专属头衔（2026-10-26");
const L = new Function(src.slice(a, b) + "\nreturn { luckyTick, luckyDecay, LUCKY_PER, LUCKY_DAY_CAP };")();

test("每 100 条点亮一个，一天最多算 200 条，点满收进收藏本", () => {
  let r = L.luckyTick({ word: "好运来" }, 150, "2026-10-26");
  assert.equal(r.st.lit, 1); assert.equal(r.st.prog, 50);
  r = L.luckyTick(r.st, 500, "2026-10-26");
  assert.equal(r.st.dayN, 200, "一天封顶 200");
  assert.equal(r.st.lit, 2);
  r = L.luckyTick(r.st, 100, "2026-10-27");
  assert.ok(r.ev.some(e => e.type === "done"));
  assert.equal(r.st.book[0].word, "好运来");
  assert.equal(r.st.word, "");
});

test("一整天没人说话熄一个；连着说话不熄", () => {
  let r = L.luckyTick({ word: "LUCKY" }, 200, "2026-10-26");
  assert.equal(r.st.lit, 2);
  assert.equal(L.luckyDecay(r.st, "2026-10-27").st.lit, 2, "第二天接着聊不熄");
  const d = L.luckyDecay(r.st, "2026-10-29");
  assert.equal(d.st.lit, 0, "空了两整天熄两个");
  assert.equal(d.ev[0].type, "fade");
});
