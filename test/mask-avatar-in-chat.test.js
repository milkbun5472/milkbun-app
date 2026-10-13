const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("单聊、线下里「我」的头像跟着这个角色认的那张面具", () => {
  assert.ok(app.includes("meProfile: profileFor(activeChar.id),"));
  // 线下：这个聊天单独换了「我」的头像（myChatAvatar）就用它，名字等其余仍是这个角色认的那张面具
  assert.match(app, /profile: offlineChar\.myChatAvatar \? \{ \.\.\.profileFor\(offlineChar\.id\), avatarImage: offlineChar\.myChatAvatar \} : profileFor\(offlineChar\.id\),/);
  assert.ok(comp.includes("const _me = meProfile || profile;"));
});
