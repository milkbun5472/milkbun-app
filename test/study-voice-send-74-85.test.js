// 她 2026-10-05：「我的一起学要语音你为什么不做！」——一起学里TA也能发语音（四种模式都算）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "study.js"), "utf8");
test("say 里的 {voice} 变成语音那一条；落地就念，点气泡再念；没配语音不提", () => {
  const i = src.indexOf("const VOICE_PRE"), j = src.indexOf("let _voiceQ", i);
  const f = new Function("ttsReady", src.slice(i, j) + ";return { sayStr, isVoice, voiceOk };")(() => true);
  assert.equal(f.sayStr({ voice: "这道题你再想想" }), "🔊 这道题你再想想");
  assert.equal(f.sayStr("打字的"), "打字的");
  assert.equal(f.voiceOk({ voiceId: "v1" }), true);
  assert.equal(f.voiceOk({}), false, "没音色的不该教他发语音");
  assert.match(src, /parts\.push\(OUT_FMT \+ voiceHint\(char\)\);/);
  assert.match(src, /playVoice\(char, says\[i\]\);/);
  assert.match(src, /text: sayStr\(t\.say\)/, "我来教那一种没接上");
});
