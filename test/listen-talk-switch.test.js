// 群友 2026-10-19：单聊里陪听的人会切歌，一起听歌评区里聊就不会。接上同一个 taSwitchSong。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const sq = fs.readFileSync(path.join(__dirname, "../js/listen-square.js"), "utf8");
test("歌评区：正在放这首、陪听的人在场才给切歌一栏，回来走 taSwitchSong", () => {
  const i = app.indexOf("const replySongTalk"), seg = app.slice(i, i + 3500);
  assert.match(seg, /LQ\(\)\.songKey\(nowSong\) === key/);
  assert.match(seg, /switchBy: partnerSw/);
  assert.match(seg, /await taSwitchSong\(d\.songSwitch\)/);
  assert.match(sq, /o\.switchBy \?/);
});
