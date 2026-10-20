// 她 2026-10-20：侧房里有新消息，聊天列表里这个人也要顶上来（原来只看主房和线下）
const assert = require("node:assert/strict");
const c = require("fs").readFileSync(require("path").join(__dirname, "../js/components.js"), "utf8");
const a = c.indexOf("  const roomLast = {};"), b = c.indexOf("  const chatItems = [", a);
const build = new Function("chats", c.slice(a, b) + "; return roomLast;");
const rl = build({ "1": [{ ts: 5 }], "1::room::r1": [{ ts: 9, content: "x" }], "1::room::r2": [{ ts: 7 }], "2::room::r": [] });
assert.equal(rl["1"].ts, 9);
assert.equal(rl["2"], undefined);
assert.match(c, /const rl = roomLast\[String\(c\.id\)\]; const last = rl && \(!mainLast \|\| \(rl\.ts \|\| 0\) > \(mainLast\.ts \|\| 0\)\) \? rl : mainLast;/);
console.log("ok");
