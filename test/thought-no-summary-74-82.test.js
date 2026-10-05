// 她 2026-10-05：「我们现在的心声有强调说是他心里想的念头吗 为啥还在总结」→「试试」
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("心声不跟状态栏归进「只记录已经形成的反应」，也不再写「不是……总结」", () => {
  assert.match(app, /mood、action、wearing 与能力字段只记录已经/);
  assert.doesNotMatch(app, /mood、thought、action、wearing 与能力字段只记录/);
  assert.doesNotMatch(app, /互动总结或第三人称旁白/);
  assert.doesNotMatch(app, /你自己的话，不是总结/);
});
