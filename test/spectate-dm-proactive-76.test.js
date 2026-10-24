// 她 2026-10-24：关了主动发消息的角色，在她旁观的群里聊着聊着私聊她了——她不在的群，私聊她＝主动找她
const assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
assert.match(app, /const gDmToHerOk = c => imInGroup\(group\) \|\| autoRefreshOn\("proactive", c\.id\);/);
assert.match(app, /theyBlocked\)\) && gDmToHerOk\(c\)\)/);
assert.match(app, /if \(gDmList\.length && spk && !gDmToHerOk\(spk\)\) gDmList = \[\];/);
assert.match(app, /const gcm = item\.call && spk && gDmToHerOk\(spk\) && /);
console.log("ok");
