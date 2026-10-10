// 粤语开双语（她 2026-10-10 截图）：左边全是汉字也得劈开，右边写简体普通话
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const eng = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const pick = (name, end) => eng.slice(eng.indexOf(name), eng.indexOf(end));
const env = {};
new Function("env", pick("const HAN_LANG_RE", "// 模型把中译另起了一行") + "\nenv.split = splitBilingual; env.han = hanLangOf;")(env);

test("说粤语的人：全汉字的原文也劈开", () => {
  assert.deepEqual(env.split("聽朝記得校閙鐘 | 明早记得调闹钟", true), { text: "聽朝記得校閙鐘", zh: "明早记得调闹钟" });
});
test("不知道是谁时，粤语专用字兜底", () => {
  assert.deepEqual(env.split("早啲休息 | 早点休息"), { text: "早啲休息", zh: "早点休息" });
});
test("普通中文里的竖线照旧不劈", () => {
  assert.equal(env.split("价格 3|5 元"), null);
  assert.equal(env.split("今天好累 | 想睡觉"), null);
});
test("哪些语言算本来就用汉字写的", () => {
  assert.equal(env.han({ lang: "粤语" }), true);
  assert.equal(env.han({ lang: "广东话" }), true);
  assert.equal(env.han({ lang: "日语" }), false);
  assert.equal(env.han({}), false);
});
test("单聊、群聊、通话三处都把这个人的语言带进去；规则要求简体普通话", () => {
  assert.match(app, /splitBilingual\(w, hanLangOf\(char\)\)/);
  assert.match(app, /splitBilingual\(x, hanLangOf\(spk\)\)/);
  assert.match(app, /splitSayLine, hanLangOf\(char\)\)/);
  assert.match(eng, /右边一律写简体、普通话的说法。粤语、上海话这类本来就用汉字写的话也算外语/);
});
