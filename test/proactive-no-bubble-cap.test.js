// 她 2026-10-07：「为啥主动消息都是 一条自己在干啥 一条问我怎么样了」
// 两个根：主动开口那几段卡死了「1~2 条」；想念那层替TA想好了「她在干嘛／她去哪了」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const D = fs.readFileSync(path.join(__dirname, "..", "js", "dongnian.js"), "utf8");
test("主动开口不再限条数", () => {
  const i = A.indexOf("const bdayHint = opts.bday");
  const j = A.indexOf("const proactiveHintAll =", i);
  assert.ok(i > 0 && j > i);
  assert.ok(!/[1-3]~[2-5] 条/.test(A.slice(i, j)), "主动那几段里还有条数");
});
test("想念那层只摆事实", () => {
  assert.ok(D.indexOf("开始在想${p.subjectPronoun}在干嘛") < 0);
  assert.ok(D.indexOf("${p.subjectPronoun}去哪了？") < 0);
});
