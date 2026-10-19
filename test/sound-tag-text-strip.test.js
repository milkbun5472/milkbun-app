// 声音标签漏进文字气泡时屏幕上不露（她 2026-10-19 截图），她自己打的不动
const test = require("node:test"), assert = require("node:assert");
const comp = require("fs").readFileSync(require("path").join(__dirname, "../js/components.js"), "utf8");
test("TransText 画之前剥声音标签，只剥 TA 的", () => {
  const i = comp.indexOf("function TransText("), seg = comp.slice(i, i + 1500);
  assert.match(seg, /if \(!isU && typeof text === "string" && text\.indexOf\("\("\) >= 0 && typeof ttsHasSoundTag === "function" && ttsHasSoundTag\(text\)/);
});
test("普通回复拆完泡以后再认一遍带声音标签的那泡，变语音", () => {
  const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  const i = app.indexOf("拆完泡以后】再认一遍语音"), j = app.indexOf("words = words.filter(w => String(w == null");
  assert.ok(i > j && j > 0, "要排在拆泡、清空泡之后");
  assert.match(app, /ttsHasSoundTag\(w\) \? \(_inlineVoice\.push\(\{ t: w\.trim\(\), sent: false \}\), VOICE_SLOT_TOKEN\(_inlineVoice\.length - 1\)\) : w/);
});
