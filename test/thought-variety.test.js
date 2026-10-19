const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("不把最近几条心声摆给TA对照（10-04、10-18 两回都照着学，撤了）", () => {
  assert.doesNotMatch(eng, /function thoughtVarietyBlock/);
  assert.doesNotMatch(app, /recentThoughts/);
});
test("心声定义：此刻心里没说出口的那一句；不写「嘴上」「对照」（会被照抄成句式）", () => {
  const TM = (eng.match(/const THOUGHT_MEANING = "([^"]+)";/) || [])[1];
  assert.ok(TM);
  assert.match(TM, /没说出口的那一句/);
  assert.match(TM, /没说出口的那一句/);
  assert.match(TM, /不用落到接下来要做什么/);
  assert.doesNotMatch(TM, /嘴上|对照/);
  assert.doesNotMatch(TM, /打算做什么|落点在他自己身上/);
});
