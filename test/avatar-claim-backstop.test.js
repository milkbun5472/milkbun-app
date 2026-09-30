const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("自起意往回看 20 条；嘴上说换了、字段没填 → 兜底照换", () => {
  assert.match(app, /const AUTO_AVATAR_LOOKBACK = 20;/);
  assert.ok(app.includes("freshPhotoIn(chatsRef.current[charId] || [], AUTO_AVATAR_LOOKBACK)"));
  assert.ok(app.includes("AVATAR_CLAIM_RE.test([].concat(parsed.word || []).join(\" \"))) applyPhotoSeen(charId, _avatarMsg, { avatar: true }, true"));
  const re = /换好了|换上了|已经换了|头像换了|换成头像了|设成头像了|当头像了|换过来了/;
  assert.ok(re.test("好啦已经换了") && !re.test("我不想换"));
});
