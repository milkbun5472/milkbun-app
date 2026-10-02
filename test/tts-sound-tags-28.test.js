// 她 2026-10-02：speech-2.8 认声音标签——选了 2.8 就放行去合成、教模型怎么写；气泡里一律剥掉
const test = require("node:test");
const assert = require("node:assert");
const engine = require("fs").readFileSync(require("path").join(__dirname, "..", "js/engine.js"), "utf8");
const load = cfg => {
  const i = engine.indexOf("const TTS_MARK_TAGS = ["), j = engine.indexOf("function ttsLangBoost(", i);
  return new Function("loadTtsApi", engine.slice(i, j) + "\nreturn { ttsMarkStrip, ttsMarkForSynth, voiceSoundHint };")(() => cfg);
};
test("选了 speech-2.8：标签留着送去合成，提示词里教", () => {
  const F = load({ enabled: true, provider: "minimax", model: "speech-2.8-hd" });
  assert.match(F.ttsMarkForSynth("好啦(breath)我在呢(sighs)"), /\(breath\).*\(sighs\)/);
  assert.match(F.voiceSoundHint(), /\(breath\)/);
});
test("别的模型：照旧剥、不教", () => {
  const F = load({ enabled: true, provider: "minimax", model: "speech-02-hd" });
  assert.ok(!/\(breath\)/.test(F.ttsMarkForSynth("好啦(breath)我在呢")));
  assert.equal(F.voiceSoundHint(), "");
});
test("气泡里不管哪个模型都剥干净（含原来漏掉的那几个）", () => {
  const F = load({ enabled: true, provider: "minimax", model: "speech-2.8-hd" });
  assert.equal(F.ttsMarkStrip("过来(breath)乖(lip-smacking)(snorts)(sniffs)(emm)").replace(/\s/g, ""), "过来乖");
});
