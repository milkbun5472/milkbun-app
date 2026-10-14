// 她 2026-10-14：反复出现的词把动描也算进去了；专访回答不像他本人说话
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "weekly.js"), "utf8");
eval(src.match(/function saidOnly[\s\S]*?\n  }\n/)[0]);
assert.equal(saidOnly("（他抬眼看你）嗯。*低头*行吧【旁白】(笑)"), "嗯。 行吧");
assert.match(src, /const pure = saidOnly\(txt\)/);
assert.match(src, /return saidOnly\(l\.slice\(l\.lastIndexOf\(pre\)/);
assert.match(src, /\.slice\(-24\);/);
assert.match(src, /不要因为是「接受采访」就变得完整、礼貌、有条理/);
// 原来那个 spokenOnly（朗读、摘金句用）不许被同名覆盖
assert.equal((src.match(/function spokenOnly\(/g) || []).length, 1);
console.log("ok");
