const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const i = app.indexOf("const splitSayLine = str => {");
const seg = app.slice(i, app.indexOf("\n      const callTurnId", i));
const splitSayLine = new Function("stripName", seg + "\nreturn splitSayLine;")(x => String(x || "").trim());
test("通话里颜文字跟着话走，不当动作", () => {
  assert.deepEqual(splitSayLine("(ᵔᴥᵔ)"), [{ speech: "(ᵔᴥᵔ)" }]);
  assert.deepEqual(splitSayLine("好呀(｡•̀ᴗ-)✧"), [{ speech: "好呀(｡•̀ᴗ-)✧" }]);
});
test("真动作照旧拆出来", () => {
  assert.deepEqual(splitSayLine("（揉了揉眼睛）醒了"), [{ act: "揉了揉眼睛" }, { speech: "醒了" }]);
});
// 她 2026-10-18 截图：引号里的括号是原话，不拎出去当动作
test("引号里的括号跟着话走", () => {
  assert.deepEqual(splitSayLine("……『あたまわるい（褒め言葉）』にしといたから"), [{ speech: "……『あたまわるい（褒め言葉）』にしといたから" }]);
  assert.deepEqual(splitSayLine("（笑）他说「我（真的）没事」"), [{ act: "笑" }, { speech: "他说「我（真的）没事」" }]);
});
test("声音标签跟着话走，不当动作", () => {
  global.TTS_MARK_TAG_RE = /\(\s*(?:sighs|chuckle|breath)\s*\)/gi;
  assert.deepEqual(splitSayLine("(sighs) 好吧"), [{ speech: "(sighs) 好吧" }]);
  delete global.TTS_MARK_TAG_RE;
});
