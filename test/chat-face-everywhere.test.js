// 她 2026-10-02：状态卡跟着聊天头像走；群里成员也用单聊那张；群可以设头像
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
test("状态卡用聊天头像", () => { assert.match(app, /character: chatFace\(scc\),/); });
test("群里成员头像用 chatAvatar", () => { assert.match(comp, /return c && c\.chatAvatar \? \{ \.\.\.c, avatarImage: c\.chatAvatar \} : c;/); });
test("群头像能设、能存、列表里显示", () => {
  assert.match(comp, /name: gName, avatarImage: gAvatar,/);
  assert.match(app, /updateGroup\(activeGroup\.id, \{ avatarImage: gAvNew \|\| null \}\)/);
  assert.equal((comp.match(/g\.avatarImage \? h\(Avatar, \{ character: \{ name: g\.name, avatarImage: g\.avatarImage \}/g) || []).length, 2);
});
