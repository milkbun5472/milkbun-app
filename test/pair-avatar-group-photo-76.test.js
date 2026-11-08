const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
// 她 2026-11-08：「有两个人就判定把两个人分开切，并且能让两个人的脸入镜头像」——他看图框两张脸，app 照框取
test("情头一张图：他框两张脸，照框取方块；没框或框坏了才按形状对半切", () => {
  assert.match(app, /splitPairImage\(_pairSplit\.imageRef, parsed\.pairAvatar\.faces\)/);
  const src = app.slice(app.indexOf("const faceBoxes = "), app.indexOf("const splitPairImage = "));
  const faceBoxes = new Function(src + "; return faceBoxes;")();
  assert.deepEqual(faceBoxes([[0.1, 0.2, 0.2, 0.2], [0.6, 0.25, 0.2, 0.2]]), [[0.1, 0.2, 0.2, 0.2], [0.6, 0.25, 0.2, 0.2]]);
  assert.equal(faceBoxes([[0.1, 0.2, 0.2, 0.2]]), null);
  assert.equal(faceBoxes([[0.1, 0.2, 0, 0.2], [0.6, 0.25, 0.2, 0.2]]), null);
  assert.doesNotMatch(app, /const up = wide && sh > s/);
});
