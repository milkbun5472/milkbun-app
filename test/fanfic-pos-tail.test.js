// 左右位放在提示词最后再念一遍（群里 2026-10-18：gl 同人文上下位总是反）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "../js/fanfic.js"), "utf8");
const a = s.indexOf("function posTail("), b = s.indexOf("function cpBlock(");
const posTail = new Function(s.slice(a, b) + "; return posTail;")();
test("两个人：先点的是左位、主导", () => {
  const t = posTail([{ name: "甲" }, { name: "乙" }], {});
  assert.match(t, /「甲」是左位、主导，「乙」是右位、承受/);
});
test("群像、无 CP、没挑人：一个字不发", () => {
  assert.equal(posTail([{ name: "a" }, { name: "b" }, { name: "c" }], {}), "");
  assert.equal(posTail([{ name: "a" }, { name: "b" }], { noCP: true }), "");
  assert.equal(posTail([], {}), "");
});
test("新写、续写、补完三条路都接在 system 最后", () => {
  assert.equal((s.match(/sys \+ posTail\(cpChars, /g) || []).length, 3);
});
