// 群友 Nyx 2026-10-08：拉黑后，角色主动发消息时不显示感叹号
const assert = require("assert"), fs = require("fs");
const A = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const i = A.indexOf("const pChat = (id, u) => setChats(p => {"), j = A.indexOf('saveJSON("x_chat:" + id, n);', i);
assert.ok(i > 0 && j > i, "抠不出 pChat");
const body = A.slice(i, j);
assert.match(body, /const _bk = blocksRef\.current && blocksRef\.current\[id\];/);
assert.match(body, /_bk && _bk\.iBlocked && n\.length > pl\.length/);
assert.match(body, /m\.role === "assistant" && m\.kind !== "system" && !m\.blocked \? \{ \.\.\.m, blocked: true \}/);
console.log("block mark ok");
