const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const grab = n => { const i = eng.indexOf("function " + n + "("); let d = 0; for (let k = eng.indexOf("{", i); k < eng.length; k++) { if (eng[k] === "{") d++; else if (eng[k] === "}" && !--d) return eng.slice(i, k + 1); } };
const { cutLoop, splitBilingualMany } = new Function(grab("cutLoop") + grab("splitBilingualMany") + "; return { cutLoop, splitBilingualMany };")();
test("一段里好几对 原文|中文 也劈得开（论坛帖子）", () => {
  const r = splitBilingualMany("도장 찍으라고 버텨도 무죄임? ——|就算按头盖章也算无罪吧? ——비행기 표 샀는데 ——|我买了机票");
  assert.equal(r.text, "도장 찍으라고 버텨도 무죄임?\n비행기 표 샀는데");
  assert.equal(r.zh, "就算按头盖章也算无罪吧?\n我买了机票");
});
test("对不上就不劈；日文不劈", () => {
  assert.equal(splitBilingualMany("hello|你好|还是中文"), null);
  assert.equal(splitBilingualMany("今日は|今天|明日は|明天"), null);
});
test("卡进循环的那一串收成三遍", () => {
  const s = "听说他出来了，冷，冷，" + "脚，".repeat(60) + "就这样";
  const out = cutLoop(s);
  assert.ok(out.length < 40, out);
  assert.match(out, /脚，脚，脚…… *，?就这样/);
  assert.equal(cutLoop("哈哈哈哈哈哈哈哈，笑死我了，真的好好笑啊啊啊啊"), "哈哈哈哈哈哈哈哈，笑死我了，真的好好笑啊啊啊啊");
});
