const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
test("自修缺终稿用首稿、缺首稿用终稿，不再整轮报「没有完成终稿自修」", () => {
  assert.doesNotMatch(eng, /throw new Error\("模型没有完成单次响应内的终稿自修/);
  assert.match(eng, /parsed\.draftScene \|\| parsed\.scene \|\| ""/);
  assert.match(eng, /parsed\.scene \|\| parsed\.draftScene \|\| ""/);
  assert.match(eng, /const mDraft = bare\.match\(\/"draftScene"/, "截断的 JSON 里把首稿抠出来");
});
