// 页面一直开着、站子慢：不说「切了后台」，写「还在等站子」，15 分钟才算没等回来（群友 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("拍照中：这一趟开 App 后才开始拍的照旧等，开 App 前开始的才算断了", () => {
  assert.match(c, /const PHOTO_PAGE_BOOT = Date\.now\(\);/);
  assert.match(c, /const live = since && since >= PHOTO_PAGE_BOOT;/);
  assert.match(c, /"还在等站子（已经 " \+ Math\.round\(\(Date\.now\(\) - since\) \/ 60000\) \+ " 分钟）/);
  assert.ok(!/可能切了后台断线/.test(c));
});
