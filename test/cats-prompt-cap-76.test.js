// 她 2026-10-30 转群友：混元生图「提示词过长，最多支持 2500 个字符（当前 3302 个）」——照报错里的上限截短重发一次
const test = require("node:test");
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
test("CatsAPI 400 报字数上限：截到上限以内、在句子边界断、只重发一次", () => {
  assert.match(eng, /if \(!response\.ok && response\.status === 400\) \{/);
  assert.match(eng, /\/最多支持\\s\*\(\\d\+\)\\s\*个字符\//);
  assert.match(eng, /const lim = Number\(cap\) - 20;/);
  assert.match(eng, /if \(k > lim \* 0\.6\) cut = cut\.slice\(0, k \+ 1\);/);
  assert.match(eng, /parsed\.detail\) \|\| parsed\.message/, "报错原文认得 detail 那一格");
  const i = eng.indexOf("if (!response.ok && response.status === 400) {");
  const seg = eng.slice(i, eng.indexOf("if (!response.ok) {", i));
  assert.equal((seg.match(/await request\(endpoint/g) || []).length, 1, "只重发一次");
});
