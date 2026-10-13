// 线下也跟聊天头像走（群友 2026-10-13）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
test("线下的他用 chatFace，我用 myChatAvatar", () => {
  assert.match(app, /char: chatFace\(offlineChar\),/);
  assert.match(app, /offlineChar\.myChatAvatar \? \{ \.\.\.profileFor\(offlineChar\.id\), avatarImage: offlineChar\.myChatAvatar \}/);
});
