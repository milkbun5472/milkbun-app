// 她 2026-09-23：「从一起学也能选择开房间，就跟微光庭院一样」——一起学默认开着，别的建房时自己拨。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const study = fs.readFileSync(__dirname + "/../js/study.js", "utf8");
const Rooms = require("../js/chat-rooms.js");

test("庭院和一起学开房走同一条 openPresetRoomFor", () => {
  assert.match(app, /const openGardenRoomFor = charId => openPresetRoomFor\(charId, "garden"/);
  assert.match(app, /onNewRoom: charId => openPresetRoomFor\(charId, "focused"/);
  assert.equal((app.match(/roomPresetIntentRef\.current = [^"]/g) || []).length, 1, "开房意图只许立在一处");
});

test("一起做件事那个预设默认开着一起学", () => {
  assert.equal(Rooms.PRESETS.focused.actions.study, true);
});

test("一起学首页有开间房，挑了人就交给外壳", () => {
  assert.match(study, /setRoomPickOpen\(false\); props\.onNewRoom\(c\.id\);/);
  assert.match(study, /h\(CenterCard, \{ onClose/);
});
