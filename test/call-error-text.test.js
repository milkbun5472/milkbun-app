// 群友 2026-10-20：调用记录一排「Error」——站子回的报错没带 message 时抛的是空错。
const test = require("node:test");
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "../js/engine.js"), "utf8");
test("站子报错没 message：带上 msg／字符串／整段 JSON", () => {
  assert.equal((eng.match(/throw new Error\(d\.error\.message\);/g) || []).length, 0);
  assert.ok((eng.match(/throw new Error\(d\.error\.message \|\| d\.error\.msg \|\| \(typeof d\.error === "string" \? d\.error : "站子报错：" \+ JSON\.stringify\(d\.error\)\.slice\(0, 300\)\)\);/g) || []).length >= 5);
});
test("还是空的：记录里说清是哪种失败、去哪儿查", () => {
  assert.match(eng, /"站子打回来了，没附原因（"/);
});
