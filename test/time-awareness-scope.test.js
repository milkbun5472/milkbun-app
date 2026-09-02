const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const components = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const rooms = fs.readFileSync(path.join(__dirname, "..", "js", "chat-rooms.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

test("character time awareness overrides the global default with inherit/on/off", () => {
  assert.match(app, /const timeAwareFor = id => \{/);
  assert.match(app, /if \(mode === "on"\) return true/);
  assert.match(app, /if \(mode === "off"\) return false/);
  assert.match(app, /return prefs\.timeAware !== false/);
  assert.match(app, /timeAware: timeAwareFor\(char\.id\)/);
  assert.match(app, /timeAwareMode: \["on", "off"\]\.includes\(s\.timeAwareMode\) \? s\.timeAwareMode : "inherit"/);
  assert.match(components, /\[\["inherit", "跟随全局"\], \["on", "开启"\], \["off", "关闭"\]\]/);
  assert.match(screens, /全局默认值；角色与房间可单独覆盖/);
});

test("room time awareness overrides the character and drives online, offline and schedule UI", () => {
  assert.match(app, /const roomTimeAwareFor = \(room, charId\)/);
  assert.match(app, /const roomClockOn = roomTimeAwareFor\(room, charId\)/);
  assert.match(app, /const roomTimeAware = roomTimeAwareFor\(sideRoom, charId\)/);
  assert.match(app, /if \(!roomTimeAware\) \{ oCtx\.schedNow = ""; oCtx\.geo = null; \}/);
  assert.match(app, /schedNow: roomTimeAwareFor\(window\.ChatRooms \? window\.ChatRooms\.get\(activeChar\.id, activeRoomId\)/);
  assert.match(rooms, /现实时间与行程/);
});

test("group surfaces respect each member's character-level time setting", () => {
  assert.match(app, /memberTimeAware: Object\.fromEntries/);
  assert.match(app, /members\.filter\(c => !c\.npc && timeAwareFor\(c\.id\)\)/);
  assert.match(app, /if \(!timeAwareFor\(c\.id\)\) return "\\n〔时间感知关闭〕/);
  assert.match(app, /!c \|\| c\.npc \|\| !timeAwareFor\(id\)/);
});
