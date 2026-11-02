// 她 2026-11-02「做吧」：① 线下台词照TA本人说话；② 刷了三拍以上的景物从发出去的历史里拿掉；③ 自修删点名过的重复。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8");
const pick = (from, to) => eng.slice(eng.indexOf(from), eng.indexOf(to));
const F = new Function(pick("const THOUGHT_ECHO_FILLER", "function thoughtEchoWords") + pick("function offlineStaleTerms", "function offlineLoosenOld") + ";return {offlineStaleTerms, offlineDropStale};")();
const beat = (x) => ({ role: "char", content: x });
const B = [
  beat("头顶白炽灯管嗡嗡响。“别动。”我低头亲你。"),
  beat("白炽灯管又响了一声。“冷不冷？”我拉过卫衣。"),
  beat("白炽灯管滋啦一下。我扣住你的手。\n“看着我。”"),
];
test("刷了三拍的景物句删掉，台词和别的句子留着，存档不变", () => {
  assert.ok(F.offlineStaleTerms(B).includes("白炽灯管"));
  const out = F.offlineDropStale(B);
  assert.doesNotMatch(out[0].content, /白炽灯管/);
  assert.match(out[0].content, /“别动。”/);
  assert.match(out[2].content, /\n“看着我。”/, "分段留着");
  assert.match(B[0].content, /白炽灯管/);
});
test("不到三拍不动", () => {
  assert.deepEqual(F.offlineStaleTerms(B.slice(0, 2)), []);
});
test("三处都接上", () => {
  assert.match(eng, /const OFFLINE_VOICE_RULE = `【台词是TA本人开口，不是小说对白】/);
  assert.match(eng, /\$\{OFFLINE_AGENCY_RULE\}\n\n\$\{OFFLINE_VOICE_RULE\}/);
  assert.match(eng, /OFFLINE_AGENCY_RULE \+ "\\n\\n" \+ OFFLINE_VOICE_RULE \+/);
  assert.equal((eng.match(/offlineLoosenOld\(offlineDropStale\(session\.msgs\)\)/g) || []).length, 2);
  assert.match(eng, /点名的东西，draftScene 里又写了/);
});
