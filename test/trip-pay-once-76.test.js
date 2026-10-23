// 她 2026-10-23：旅行机票民宿扣了两次——连点两下时 paid 还没落进存档，第二下照样扣
const assert = require("node:assert/strict");
const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
const seg = app.slice(app.indexOf("const tripBookPay = (char, who) =>"), app.indexOf("const tripSetDate ="));
assert.match(seg, /if \(!b \|\| b\.paid \|\| tripPayingRef\.current\[trip\.id\]\) return;\s*tripPayingRef\.current\[trip\.id\] = true;/);
assert.ok(seg.indexOf("tripPayingRef.current[trip.id] = true") < seg.indexOf("walletSpend("), "锁要在扣钱之前上");
console.log("ok");
