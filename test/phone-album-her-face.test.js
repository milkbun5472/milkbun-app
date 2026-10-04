const test = require("node:test");
const assert = require("node:assert");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("phone album photo of her locks her face; both → duo", () => {
  assert.match(app, /const albumHerShot = \(char, scene, again\) => \{/);
  assert.match(app, /refs: both \? \[char\.refPhoto, profile\.refPhoto\] : \[profile\.refPhoto\]/);
  assert.match(app, /const her = albumHerShot\(char, scene, again\);/);
  assert.match(app, /const out = await generateSelfieImage\(pFinal, pRefs, \{\}\);/);
});
test("recognises her by nickname / common pet names; tells her when she has no ref photo", () => {
  assert.match(app, /宝宝\|宝贝\|老婆\|媳妇\|女朋友/);
  assert.match(app, /但你还没传自己的参考照/);
});
