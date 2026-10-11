// 发朋友圈能挑面具（她 2026-10-11）：记在 m.mask；没挑谁可以看时，跟她用同一张面具聊的人刷得到；署那张面具
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const cmp = fs.readFileSync(require.resolve("../js/components.js"), "utf8");
test("谁刷得到：按这条的面具认，不再只认主面具", () => {
  assert.match(app, /maskKeyOf\(charId\) === String\(m\.mask \|\| ""\)/);
  assert.match(app, /mask: mask && mask !== maskPrimary && \(masks \|\| \[\]\)\.some\(m => m && m\.id === mask\) \? mask : undefined,/);
  assert.match(app, /if \(mom && mom\.mine && mom\.mask\)/);
  assert.match(app, /const meName = mom\.mask \? momentMeName\(mom\) : userName\(profile\);/);
});
test("发的那页有一排面具；那条动态署面具的名字和头像", () => {
  assert.match(cmp, /"data-wk": "momask"/);
  assert.match(cmp, /mask: mask \|\| undefined/);
  assert.match(cmp, /const authorName = isMine \? \(momMask \? momMask\.name : profile\.name \|\| "我"\)/);
});
