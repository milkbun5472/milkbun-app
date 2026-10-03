const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const st = fs.readFileSync(__dirname + "/../js/study.js", "utf8");
test("fourth study mode: she teaches, character learns", () => {
  assert.match(st, /\["tb", "我来教"\]/);
  assert.match(st, /tb: \{ accent: "#a0694a"/);
  assert.match(st, /const K_TB = "x_studyTeachBack"/);
  assert.match(st, /先为你设想 3 个初学这门课的人【最常见、最真实】的误解/);
  assert.match(st, /"fixed\\":\[/, "回合输出里要有被纠正的编号");
  assert.match(st, /if \(hit\.length\) \{ setFlash\(hit\)/, "挖出一个当场亮");
  assert.match(st, /让系统出题/); assert.match(st, /用我出的题/);
  assert.match(st, /还没挖出来的——/);
  assert.match(st, /out\.unshift\(\{ role: "user", content: "（上课了）" \}\)/);
});
