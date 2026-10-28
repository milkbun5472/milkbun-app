// 群里 2026-10-28「自己聊天框这边换了头像角色知道吗」
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("换了我在这儿的头像：灰字 + 等她开口时告诉他，新的那张附上给他看", () => {
  assert.ok(app.includes('if ((s.myChatAvatar || null) !== (activeChar.myChatAvatar || null)) {'));
  assert.ok(app.includes('waitForHer(activeChar.id, { herAvatar: {'), "走等她开口那一份，不当场抢话");
  assert.ok(app.includes('const avatarHint = opts.herAvatar ?'));
  assert.ok(app.includes('g[_i] = { ...g[_i], _imageRefs: [...(g[_i]._imageRefs || []), _av] };'));
});
