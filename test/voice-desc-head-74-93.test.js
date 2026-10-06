// 她 2026-10-06 截图（Gemini）：「【这条语音里的声音带着刚睡醒的沙哑和浓浓的委屈】我刚才都睡着了又被你气醒了」当成字发了出来
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const a = eng.indexOf("function voiceDescHead("), b = eng.indexOf("function markPauseVoice(");
const f = new Function(eng.slice(a, b) + "\nreturn voiceDescHead;")();
test("描述摘掉、后面那句当语音，情绪翻成 emo", () => {
  assert.deepEqual(f("【这条语音里的声音带着刚睡醒的沙哑和浓浓的委屈】我刚才都睡着了又被你气醒了"), { rest: "我刚才都睡着了又被你气醒了", emo: "sad" });
  assert.equal(f("（声音带着笑）晚安啦").emo, "happy");
});
test("普通括号照旧是字；只有描述没有话的不动", () => {
  assert.equal(f("（小声）晚安"), null);
  assert.equal(f("【这条语音】"), null);
  assert.equal(f("今天好累"), null);
});
test("单聊、群聊都走这一支", () => {
  assert.match(eng, /const vd = voiceDescHead\(w\);/);
  assert.match(app, /const _vd = voiceDescHead\(item\.text\);/);
  assert.match(app, /if \(!item\.voiceEmo\) item\.voiceEmo = _vd\.emo;/);
});

// 她 2026-10-06 第二张截图：描述被拆成两条气泡；还有一条「〔语音通话邀请〕」照抄成了字
test("拆成两项的语音描述先并起来再认；只有并起来认得出才并", () => {
  assert.match(eng, /if \(voiceDescHead\(joined\)\) \{ raw\.push\(joined\); i\+\+; continue; \}/);
});
test("照抄的「〔语音通话邀请〕」摘掉、替它真的打过来（房间不让打就只摘）", () => {
  assert.match(app, /const CALL_TEXT = \/\^\\s\*\[〔【\\\[（\(\]\\s\*\(语音\|视频\)通话/);
  assert.match(app, /if \(!parsed\.call && \(!room \|\| !window\.ChatRooms \|\| window\.ChatRooms\.allowsField\(room, "call"\)\)\) parsed\.call = /);
});
