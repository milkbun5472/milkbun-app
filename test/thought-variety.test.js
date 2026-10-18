const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("不把最近几条心声摆给TA对照（10-04、10-18 两回都照着学，撤了）", () => {
  assert.doesNotMatch(eng, /function thoughtVarietyBlock/);
  assert.doesNotMatch(app, /recentThoughts/);
});
test("心声定义：四样留着，但不是每句都要交一个打算", () => {
  const TM = (eng.match(/const THOUGHT_MEANING = "([^"]+)";/) || [])[1];
  assert.ok(TM);
  assert.match(TM, /想要的、在意的、藏着的、打算的/);
  assert.match(TM, /不是每句都要落成一个打算/);
});
