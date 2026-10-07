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
