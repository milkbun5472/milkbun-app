// 她 2026-10-14：群聊我改不了自己的头像——单聊有「我在这儿的头像」，群没有
const assert = require("node:assert/strict");
const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
// 钉「群里我这一格先用群里设的那张、没有才退回资料里的头像」这件事，别钉整行写法
//   （2026-10-29：那行加了 resolveImg 的判断，整行钉着就断）
{ const line = (c.match(/const meAv = \{[^\n]*gsp\.myAvatar[^\n]*/) || [""])[0];
  assert.match(line, /gsp\.myAvatar/, "群里我这一格没先看群里设的那张");
  assert.match(line, /profile && profile\.avatarImage/, "没了「群里没设就用资料里那张」的退路"); }
assert.match(c, /"data-wk": "gmyavatar"/);
assert.match(c, /myAvatar: gMyAv \|\| "",/);
console.log("ok");
