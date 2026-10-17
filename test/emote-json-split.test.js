const test = require("node:test"); const assert = require("node:assert");
const fs = require("fs"); const s = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const a = s.indexOf("const EMOTE_SLOT_RE"), b = s.indexOf("\n}\n", s.indexOf("function emoteSlotWords")) + 3;
const emoteSlotWords = new Function(s.slice(a, b) + "; return emoteSlotWords;")();
test("一行一泡的 JSON 拼回来认成表情，空壳整串拿掉", () => {
  assert.deepStrictEqual(emoteSlotWords(["困", "{", ":", ",", ":", "}", "好"], [], x => x).words, ["困", "好"]);
  const r = emoteSlotWords(["a", "{", '"emote": "拿枪"', "}"], [{ keyword: "拿枪" }], x => x);
  assert.deepStrictEqual(r.words, ["a", "emoteslot0"]);
  assert.deepStrictEqual(emoteSlotWords(["{", '"emote": "拿枪"', "}"], [], x => x).words, []);
});
test("写成一串字的 {voice,emo} 拆回语音，不把整串念出来", () => {
  const a = s.indexOf("const VOICE_SLOT_TOKEN"), b = s.indexOf("\n}\n", s.indexOf("function markPauseVoice")) + 3;
  const markPauseVoice = new Function("ttsHasPause", "stripPauseMarks", "ttsHasSoundTag", s.slice(a, b) + "; return markPauseVoice;")(() => false, x => x, () => false);
  const r = markPauseVoice(['{"voice":"大事……我能有什么大事瞒着你啊","emo":"fearful"}', "嗯"]);
  assert.deepStrictEqual(r.voice, [{ t: "大事……我能有什么大事瞒着你啊", emo: "fearful" }]);
  assert.strictEqual(r.words[1], "嗯");
});
