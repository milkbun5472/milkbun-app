// 群友 2026-10-14：一起读正文字体能换成系统字体
const assert = require("node:assert/strict");
const r = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "read.js"), "utf8");
assert.match(r, /"data-wk": "readfont"/);
assert.match(r, /props\.onPatch\(\{ font: o\[0\] \}\)/);
assert.match(r, /fontFamily: book\.font === "system" \? "-apple-system/);
console.log("ok");
