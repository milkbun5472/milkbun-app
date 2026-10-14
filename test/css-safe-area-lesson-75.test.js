// 群友 2026-10-14：顶栏 padding 写死把刘海安全区抹了、顶栏钻进状态栏，秋秋不会修——秋秋和「复制给别的AI」都要知道这条
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const a = fs.readFileSync(path.join(__dirname, "..", "js", "assistant.js"), "utf8"), ts = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
assert.match(a, /padding-top: calc\(var\(--app-safe-top\) \+ 6px\) !important/);
assert.match(a, /顶栏太高／跟时间叠了/);
assert.match(ts, /"7\. 顶栏（chathead）和底栏（composer）自带刘海／底部横条的安全区/);
console.log("ok");
assert.match(a, /top: calc\(50% \+ var\(--app-safe-top\) \/ 2\) !important/);
