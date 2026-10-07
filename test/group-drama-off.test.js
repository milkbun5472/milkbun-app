const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("修罗场开启那条灰字不再把所有人说成恋人", () => {
  assert.doesNotMatch(app, /其他人也是 " \+ userName\(profile\) \+ " 的恋人/);
  assert.match(app, /群里每个人都知道了大家各自跟 " \+ userName\(profile\) \+ " 是什么关系/);
});
test("关掉修罗场时撤掉那条灰字", () => {
  assert.match(app, /if \(patch && patch\.drama === false && gsFor\(id\)\.drama\) pGChat\(id, p => p\.filter\(m => !\(m && m\.dramaOn\)\)\);/);
});
test("关系照设定来，不把朋友当恋人、不编过去", () => {
  assert.match(app, /【关系照设定来，一个字都别加】/);
});
