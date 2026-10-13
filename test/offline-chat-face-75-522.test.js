// 线下也跟聊天头像走（群友 2026-10-13）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
test("线下的他用 chatFace，我用 myChatAvatar", () => {
  assert.match(app, /char: chatFace\(offlineChar\),/);
  assert.match(app, /offlineChar\.myChatAvatar \? \{ \.\.\.profileFor\(offlineChar\.id\), avatarImage: offlineChar\.myChatAvatar \}/);
});
test("一起学/读/看/听、陪伴、番茄钟也认聊天那张脸", () => {
  assert.match(app, /const liveFaces = liveChars\.map\(chatFace\);/);
  ["StudyApp", "ReadTogether", "WatchTogether", "Companion", "Pomodoro", "ListenTogether"].forEach(n => {
    const i = app.indexOf("body = h(" + n + ", {");
    assert.ok(i > 0, n);
    const next = app.indexOf("body = h(", i + 10);
    assert.ok(app.slice(i, next).includes("characters: liveFaces,"), n);
  });
});
test("朋友圈和朋友圈主页也认聊天那张脸", () => {
  const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
  assert.match(comp, /const characters = \(rawCharacters \|\| \[\]\)\.map\(chatFace\);/);
  assert.match(comp, /const character = chatFace\(rawCharacter\), characters = \(rawCharacters \|\| \[\]\)\.map\(chatFace\);/);
});
test("档案里换了头像，聊天里另设的那张就让开", () => {
  const scr = fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8");
  assert.match(scr, /onPick: img => \{ setAvatarImage\(img\); if \(chatAvatarOn\) setChatAvatarOn\(false\); \}/);
});
