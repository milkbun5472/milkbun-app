const fs = require("fs"), assert = require("assert");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const i = app.indexOf("const summarizeChatRoom = async"), seg = app.slice(i, i + 4000);
// 群友 2026-11-27：小房间演过去的事，带回主聊天时 TA 当成现在的事
assert(/const pastOn = !!\(room\.writeback && room\.writeback\.pastMemory\)/.test(seg), "认房间的「以前的事」开关");
assert(/const summary = pastTag \+ body;/.test(seg), "带回主聊天的交接贴上「以前的事」");
console.log("ok room-past-handoff");
