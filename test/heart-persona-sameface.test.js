const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/heart.js", "utf8");
const ms = src.slice(src.indexOf("function mellowSpec"), src.indexOf("function applyMellow"));
test("长成那一枪看得到已经长出来的自我，同一面不再叠一条", () => {
  assert.match(ms, /const persNow = \(box\.persona \|\| \[\]\)\.map/);
  assert.match(ms, /【TA 已经长出来的自我（之前亲笔写下的）】/);
  assert.match(ms, /persona 就填 null——念想照样长成、小诗照样写/);
});
test("persona 填 null 时念想照样长成（applyMellow 只认 id）", () => {
  const ap = src.slice(src.indexOf("function applyMellow"), src.indexOf("function solsticeSpec"));
  assert.match(ap, /if \(g && g\.id\) \{/);
  assert.match(ap, /if \(pText\) box\.persona = /);
  assert.match(ap, /\.replace\(\/\^null\$\/i, ""\)/);
});
