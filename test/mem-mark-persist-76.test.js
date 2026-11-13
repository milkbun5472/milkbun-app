const test = require("node:test"); const assert = require("node:assert");
const A = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("自动记忆的书签存下来，重开不归零（单聊、线下、房间）", () => {
  assert.ok(!/memExtractMarkRef|memExtractMarkOffRef|roomExtractMarkRef/.test(A));
  assert.match(A, /const memMarkSet = [\s\S]{0,300}saveJSON\("x_memExtractCtr"/);
  for (const k of ["chat", "off", "room"]) { assert.match(A, new RegExp('memMarkGet\\("' + k + '"')); assert.match(A, new RegExp('memMarkSet\\("' + k + '"')); }
});
