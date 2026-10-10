const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("情头那一轮填成单张那格：认出是第几张，照一对补齐（她那张也换）", () => {
  const i = app.indexOf("const _pairDone = "), seg = app.slice(i, i + 1600);
  assert.match(seg, /if \(!_pairDone && _pairPick && _avatarMsg && parsed\.photoSeen && typeof parsed\.photoSeen === "object" && parsed\.photoSeen\.avatar === true\) \{/);
  assert.match(seg, /applyPairAvatar\(charId, _pairPick, _k \+ 1\)\) parsed\.photoSeen = \{ \.\.\.parsed\.photoSeen, avatar: false \}/, "补成一对后别再让单张那格把他那张换一遍");
  assert.ok(seg.indexOf("_pairPick.findIndex") < seg.indexOf("applyPhotoSeen(charId, _avatarMsg"), "要排在单张落地之前");
});
