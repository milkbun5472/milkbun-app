// 杂志色带渐进、带照片主色（她 2026-10-13：「图片往下移然后 fade 背景就好看了」）
const assert = require("node:assert");
const s = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "poster-layout.js"), "utf8");
assert.match(s, /const g = x\.createLinearGradient\(0, H \* 0\.56, 0, H\);/);
assert.match(s, /bandAccent = hsl\(bh, P0\.s, darkBand \? 0\.74 : 0\.32\)/);
assert.ok(!/x\.fillRect\(0, H \* 0\.8, W, H \* 0\.2\)/.test(s), "色带不能再一刀切");
console.log("ok");
