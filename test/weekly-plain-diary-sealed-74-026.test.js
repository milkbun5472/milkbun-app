// 周刊讲人话 + 日记不收封闭群（她 2026-09-24）
const fs = require("fs"), assert = require("assert");
const wk = fs.readFileSync(__dirname + "/../js/weekly.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
// 1. 一句判据，三处共用（单版 / 整批 / 采访人）
assert.match(wk, /const PLAIN_CORE =/);
assert.match(wk, /voice\.world \+ PLAIN_CORE \+/, "单版没接");
assert.match(wk, /\+ specs \+ PLAIN_CORE \+/, "整批没接");
assert.match(wk, /"【这一版的腔调】\\n" \+ voice\.world \+ PLAIN_CORE/, "采访人没接");
assert.ok(!/绝不直呼角色本名/.test(wk), "维多利亚那条还在教它把人藏起来");
// 2. 日记：封闭群的群聊、群线下都不进
const d = app.indexOf("diaryGroupOfflines = {}"); assert.ok(d > 0);
assert.match(app.slice(d, d + 800), /const memberGroups = \(groups \|\| \[\]\)\.filter\(g => \(g\.memberIds \|\| \[\]\)\.includes\(charId\) && !groupClosed\(g\.id\)\)/);
console.log("ok weekly-plain-diary-sealed");
