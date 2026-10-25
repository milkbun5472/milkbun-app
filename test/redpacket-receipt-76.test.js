// 群友 2026-10-25：红包被领后显示成转账单，改转账样式连红包一起变；查找记录里红包被算进转账
const assert = require("node:assert/strict"), fs = require("fs");
const cp = fs.readFileSync("js/components.js", "utf8");
assert.match(cp, /if \(m\.receipt && m\.receipt\.amount != null && m\.receipt\.packet\) \{/);
assert.match(cp, /"data-wk": "rpreceipt"/);
assert.match(cp, /typeF === "redpacket" \? \(m\.kind === "redpacket" \|\| \(m\.kind === "transfer" && !!m\.packet\)\)/);
assert.match(cp, /typeF === "transfer" \? \(m\.kind === "transfer" && !m\.packet\)/);
assert.match(cp, /m\.kind === "transfer" && m\.packet \? "🧧红包"/);
assert.match(cp, /"data-packet": m\.packet \? "1" : "0"/);
console.log("ok");
