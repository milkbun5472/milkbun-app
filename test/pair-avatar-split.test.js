// 一张图里的一对情头（她 2026-10-25「我发一张图然后他一分为二换成情头」）：要情头、往回只有一张 → 当一对，他挑哪半，切开两半照一对换
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
test("要情头却只有一张时，把那一张当一对", () => {
  assert.match(app, /const _pairSplit = _pairAsked && !_pairPick \? \(freshUserPhoto\(charId\) \|\| freshPhotoIn\(/);
  assert.match(app, /左右并排的：左半边是第 1 张、右半边是第 2 张；上下排的：上半是第 1 张、下半是第 2 张/);
  assert.match(app, /【情头·这一张就是一对】/);
  assert.match(app, /const _myAvatarAsked = !_pairPick && !_pairSplit && /);
});
test("他填了 yours 才切，切完照一对换（同一个 applyPairAvatar，没另写一份）", () => {
  assert.match(app, /const _halves = await splitPairImage\(_pairSplit\.imageRef\);\n\s+if \(_halves && applyPairAvatar\(charId, \[\{ imageRef: _halves\[0\] \}, \{ imageRef: _halves\[1\] \}\], parsed\.pairAvatar\.yours\)/);
  const seg = app.slice(app.indexOf("const splitPairImage"), app.indexOf("// 一对里他挑一张自己用"));
  assert.match(seg, /wide = W >= H/); assert.match(seg, /imgToVault/);
});
