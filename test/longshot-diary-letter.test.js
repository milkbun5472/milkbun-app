// 群友 2026-11-27「保存他写的情书或者日记的长图，ios 不好截图」：日记那一篇、情书那一封顶栏都有「存图」；存图那一套搬进常驻的 components.js
const assert = require("node:assert/strict"), fs = require("fs");
const comp = fs.readFileSync("js/components.js", "utf8"), ui = fs.readFileSync("js/screens-ui.js", "utf8"), pu = fs.readFileSync("js/phone-ui.js", "utf8");
for (const f of ["function loadShotLib(", "function phoneShotTarget(", "async function savePhoneScreen(", "function PhoneShotBtn("]) {
  assert.ok(comp.includes(f), "components.js 里有 " + f);
  assert.ok(!pu.includes(f), "phone-ui.js 里不再另有一份 " + f);
}
assert.match(ui, /h\(PhoneShotBtn, \{ color: t\.sub, name: \(\(char \? \(char\.remark \|\| char\.name\) : "我"\) \+ "的日记-"/);
assert.match(ui, /h\(PhoneShotBtn, \{ color: inkA\(0\.55\), name: "情书-"/);
console.log("ok");
