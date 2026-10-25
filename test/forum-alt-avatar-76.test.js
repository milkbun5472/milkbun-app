// 群友 2026-10-24：c 的小号头像怎么换——小号主页和帖子里用同一个种子（@id），换 @id 就换头像
const assert = require("node:assert/strict"), fs = require("fs");
const ui = fs.readFileSync("js/screens-ui.js", "utf8"), man = fs.readFileSync("js/assistant-manual.js", "utf8");
assert.match(ui, /h\(AltAvatar,\{seed:displayHandle\|\|meta\.altAvatarSeed,size:62\}\)/);
assert.match(man, /小号头像不能自己上传/);
console.log("ok");
