const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("同一张照片只问一次换不换头像（她开口要的照旧）", () => {
  assert.match(app, /const _seenAvatarOk = !!\(_avatarMsg && \(_askAvatar \|\| \(avatarCoolOk\(charId\) && !_avatarMsg\.avAsked\)\)\) && !_myAvatarPick;/);
  assert.match(app, /\(m => m && !m\.avAsked \? m : null\)\(freshPhotoIn\(chatsRef\.current\[charId\] \|\| \[\], AUTO_AVATAR_LOOKBACK\)\)/);
  assert.match(app, /if \(_avatarMsg && _seenAvatarOk && !_askAvatar\) \{[^}]*avAsked: true/);
});
