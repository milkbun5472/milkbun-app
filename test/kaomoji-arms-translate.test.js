// 她 2026-10-26 截图：「我又不是不能委屈一下(っ˘︶˘)っ」挂了译键——括号剥掉后，外面那只「っ」还被当成日文。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.resolve(__dirname, "..", "js/engine.js"), "utf8");
const a = src.indexOf("function _transStrip("), b = src.indexOf("function translatableLangLong");
const T = new Function(src.slice(a, b) + "\nreturn translatableLang;")();

test("颜文字括号外的手不算日文", () => {
  assert.equal(T("我又不是不能委屈一下(っ˘︶˘)っ"), "");
  assert.equal(T("(っ˘з(˘⌣˘ )"), "");
});

test("真日文照旧认得出", () => {
  assert.equal(T("今夜も残業"), "日文");
  assert.equal(T("明日は雨か"), "日文");
  assert.equal(T("おはよう"), "日文");
});
