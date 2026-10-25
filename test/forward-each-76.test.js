// 她 2026-10-25 转群友：「像微信一样可以选逐条转发」
const assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8"), cp = fs.readFileSync("js/components.js", "utf8");
assert.equal((cp.match(/const \[fwdMode, setFwdMode\] = useState\("merge"\)/g) || []).length, 2, "单聊、群聊都有");
assert.equal((cp.match(/"data-wk": "fwdmode"/g) || []).length, 2);
assert.match(cp, /onForward\(picked, destination, fwdMode\)/);
assert.match(app, /const forwardEachTo = async \(msgs, destination, senderName\) =>/);   // 2026-10-26：他拍的照片要先读出来再转，改成 async
assert.match(app, /const fwdImageRef = async m =>/);
assert.equal((app.match(/if \(mode === "each"\) \{ forwardEachTo\(msgs, destination\); return; \}/g) || []).length, 2);
console.log("ok");
