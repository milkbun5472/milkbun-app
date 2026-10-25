// 她 2026-10-25：点开红包有一张能拆的大红封（照微信那样），单聊、群里都走它
const assert = require("node:assert/strict"), fs = require("fs");
const cp = fs.readFileSync("js/components.js", "utf8"), html = fs.readFileSync("index.html", "utf8");
assert.match(cp, /function RedPacketEnvelope\(\{ who, whoChar, message, canOpen, onOpen, amountText, status, claims, total, count, meName, onClose \}\)/);
assert.match(cp, /onClick: selMode \? \(\) => toggleSel\(i\) : \(\) => setRpEnv\(i\) \}\)/);
assert.match(cp, /onOpen: async \(\) => \{ onRespondTransfer\(m\.tid, true\); return amt; \}/);
assert.match(cp, /onOpen: async \(\) => \{ const r = onClaim\(rpView\); return typeof r === "number" \? "¥" \+ r : null; \}/);
assert.match(html, /@keyframes rpflip/);
for (const k of ["rpenvelope", "rpopenbtn", "rpamount", "rpclose"]) assert.match(cp, new RegExp('"data-wk": "' + k + '"'));
console.log("ok");
