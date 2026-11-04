// 卡面戳戳的话跟着双语走：生成时带「原文 | 中文」，显示走 TransText（她 2026-11-04：韩语没翻译）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
test("生成：开着双语就带 bilingualRule", () => {
  const a = R("app.js"), seg = a.slice(a.indexOf("const stampPoke = async"), a.indexOf("return pokes;", a.indexOf("const stampPoke = async")));
  assert.match(seg, /window\.__charBiOn\(char\.id\) && typeof bilingualRule === "function" \? "\\n" \+ bilingualRule\(char\.name\)/);
  assert.match(seg, /slice\(0, 200\)/);
});
test("显示：走 TransText，念的是原文", () => {
  const s = R("stamps.js");
  assert.match(s, /h\(TransText, \{ text: say\.text, inline: true \}\)/);
  assert.match(s, /splitBilingual\(String\(txt \|\| ""\)\)/);
});
