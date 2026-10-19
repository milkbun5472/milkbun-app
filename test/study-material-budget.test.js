// 她 2026-10-20：群友「一起学里他看资料看不全」——每轮给的资料从 6000 字放大到 25000
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "study.js"), "utf8");
assert.match(src, /const MAT_BUDGET = 25000, MAT_CHUNK = 700;/);
console.log("ok");
