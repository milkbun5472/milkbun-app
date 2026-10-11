// 线下「穿什么 · 我换」：我的衣柜挂了几套却显示空（群友 2026-10-11）——
// 我的衣柜顶上就是 { closet }，TA的随身物是 { outfit:{ closet } }；closetSetsOf 读 .outfit，得包一层再递
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("node:fs").readFileSync(require.resolve("../js/app.js"), "utf8");
test("线下穿什么里我那一份读得到我的衣柜", () => {
  assert.match(app, /me: \{ sets: closetSetsOf\(\{ outfit: myClosetRef\.current \}\), now: sceneMeOutfit\(scope\) \}/);
  assert.doesNotMatch(app, /closetSetsOf\(myClosetRef\.current\)/);
});
test("照相馆配衣服那一行查款式时认得衣柜盒子", () => {
  assert.match(app, /Array\.isArray\(groups\) \? groups : \(groups && Array\.isArray\(groups\.closet\) \? groups\.closet : \[\]\)/);
});
