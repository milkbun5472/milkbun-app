const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("夹在文字中间的语音留在原位，不再掉到最后", () => {
  const src = eng.slice(eng.indexOf("const VOICE_SLOT_TOKEN"), eng.indexOf("function pullPauseVoice"));
  const f = new Function("ttsHasPause", "stripPauseMarks", src + ";return {markPauseVoice,voiceSlotOf};")(w => /<#[\d.]+#>/.test(w), w => w.replace(/<#[\d.]+#>/g, ""));
  // v74.395：停顿句不再猜成语音，擦掉记号照文字发
  const r = f.markPauseVoice(["先说一句", "我<#0.5#>想你", "再补一句"]);
  assert.deepStrictEqual(r.words, ["先说一句", "我想你", "再补一句"]);
  assert.deepStrictEqual(r.voice, []);
  // 单聊发气泡那一圈就地发语音；没发出去的补在最后
  assert.ok(app.includes("const _slot = typeof voiceSlotOf === \"function\" ? voiceSlotOf(words[i]) : null;"));
  // 单独那一栏 voice 取消：老习惯交回来的插在第一句后面，不排最后（v74.396）
  assert.ok(app.includes("words = words.slice(0, 1).concat(_slots, words.slice(1));"));
  assert.ok(app.includes("const vArr = _inlineVoice.filter(v => !v.sent)"));
  assert.ok(!/const openCaps = \[[^\]]*"voice"/.test(app));
  assert.ok(!app.includes("pullPauseVoice(words); if (_pv.voice.length) { words = _pv.words"));
});
test("word 里明着写的 {voice} 和「[语音]」也就地发；提示词教的是写进 word", () => {
  const src = eng.slice(eng.indexOf("const VOICE_SLOT_TOKEN"), eng.indexOf("function pullPauseVoice"));
  const f = new Function("ttsHasPause", "stripPauseMarks", src + ";return {markPauseVoice,voiceSlotOf};")(w => /<#[\d.]+#>/.test(w), w => w.replace(/<#[\d.]+#>/g, ""));
  const r = f.markPauseVoice(["先说", { voice: "想你了", emo: "sad" }, "[语音] 快回来", "再说"]);
  assert.deepStrictEqual(r.words.map(f.voiceSlotOf), [null, 0, 1, null]);
  assert.deepStrictEqual(r.voice, [{ t: "想你了", emo: "sad" }, "快回来"]);
  assert.deepStrictEqual(f.markPauseVoice([{ foo: 1 }, "a"]).words, ["a"]);
  assert.ok(app.includes('语音＝直接写进 word 数组里、你想让它出现的那个位置'));
});

test("占位符被中间哪一道加了标点、洗掉私用区字符也认得出（v74.397 真机截图里冒出「。V0」）", () => {
  const src = eng.slice(eng.indexOf("const VOICE_SLOT_TOKEN"), eng.indexOf("function pullPauseVoice"));
  const f = new Function("ttsHasPause", "stripPauseMarks", src + ";return {voiceSlotOf,VOICE_SLOT_TOKEN};")(() => false, x => x);
  assert.strictEqual(f.voiceSlotOf("。" + f.VOICE_SLOT_TOKEN(0)), 0);
  assert.strictEqual(f.voiceSlotOf(f.VOICE_SLOT_TOKEN(3) + " "), 3);
  assert.strictEqual(f.voiceSlotOf("voiceslot1 好的"), null);
  assert.ok(!/\\uE000V/.test(eng) && !/\\uE000V/.test(app));
});
test("【voice】…【/voice】标签式写法，跨好几项也并成一条就地发", () => {
  const src = eng.slice(eng.indexOf("const VOICE_SLOT_TOKEN"), eng.indexOf("function pullPauseVoice"));
  const f = new Function("ttsHasPause", "stripPauseMarks", src + ";return {markPauseVoice,voiceSlotOf};")(() => false, x => x);
  const r = f.markPauseVoice(["顺手回我也必须排第一", "【voice】到底在等谁的消息啊……男的女的？", "同学还是同事？", "我这火锅都吃不下去了……【/voice】", "你看他们都在看我笑话！"]);
  assert.deepStrictEqual(r.words.map(f.voiceSlotOf), [null, 0, null]);
  assert.deepStrictEqual(r.voice, ["到底在等谁的消息啊……男的女的？ 同学还是同事？ 我这火锅都吃不下去了……"]);
  assert.deepStrictEqual(f.markPauseVoice(["<voice>想你</voice>", "嗯"]).voice, ["想你"]);
  // 没有合上的标签＝前缀写法，只算这一项
  assert.deepStrictEqual(f.markPauseVoice(["[voice]没合上", "后面"]).voice, ["没合上"]);
});
