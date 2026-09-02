const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const components = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

const bag = new Map();
global.localStorage = {
  getItem: key => bag.has(key) ? bag.get(key) : null,
  setItem: (key, value) => bag.set(key, String(value)),
  removeItem: key => bag.delete(key)
};
const Rooms = require("../js/chat-rooms.js");

test.beforeEach(() => bag.clear());

test("side rooms permanently reject real schedule and say so in the prompt", () => {
  const room = Rooms.create("p1", "十七岁的他", "alternate");
  room.cognition.schedule = true; // simulate an old saved room from before the rule changed
  const saved = Rooms.save("p1", room);
  assert.equal(saved.cognition.schedule, false);
  assert.equal(Rooms.GROUPS.cognition.some(([key]) => key === "schedule"), false);
  assert.match(Rooms.prompt(saved, []), /不读取现实时间、定位或日程/);
});

test("room offline uses the room chat key and never writes its session into the main offline key", () => {
  assert.match(app, /const activeOfflineScopeKey = offlineChar[\s\S]*ChatRooms\.chatKey\(offlineChar\.id, offlineRoomId\)/);
  assert.match(app, /saveJSON\("x_offline:" \+ scopeKey, next\)/);
  assert.match(app, /onStart: opts => startOffline\(activeOfflineScopeKey, opts\)/);
  assert.match(app, /onOffline: \(\) => openOffline\(activeChar, window\.ChatRooms/);
});

test("room thought has its own durable store and side-room replies skip personality growth", () => {
  assert.match(app, /saveJSON\("x_roomStates", statesNext\)/);
  assert.match(app, /saveJSON\("x_roomStateHist", histNext\)/);
  assert.match(app, /if \(sideRoom\) \{\s*setRoomThought\(chatKey, parsed\.thought/);
  assert.match(app, /if \(!sideRoom && !opts\.proactive && !contMode\) observeRelationshipBShadow/);
  assert.match(app, /if \(!sideRoom\) window\.DesireDriveShadow/);
  assert.match(app, /if \(offlineIsRoom\(scopeKey\)\) return; \/\/ 侧房线下只留本房记录/);
});

test("room offline receives the room prompt while real-time UI strips are hidden", () => {
  assert.match(engine, /ctx\.roomPrompt \? "\\n" \+ ctx\.roomPrompt/);
  assert.match(components, /\(!room \|\| room\.main\) && schedNow/);
  assert.match(app, /schedNow: offlineIsRoom\(activeOfflineScopeKey\) \? null/);
  assert.match(components, /room\.name \+ " · 独立线下"/);
});

test("opening the state card inside a room selects the room-local heart voice", () => {
  assert.match(app, /setStateCardRoomKey\(window\.ChatRooms && window\.ChatRooms\.isSideKey\(k\) \? k : null\)/);
  assert.match(app, /state: roomCard \? \(roomStates\[stateCardRoomKey\] \|\| null\)/);
  assert.match(components, /roomName \+ " · 心声只留在本房"/);
});
