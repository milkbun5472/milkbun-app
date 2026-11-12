const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("同一张照片只问一次换不换头像（她开口要的照旧）", () => {
  assert.match(app, /const _seenAvatarOk = !!\(_avatarMsg && \(_askAvatar \|\| \(avatarCoolOk\(charId\) && !_avatarMsg\.avAsked && _avDice\(_avatarMsg\)\)\)\) && !_myAvatarPick;/);
  assert.match(app, /\(m => m && !m\.avAsked \? m : null\)\(freshPhotoIn\(chatsRef\.current\[charId\] \|\| \[\], AUTO_AVATAR_LOOKBACK\)\)/);
  assert.match(app, /if \(_avatarMsg && _seenAvatarOk && !_askAvatar\) \{[^}]*avAsked: true/);
});
test("没开口时掷骰子：一张照片固定一个结果，大约四分之一", () => {
  const i = app.indexOf("const _avDice = m =>"); const line = app.slice(i, app.indexOf("\n", i));
  const AVATAR_AUTO_PCT = 25; const f = new Function("AVATAR_AUTO_PCT", line + "; return _avDice;")(AVATAR_AUTO_PCT);
  let n = 0; for (let k = 0; k < 400; k++) if (f({ imageRef: "iv_" + k * 7919 })) n++;
  assert.ok(n > 60 && n < 140, String(n));
  assert.equal(f({ imageRef: "iv_x" }), f({ imageRef: "iv_x" }));
});
