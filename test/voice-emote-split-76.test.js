// 语音里夹着「[表情] xx」：表情拆出来，语音只念剩下的字（2026-11-01 截图「他说的是：[表情] 死死抱住」）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const split = new Function(eng.slice(eng.indexOf("const VOICE_EMOTE_RE"), eng.indexOf("function emoteSlotWords")) + "; return splitVoiceEmote;")();
test("拆得开", () => {
  assert.deepEqual(split("[表情] 死死抱住"), { voice: "", emote: "死死抱住" });
  assert.deepEqual(split("抱紧我…… 【表情包】蹭蹭"), { voice: "抱紧我……", emote: "蹭蹭" });
  assert.deepEqual(split("那就一起去"), { voice: "那就一起去", emote: "" });
});
test("单聊在认语音之前拆；群聊整条是表情就改走文字", () => {
  assert.match(app, /const sp = splitVoiceEmote\(w\.voice\); if \(sp\.emote\) return a\.concat\(sp\.voice \? \[\{ \.\.\.w, voice: sp\.voice \}\] : \[\], \["\[表情\] " \+ sp\.emote\]\)/);
  assert.match(app, /if \(_sv\.emote && !_sv\.voice\) \{ item\.voice = false; item\.text = "\[表情\] " \+ _sv\.emote; \}/);
  assert.match(app, /stripAiStamp\(typeof splitVoiceEmote === "function" \? splitVoiceEmote\(item\.text\)\.voice : item\.text\)/);
});
