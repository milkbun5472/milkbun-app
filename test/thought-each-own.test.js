const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("心声：自己的腔调、挂在这一轮；几个人同轮各想各的，群线上/群线下/群通话都发到", () => {
  assert.match(eng, /const THOUGHT_MEANING = "[^"]*自己平时的腔调[^"]*这一轮/);
  assert.match(eng, /const THOUGHT_EACH_OWN = /);
  assert.match(eng, /sameNameNote\(members\) \+ "\\nthought 的写法：" \+ THOUGHT_MEANING/, "群线下（beat 和小说两种）");
  assert.ok((app.match(/THOUGHT_EACH_OWN/g) || []).length >= 4, "群线上 + 群通话");
});
