// 她 2026-11-03：医学生那位两拍都「我本来按专业条理……结果全被撕碎」。认骨架不认词表，前两拍都有就点名。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8");
const F = new Function(eng.slice(eng.indexOf("const PROF_FRAME_RE"), eng.indexOf("function spokenLinesOf")) + ";return {profFrameIn, profTailFor};")();
test("认得出两种说法的同一个骨架，平常句子不算", () => {
  assert.ok(F.profFrameIn("那些关于骨盆受力角、黏膜耐受度的条理，在这一瞬间全被抛到了脑后。"));
  assert.ok(F.profFrameIn("直接把那些理性条理撕扯得一干二净。"));
  assert.ok(F.profFrameIn("写在教科书上的名词只剩下一片空白的杂音"));
  assert.ok(!F.profFrameIn("我解开扣子，指尖碰到你的锁骨。"));
  assert.ok(!F.profFrameIn("他按流程把报告交了。"));
});
test("前两拍都有才点名", () => {
  assert.match(F.profTailFor(["条理全被抛到了脑后。", "理性条理撕扯得一干二净。"]), /不用这个对照/);
  assert.equal(F.profTailFor(["条理全被抛到了脑后。", "我亲了你一下。"]), "");
});
test("单人线下、群线下都接上", () => {
  assert.match(eng, /propTail \+ \(isDigital \? "" : profTailFor\(/);
  assert.equal((eng.match(/gBeatEchoTail \+ gProfTail \+ /g) || []).length, 2);
});
