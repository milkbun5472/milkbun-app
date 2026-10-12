const test = require("node:test"); const assert = require("node:assert");
const src = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const a = src.indexOf("function joinBilingualLines("), b = src.indexOf("\n}\n", a) + 2;
const join = new Function(src.slice(a, b) + "; return joinBilingualLines;")();
const join2 = (l, h) => join(l, h, { pairNext: true });
test("外语一行、中译另起一行：接成一条", () => {
  assert.deepEqual(join2(["Ты уже спишь?", "你睡了吗?", "Мне немного одиноко.", "我有点难熬"], false),
    ["Ты уже спишь? | 你睡了吗?", "Мне немного одиноко. | 我有点难熬"]);
  assert.deepEqual(join2(["今日は寒いね", "今天好冷啊"], false), ["今日は寒いね | 今天好冷啊"]);
});
test("不乱接：两句中文、已带竖线的、外语后面跟外语的都不动", () => {
  assert.deepEqual(join(["Ты уже спишь?", "你睡了吗?"], false), ["Ты уже спишь?", "你睡了吗?"]);   // 没开双语：不接
  assert.deepEqual(join2(["你好", "我也好"], false), ["你好", "我也好"]);
  assert.deepEqual(join2(["Hi | 嗨", "你好"], false), ["Hi | 嗨", "你好"]);
  assert.deepEqual(join2(["Hi", "How are you"], false), ["Hi", "How are you"]);
  assert.deepEqual(join2(["OK", "那我先走了 bye"], false), ["OK", "那我先走了 bye"]);
});

const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("双语开关没开：不合、不补（她不想要这个功能）", () => {
  assert.doesNotMatch(app, /_foreignTalker|looksAlternatingBilingual/);
  assert.match(app, /const _yueFill = _bilingualOn && typeof translateToZh === "function"/);
});
test("单聊只在开着双语时让下一行中文接回去", () => {
  assert.match(app, /joinBilingualLines\(words, hanLangOf\(char\), \{ pairNext: _bilingualOn \}\)/);
});
