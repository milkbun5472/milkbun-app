const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("夹在文字中间的语音留在原位，不再掉到最后", () => {
  const src = eng.slice(eng.indexOf("const VOICE_SLOT_RE"), eng.indexOf("function pullPauseVoice"));
  const f = new Function("ttsHasPause", src + ";return {markPauseVoice,voiceSlotOf};")(w => /<#[\d.]+#>/.test(w));
  const r = f.markPauseVoice(["先说一句", "我<#0.5#>想你", "嗯<#1#>", "再补一句"]);
  assert.deepStrictEqual(r.words.map(f.voiceSlotOf), [null, 0, null]);
  assert.deepStrictEqual(r.voice, ["我<#0.5#>想你 嗯<#1#>"]);
  // 单聊发气泡那一圈就地发语音；没发出去的补在最后
  assert.ok(app.includes("const _slot = typeof voiceSlotOf === \"function\" ? voiceSlotOf(words[i]) : null;"));
  assert.ok(app.includes(".concat(_inlineVoice.filter(v => !v.sent).map(v => ({ t: v.t })))"));
  assert.ok(!app.includes("pullPauseVoice(words); if (_pv.voice.length) { words = _pv.words"));
});
