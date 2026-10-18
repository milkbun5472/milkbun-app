const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("不把最近几条心声摆给TA对照（10-04、10-18 两回都照着学，撤了）", () => {
  assert.doesNotMatch(eng, /function thoughtVarietyBlock/);
  assert.doesNotMatch(app, /recentThoughts/);
});
test("心声定义：问的是没说出口的那部分，拿他刚说出口的对照", () => {
  const TM = (eng.match(/const THOUGHT_MEANING = "([^"]+)";/) || [])[1];
  assert.ok(TM);
  assert.match(TM, /没说出口的那一句/);
  assert.match(TM, /跟他刚才嘴上说的、做出来的对照/);
  assert.doesNotMatch(TM, /打算做什么|落点在他自己身上/);
});
