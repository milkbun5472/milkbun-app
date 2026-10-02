// 她 2026-10-02 转群友：照片描述里有上游敏感词，能改描述再重拍
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");
test("照片长按有编辑，存下就照新描述重拍（单聊、群聊）", () => {
  assert.match(comp, /\["edit", "reshoot", "reroll"\]/);
  assert.match(app, /drawChatSelfie\(\{ chatKey: threadKey, charId: activeChar\.id, sid: m\.sid, photoKind: m\.photoKind, photoScene: nv/);
  assert.match(app, /drawGroupSelfie\(\{ groupId, spk, gsid: m\.sid, gPhotoKind: m\.photoKind, gPhotoScene: nv/);
});
