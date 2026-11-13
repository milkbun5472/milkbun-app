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
test("word 后面是数组、中间夹着表情", () => {
  const raw = 'word: [\n  "晃荡",\n  "连人带身子全被你盖戳了",\n  {"emote":"害羞炸毛"},\n  "等我下课过去当面跟你核对合同条款"\n]\nmood: {"label":"得意"}';
  const r = parseKeyLines(raw, K.concat(["emote"]), ["word"]);
  assert.deepStrictEqual(r.word, ["晃荡", "连人带身子全被你盖戳了", "等我下课过去当面跟你核对合同条款"]);
  assert.equal(r.emote, "害羞炸毛");
  const bad = 'word: [\n  "一句",\n  "两句"\n  "三句",\n]\nthought: 想';
  assert.deepStrictEqual(parseKeyLines(bad, K, ["word"]).word, ["一句", "两句", "三句"]);
});
