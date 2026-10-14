// 她 2026-10-14：群聊我改不了自己的头像——单聊有「我在这儿的头像」，群没有
const assert = require("node:assert/strict");
const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
assert.match(c, /avatarImage: gsp\.myAvatar \|\| \(profile && profile\.avatarImage\)/);
assert.match(c, /"data-wk": "gmyavatar"/);
assert.match(c, /myAvatar: gMyAv \|\| "",/);
console.log("ok");
