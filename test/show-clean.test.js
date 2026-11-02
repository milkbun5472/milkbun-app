// 她 2026-11-02：「为什么这些掉格式不做一个公共的兜底」——showClean 一处管：停顿、声音标签、字面 \n、私有〔〕。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8"), cmp = fs.readFileSync("js/components.js", "utf8"), ui = fs.readFileSync("js/phone-ui.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
const pick = (a, b) => eng.slice(eng.indexOf(a), eng.indexOf(b));
const F = new Function(eng.slice(eng.indexOf("const TTS_MARK_PAUSE"), eng.indexOf("\n", eng.indexOf("const TTS_MARK_PAUSE"))) + ";" + "const TTS_MARK_TAG_RE=/\\((?:sighs|laughs)\\)/gi;" + pick("function ttsMarkStrip", "// 这段文字里到底有没有标记") + pick("function ttsHasSoundTag", "function ttsHasPause") + ";return {showClean, privateBracketFix};");
let S; try { S = F(); } catch (e) { S = null; }
test("四样记号一处剥，她自己打的只剥停顿", () => {
  assert.ok(S, "抠得出 showClean");
  assert.equal(S.showClean("马蹄莲……<#1.2#>啧"), "马蹄莲……啧");
  assert.equal(S.showClean("上。\\n\\n我"), "上。\n\n我");
  assert.equal(S.showClean("〔偏殿那帮人〕争到现在"), "（偏殿那帮人）争到现在");
  assert.equal(S.showClean("〔今天10:28〕你好"), "你好");
  assert.equal(S.showClean("我写\\n这个", true), "我写\\n这个");
});
test("TransText、查手机便签、拆气泡都走它", () => {
  assert.match(cmp, /text = showClean\(text, isU\)/);
  assert.match(ui, /showClean\(/);
  assert.match(app, /privateBracketFix\(m\)/);
});
