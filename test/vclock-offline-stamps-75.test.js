// 群友 2026-10-14：线下的时间显示也要跟虚拟时间同步，现在还是真实时间
const assert = require("node:assert/strict");
const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
assert.match(c, /fmtStamp\(m\.ts, clockId !== undefined \? clockId : \(char \? char\.id : undefined\)\)/);
assert.match(c, /clockId: group && group\.id \? "g:" \+ group\.id : undefined/);
assert.match(c, /const fmtT = ts => \{ const d = new Date\(typeof vclockMap === "function" && character \? vclockMap\(ts \|\| Date\.now\(\), character\.id\)/);
assert.match(c, /const fmtT = ts => \{ const d = new Date\(typeof vclockMap === "function" && group && group\.id \? vclockMap\(ts \|\| Date\.now\(\), "g:" \+ group\.id\)/);
console.log("ok");
