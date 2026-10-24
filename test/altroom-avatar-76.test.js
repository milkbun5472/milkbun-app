// 她 2026-10-24（群友问「c 的小号头像怎么换」）：小号房间里他的小号、她自己写的小号都能挑头像；不挑就按小号网名画，不跟大号同一张
const assert = require("node:assert/strict"), fs = require("fs");
const cr = fs.readFileSync("js/chat-rooms.js", "utf8"), cp = fs.readFileSync("js/components.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
assert.match(cr, /\.\.\.\(typeof ta\.avatar === "string" && ta\.avatar \? \{ avatar: ta\.avatar\.slice\(0, 600000\) \} : \{\}\)/);
assert.match(cr, /avatar: a\.ta\.avatar \|\| \(typeof autoAvatarSrc === "function" \? autoAvatarSrc\("altroom:" \+ name\) : ""\)/);
assert.match(app, /avatarImage: f\.avatar \|\| "", chatAvatar: "" \}/);
assert.equal((cp.match(/"data-wk": "altavatar"/g) || []).length, 2);
assert.match(cp, /onPick: img => setAlt\(\{ ta: \{ \.\.\.ta, avatar: img \} \}\)/);
assert.match(cp, /onPick: img => setAlt\(\{ mask: \{ \.\.\.\(a\.mask \|\| \{\}\), avatarImage: img \} \}\)/);
console.log("ok");
