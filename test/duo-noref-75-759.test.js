// 图像站开了「这个站不锁脸」，合照不再要求两张参考照（群友 2026-10-15）
const test = require("node:test");
const assert = require("node:assert");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
test("合照能不能拍只问 duoFacesOk 一处，不锁脸时放行", () => {
  assert.match(app, /const duoFacesOk = char => !!\(char && \(\(char\.refPhoto && \(meOf\(char\.id\) \|\| \{\}\)\.refPhoto\) \|\| imgSiteNoRef\(\)\)\);/);
  assert.match(app, /const offlinePhotoCanDuo = char => duoFacesOk\(char\);/);
  assert.match(app, /const canDuo = canSelfieImg \? duoFacesOk\(char\) : true;/);
  assert.match(app, /!\(typeof loadImgApi === "function" && loadImgApi\(\)\.noRef\)\) \{ toast\("合照要你俩都设了参考照/);
  assert.match(app, /if \(!char \|\| !duoFacesOk\(char\)\) return drawFromDesc/);
  assert.match(app, /const gDuoMembers = imgSiteNoRef\(\) \? gFaceMembers\.slice\(\)/);
});
