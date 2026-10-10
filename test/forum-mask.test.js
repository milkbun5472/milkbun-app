// 论坛按面具发（她 2026-10-09）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const S = fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8");

test("帖、楼、楼中楼都记面具；只有同一张面具的角色认得出", () => {
  assert.match(A, /const forumKnows = \(charId, x\) => String\(\(x && x\.mask\) \|\| ""\) === maskKeyOf\(charId\);/);
  assert.match(A, /const myPub = p => [^\n]*&& forumKnows\(char\.id, p\);/);
  assert.match(A, /const asMe = x => [^\n]*&& forumKnows\(char\.id, x\);/);
  assert.match(A, /\.\.\.\(maskB \? \{ mask: maskB \} : \{\}\)/);
  assert.equal((A.match(/\.\.\.myMaskTag\(post\)/g) || []).length, 2, "开楼、楼中楼都记");
  assert.match(A, /meRule \+ \(meOwn \? forumMaskNote\(post, poolChars\) : ""\)/);
  assert.match(S, /"data-wk": "forummaskrow"/);
});
