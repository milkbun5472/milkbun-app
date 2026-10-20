// 群友 2026-10-20：回复了朋友圈评论区里的配角（不是角色），只有发帖人接话——那人不在「可能回复的人」里
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
assert.match(app, /const _rtName = replyTo \? momentWho\(replyTo\) : "";\n    if \(_rtName && !roster\.includes\(_rtName\) && _rtName !== meName0 && \(mom\.comments \|\| \[\]\)\.some\(c => c && momentWho\(c\.author\) === _rtName\)\) roster = \[_rtName, \.\.\.roster\];/);
console.log("ok");
