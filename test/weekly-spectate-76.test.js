// 她 2026-10-24：一个月没跟她聊的角色，周刊专访把旁观群里另一个角色说的话当成她
const assert = require("node:assert/strict"), fs = require("fs");
const wk = fs.readFileSync("js/weekly.js", "utf8"), imp = fs.readFileSync("js/impression-core.js", "utf8");
assert.match(wk, /const groupTag = function \(g\) \{ const st = gset\[g\.id\] \|\| \{\}; return \(g\.roomKind === "spectate" \|\| st\.spectate\) \? "·" \+ uName \+ "不在场" : ""; \};/);
assert.match(wk, /const line = "【" \+ g\.name \+ groupTag\(g\) \+ "】" \+ who/);
assert.match(wk, /"【" \+ g\.name \+ "·线下" \+ groupTag\(g\) \+ "】"/);
assert.match(imp, /if \(g\.roomKind === "spectate" \|\| \(gset\[g\.id\] \|\| \{\}\)\.spectate\) return;/);
// 真跑一遍 weekMaterial：旁观群里那两句都标着她不在场
const store = { x_groupSettings: { g1: { memoryInterop: true, spectate: true } }, "x_gchat:g1": [{ role: "assistant", senderName: "阿北", content: "亚麻布我先靠墙放", ts: 1000 }] };
const a = wk.indexOf("  function weekMaterial"), b = wk.indexOf("\n  }\n", a) + 4;
const fn = new Function("loadJSON", "inWin", "cleanMsg", "messageTime", "vt", "window", wk.slice(a, b) + ";return weekMaterial;")(k => store[k] || [], () => true, m => m.content, m => m.ts, t => new Date(t), {});
const mat = fn({}, [{ id: "c1", name: "小南" }, { id: "c2", name: "阿北" }], [{ id: "g1", name: "两人间", memberIds: ["c1", "c2"] }], "Lisa");
assert.ok(mat.perChar.c1.some(r => r.line === "【两人间·Lisa不在场】阿北：亚麻布我先靠墙放"), JSON.stringify(mat.perChar.c1));
console.log("ok");
