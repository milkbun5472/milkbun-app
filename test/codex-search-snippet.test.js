// 攻略搜索（她 2026-10-25：「攻略搜索能不能也做关键词匹配」）：直接摆出提到这个词的那几句，点一下跳到那一节
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cx = fs.readFileSync(path.join(__dirname, "../js/codex.js"), "utf8");

test("几个词都得沾上；一句凑不齐时只认最具体的那个词；长段只截那一小句", () => {
  assert.match(cx, /const words = qq\.split\(\/\\s\+\/\)\.filter\(Boolean\);/);
  assert.match(cx, /const allIn = str => words\.every\(/);
  assert.match(cx, /const key = words\.slice\(\)\.sort\(\(x, y\) => y\.length - x\.length\)\[0\];/);
  assert.match(cx, /const need = all\.some\(full\) \? full : /);
  // 不用后行断言（老一点的 iOS 不认，整页会白）
  assert.ok(!/\(\?<=/.test(cx), "又用了后行断言");
});

test("搜的时候摆结果列表代替目录；点一下跳到那一节；挂点登记", () => {
  assert.match(cx, /words\.length && hits\.length \? h\("div", \{ "data-wk": "cxhits"/);
  assert.match(cx, /onClick: \(\) => onJump\(\{ app: x\.app\.id, id: x\.e\.id \}\)/);
  const ts = fs.readFileSync(path.join(__dirname, "../js/theme-studio.js"), "utf8");
  ["cxhits", "cxhit", "cxhitwhere", "cxhitline", "cxmark"].forEach(k => assert.match(ts, new RegExp('\\["' + k + '", "'), k + " 没登记"));
});
