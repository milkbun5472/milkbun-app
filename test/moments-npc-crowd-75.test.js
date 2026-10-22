// 配角也来朋友圈（她 2026-10-13：「让配角参与感高一点吧」）
const assert = require("node:assert");
const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
assert.match(app, /const npcCrowd = \(hosts, max\) =>/);
assert.match(app, /const canSee = \[\.\.\.canSeeMain, \.\.\.npcCrowd\(canSeeMain, 3\)(, \.\.\.myNpcCrowd\(2\))?\];/);   // 2026-10-22 她自己身边的配角也来
assert.match(app, /\.\.\.npcCrowd\(\[author, \.\.\.others\.slice\(0, 4\)\], 4\)/);
assert.match(app, /\.slice\(0, 5\)\.concat\(npcCrowd\(canSee, 4\)(, myNpcCrowd\(2\))?\)/);
console.log("ok");
