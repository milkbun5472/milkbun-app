// 她 2026-10-02：状态卡跟着聊天头像走；群里成员也用单聊那张；群可以设头像
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
test("状态卡用聊天头像", () => { assert.match(app, /character: chatFace\(scc\),/); });
test("群里成员头像用 chatAvatar", () => { assert.match(comp, /const memberById = id => chatFace\(/); });
// 她 2026-10-05：「消息通知这里头像没更新成聊天里的，又是没做成公共的地方」
test("顶上消息通知、通话也走同一张聊天脸；不许再手写一份", () => {
  assert.match(app, /avatarImage: g\.avatarImage \|\| g\.avatar \|\| "" \} : chatFace\(c\),/, "消息通知还用档案头像");
  assert.match(app, /participants: \(call\.participants \|\| \[\]\)\.map\(chatFace\),/, "通话还用档案头像");
  const all = ["app.js", "components.js", "screens.js", "engine.js"].map(f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8")).join("\n");
  assert.equal((all.match(/chatAvatar \? \{ \.\.\.c, avatarImage/g) || []).length, 0, "又有地方自己手写了一份 chatFace");
});
test("群头像能设、能存、列表里显示", () => {
  assert.match(comp, /name: gName, avatarImage: gAvatar,/);
  assert.match(app, /updateGroup\(activeGroup\.id, \{ avatarImage: gAvNew \|\| null \}\)/);
  assert.equal((comp.match(/g\.avatarImage \? h\(Avatar, \{ character: \{ name: g\.name, avatarImage: g\.avatarImage \}/g) || []).length, 2);
});
