// 她 2026-10-06：「骨头都软了/酥了 命都给你这种八股怎么禁啊」
//   照「二十分钟」那次的教训：给判据，不把原句写进提示词（写进去就是在教它说）
const test = require("node:test");
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
const block = name => { const i = eng.indexOf("const " + name + " = `"); return eng.slice(i, eng.indexOf("`;", i)); };
// 原来这一族只给判据、不点原句（v74.88）。群友 2026-10-29 又撞上「骨头都酥了」——判据没管住，
//   改成判据照留、再把最常冒的那一族点名（点的是【不许说的】，不是给它抄的示范；线下替换表一直这么写）。
test("身体投降／交出性命那一族并进已有的反模板：判据在，最常冒的那一族也点了名", () => {
  const b = block("INTIMATE_CHAT_ANTI_CLICHE");
  assert.match(b, /【拿身体投降或交出性命来量心动】/);
  assert.match(b, /这句话里有没有她刚才做的那件具体的事/);
  assert.match(b, /禁的是模子，不是尺度/);
});

test("骨头酥了这一族点名进了线上那条和线下替换表（群友 2026-10-29）", () => {
  const src = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
  assert.match(src, /「骨头都酥了／软了」「腿都软了」「心都化了」这一族/);
  assert.match(src, /骨头\(都\)酥了\/骨头\(都\)软了\/酥了半边身子\/腿软→null；/);
});

test("心声里也禁（她 2026-10-29）：挂在各处共用的 THOUGHT_VOICE 上", () => {
  const src = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
  const line = src.slice(src.indexOf("const THOUGHT_VOICE ="), src.indexOf("\n", src.indexOf("const THOUGHT_VOICE =")));
  assert.match(line, /「骨头都酥了／软了」「腿都软了」「心都化了」这一族心声里也不用/);
});
