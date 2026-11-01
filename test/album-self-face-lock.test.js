// 查手机相册：TA自己露脸的照片画出来要锁TA的脸（群友 2026-10-31）
require("node:test")("露脸 + 有参考照 → 走自拍那条锁脸的路", () => {
  const assert = require("node:assert/strict");
  const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /const faceShot = !her && !!char\.refPhoto && \/脸\|眼\|嘴\|唇/);
  assert.match(app, /const pRefs = her \? her\.refs : faceShot \? \[char\.refPhoto\] : null;/);
  assert.match(app, /faceShot \? buildPhotoPrompt\(char, scene, \(statesRef\.current \|\| \{\}\)\[char\.id\] \|\| \{\}, \{ kind: "selfie"/);
});
