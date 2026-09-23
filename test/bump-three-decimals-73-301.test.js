// 版本号改成第三位小数加一（她 2026-09-23：「以后更新能不能改成小数点后第三位加一？不会出错吧？」）。
// 演练里旧脚本把 73.301 直接加成了 74.00——这里把那一跳钉死。
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../scripts/bump-version.mjs", "utf8");
const numSrc = src.match(/const num = v => \{[^\n]*\};/)[0];
const bumpSrc = src.slice(src.indexOf("const bumped = () => {"), src.indexOf("\n};", src.indexOf("const bumped = () => {")) + 3);
const next = top => { const [maj, mi] = top.split("."); return new Function("maj", "mi", bumpSrc + "\nreturn bumped();")(maj, mi); };
const num = new Function(numSrc + "\nreturn num;")();
assert.strictEqual(next("73.30"), "73.301", "两位的旧号先补成三位再加一");
assert.strictEqual(next("73.301"), "73.302");
assert.strictEqual(next("73.309"), "73.310");
assert.strictEqual(next("73.999"), "74.000");
assert.strictEqual(next("74.000"), "74.001");
// 按小数比大小：73.301 > 73.30，73.31(=73.310) > 73.301，73.99 > 73.301
assert(num("73.301") > num("73.30"));
assert(num("73.31") > num("73.301"));
assert(num("73.99") > num("73.301"));
assert(num("74.000") > num("73.999"));
console.log("bump-three-decimals ok");
