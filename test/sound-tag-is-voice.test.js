// 她 2026-10-04：「(clear-throat) 刚被特别提示音震醒…… (sighs) 别生气嘛」掉成了文字气泡
const fs = require("fs"), assert = require("assert"), vm = require("vm"), test = require("node:test");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("带声音标签的句子算语音，单聊群聊同一条判据", () => {
  const a = eng.indexOf("const TTS_MARK_TAGS"), b = eng.indexOf("// 按台词自动选发音矫正");
  const sb = { loadTtsApi: () => null }; vm.runInNewContext(eng.slice(a, b) + ";this.m=markPauseVoice;", sb);
  const r = sb.m(["困迷糊了……", "(clear-throat) 刚被震醒…… (sighs) 别生气嘛", "这就把问号键扣掉！"]);
  assert.deepStrictEqual([...r.voice], ["(clear-throat) 刚被震醒…… (sighs) 别生气嘛"]);
  assert.strictEqual(r.words[1], "voiceslot0");
  assert.strictEqual(r.words[0], "困迷糊了……");
  assert.strictEqual(sb.m(["(我笑了)", "早"]).voice.length, 0, "中文括号动作不算");
  assert.ok(/ttsHasSoundTag\(item\.text\)\) item\.voice = true/.test(app), "群聊接上了");
});
