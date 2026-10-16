// 她 2026-10-13：「不是真歌，就是唱几句这样」——会唱的那一档（ElevenLabs eleven_v3）把 ♪ 包的歌词送成 [sings]
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const chunk = src.slice(src.indexOf("const TTS_MARK_TAGS = ["), src.indexOf("function ttsMarkStrip("));
const make = api => new Function("loadTtsApi", chunk + "\nreturn { ttsMarkForSynth, voiceSoundHint, ttsSingOn };")(() => api);

test("eleven_v3：♪ 包起来的那几句换成 [sings] 送去合成，提示词教它怎么唱", () => {
  const f = make({ enabled: true, provider: "elevenlabs", elModel: "eleven_v3" });
  assert.equal(f.ttsSingOn(), true);
  const out = f.ttsMarkForSynth("睡吧，♪月亮代表我的心♪ 好啦。");
  assert.match(out, /\[sings\] 月亮代表我的心/);
  assert.ok(!/♪/.test(out));
  assert.match(f.voiceSoundHint(), /♪月亮代表我的心♪/);
  assert.equal(make({ enabled: true, provider: "elevenlabs", elModel: "eleven_v4" }).ttsSingOn(), true, "v4 以后也认");
});

test("不会唱的那几家：♪ 去掉照常念，提示词一个字都不多", () => {
  for (const api of [{ enabled: true, provider: "minimax", model: "speech-02-hd" }, { enabled: true, provider: "elevenlabs", elModel: "eleven_multilingual_v2" }, { enabled: true, provider: "fish" }]) {
    const f = make(api);
    assert.equal(f.ttsSingOn(), false);
    const out = f.ttsMarkForSynth("♪月亮代表我的心♪");
    assert.equal(out, "月亮代表我的心");
    assert.ok(!/♪/.test(f.voiceSoundHint()));
  }
});
