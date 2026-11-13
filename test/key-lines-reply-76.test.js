const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const E = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const i = E.indexOf("function parseKeyLines"), j = E.indexOf("function parseJSONLoose");
const parseKeyLines = new Function(E.slice(i, j) + "; return parseKeyLines;")();
const K = ["word", "mood", "thought", "action"];
test("一行一个字段的回复按字段名拆回来", () => {
  const r = parseKeyLines('word:\n- 我说的是你啊\n- 伦敦的雨偶尔也会停\nmood: {"label":"温柔"}\nthought: 她刚才叫我「星」。\naction: 我靠在客厅沙发上', K, ["word"]);
  assert.deepStrictEqual(r.word, ["我说的是你啊", "伦敦的雨偶尔也会停"]);
  assert.deepStrictEqual(r.mood, { label: "温柔" });
  assert.equal(r.thought, "她刚才叫我「星」。"); assert.equal(r.action, "我靠在客厅沙发上");
});
test("挤成一行的列表也拆", () => {
  const r = parseKeyLines("word: - 一句 - 两句\nthought: 想", K, ["word"]);
  assert.deepStrictEqual(r.word, ["一句", "两句"]);
});
test("普通一句话不当成字段", () => {
  assert.equal(parseKeyLines("我说的是你啊，伦敦的雨偶尔也会停", K, ["word"]), null);
  assert.equal(parseKeyLines("word: 只有一格", K, ["word"]), null);
});
test("聊天接进来了", () => {
  assert.match(fs.readFileSync(__dirname + "/../js/app.js", "utf8"), /parseKeyLines\(raw, \["word", "mood", "thought", "action"/);
});
