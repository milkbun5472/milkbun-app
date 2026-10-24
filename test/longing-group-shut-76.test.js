// 群友 2026-10-24：「这个群聊条满了，他从来没主动在群里发过消息——是因为关了群聊自动聊天吗」——是；卡上要写出来
const assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8"), cp = fs.readFileSync("js/components.js", "utf8");
assert.match(app, /shut: !gs0\.memoryInterop \|\| gs0\.autoChat === false \|\| !autoRefreshOn\("groupChat"\)/);
assert.match(app, /if \(!gs\.memoryInterop \|\| gs\.autoChat === false \|\| !autoRefreshOn\("groupChat"\)\) continue;/, "卡上的判断跟真正放行那道闸一致");
assert.match(cp, /r\.shut \? "没开自己聊" : /);
console.log("ok");
