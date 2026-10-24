// 她 2026-10-24 截图：擂台上齐周那一格只剩「……」——缺人就整轮再要一次，字段名多认几个
const assert = require("node:assert/strict"), fs = require("fs");
const d = fs.readFileSync("js/debate.js", "utf8");
assert.match(d, /const sayOf = x => x \? String\(x\.say \|\| x\.text \|\| x\.content \|\| x\.speech \|\| x\["发言"\] \|\| ""\)\.trim\(\) : "";/);
assert.match(d, /if \(missing\(p\)\) \{ try \{ const p2 = extractJSON\(await ask\(\)\)/);
assert.match(d, /const text = sayOf\(hit\) \|\| "……";/);
console.log("ok");
assert.match(d, /\|\| \(J && !callOf\(pp\)\); \};/); assert.match(d, /const call = J \? callOf\(p\) : "";/);
