// 朋友圈头像跑到动态中间（她 2026-09-26）：点头像开主页的那颗按钮被撑满整条高度。头像要贴顶、跟名字齐平
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
assert.match(src, /onOpenProfile\(c\.id\), className: "shrink-0 self-start active:opacity-70"/);
assert.match(src, /className: "px-5 py-4 flex items-start gap-3"/);
console.log("moments avatar top ok");
