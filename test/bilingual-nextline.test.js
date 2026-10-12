const test = require("node:test"); const assert = require("node:assert");
const src = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const a = src.indexOf("function joinBilingualLines("), b = src.indexOf("\n}\n", a) + 2;
const join = new Function(src.slice(a, b) + "; return joinBilingualLines;")();
test("外语一行、中译另起一行：接成一条", () => {
  assert.deepEqual(join(["Ты уже спишь?", "你睡了吗?", "Мне немного одиноко.", "我有点难熬"], false),
    ["Ты уже спишь? | 你睡了吗?", "Мне немного одиноко. | 我有点难熬"]);
  assert.deepEqual(join(["今日は寒いね", "今天好冷啊"], false), ["今日は寒いね | 今天好冷啊"]);
});
test("不乱接：两句中文、已带竖线的、外语后面跟外语的都不动", () => {
  assert.deepEqual(join(["你好", "我也好"], false), ["你好", "我也好"]);
  assert.deepEqual(join(["Hi | 嗨", "你好"], false), ["Hi | 嗨", "你好"]);
  assert.deepEqual(join(["Hi", "How are you"], false), ["Hi", "How are you"]);
  assert.deepEqual(join(["OK", "那我先走了 bye"], false), ["OK", "那我先走了 bye"]);
});

const c = src.indexOf("function looksAlternatingBilingual("), d = src.indexOf("\n}\n", c) + 2;
const alt = new Function(src.slice(c, d) + "; return looksAlternatingBilingual;")();
test("双语没开时：通篇一句外语一句中文才认", () => {
  assert.equal(alt(["Ты уже спишь?", "你睡了吗?", "Мне немного одиноко.", "我有点难熬"]), true);
  assert.equal(alt(["Привет", "Как дела?", "你好"]), false);
  assert.equal(alt(["Hi", "你好"]), false);
});
