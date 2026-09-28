// 转盘选项上限 8 → 24（她 2026-09-28）；选项多时字顺着扇面转、左半边翻正；首尾两块不撞色
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
assert.match(src, /const WHEEL_MAX = 24;/);
assert.match(src, /\.filter\(Boolean\)\.slice\(0, WHEEL_MAX\)/);
assert.ok(!/\.filter\(Boolean\)\.slice\(0, 8\)/.test(src), "老的 8 个上限不许留着");
const turn = new Function(src.slice(src.indexOf("function wheelLabelTurn("), src.indexOf("\n", src.indexOf("function wheelLabelTurn("))) + "\nreturn wheelLabelTurn;")();
for (let n = 9; n <= 24; n++) for (let i = 0; i < n; i++) { const a = turn(i, n); assert.ok(a >= -90 && a <= 90, "字不许倒着：" + n + "/" + i + " → " + a); }
assert.match(src, /\(i === n - 1 && n > 1 && \(n - 1\) % WHEEL_COLORS\.length === 0\) \? 3/);
console.log("wheel ok");
