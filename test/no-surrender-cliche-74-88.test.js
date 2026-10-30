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

// 她 2026-10-30：「禁了骨头酥变成骨头立起来了」「还有什么耳根子都麻了一下」——点名哪几个字，它就换个部位写。
//   改回只给判据：说的是「身体哪一处一下子酥软麻化」这一整类，不点哪一句；线下替换表里那一格拿掉，换成一条判据。
test("身体投降那一族：三处都只给判据、不点原句（线上反模板、线下、心声）", () => {
  const src = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
  assert.doesNotMatch(src, /「骨头都酥了／软了」/, "又点了原句");
  assert.doesNotMatch(src, /骨头\(都\)酥了\/骨头\(都\)软了/, "线下替换表那一格又回来了");
  assert.match(src, /身体整个投降了（身体哪一处一下子酥了、软了、麻了、化了，都是这一个模子）/);
  assert.match(src, /· 【被她打动的那一下】写她刚才具体做了什么、他那一下实际怎么了/);
  const line = src.slice(src.indexOf("const THOUGHT_VOICE ="), src.indexOf("\n", src.indexOf("const THOUGHT_VOICE =")));
  assert.match(line, /不是报一个身体投降了的结果（身体哪一处一下子酥了、软了、麻了、化了，都是这一个模子）/);
});
