// TA嘴上说换了头像，说法五花八门（她 2026-10-02：「为啥有时候又不行」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const a = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("换成X了／改好了／用上了 都认得；没说换的不认", () => {
  const m = a.match(/const AVATAR_CLAIM_RE = (\/.*\/);/);
  assert.ok(m);
  const re = new Function("return " + m[1])();
  ["换成蓝鲨鱼了", "头像改好了", "用上了", "已经设好", "换好了"].forEach(x => assert.ok(re.test(x), x));
  ["好啊等下换", "我不换", "换头像？"].forEach(x => assert.ok(!re.test(x), x));
});
test("情头那两张在给TA看的历史里标上第 1／第 2 张，不让TA猜", () => {
  assert.match(a, /const _pairNo = m =>/);
  assert.match(a, /qpfx \+ _pairNo\(m\) \+ "【对方发来的真实照片/);
  assert.match(a, /已经标着【情头·第 1 张】【情头·第 2 张】/);
});
