const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadRooms() {
  const data = new Map();
  const sandbox = {
    window: {}, console,
    localStorage: {
      getItem: key => data.has(key) ? data.get(key) : null,
      setItem: (key, value) => data.set(key, String(value))
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync("js/chat-rooms.js", "utf8"), sandbox);
  return sandbox.ChatRooms;
}

test("带入型房间清除后只保留进门开场，并重置房内进度", () => {
  const Rooms = loadRooms();
  const room = Rooms.normalize({
    id: "room_seeded", personId: "p1", name: "雨夜",
    scenario: "仍在那场争吵里", startFrom: { mode: "recent", sourceRoomName: "主聊天", seedCount: 2 },
    selfDigest: "后来又聊了很多", selfSummedCount: 57, summaryCursorTs: 999
  }, "p1");
  const messages = [
    { id: "s1", role: "user", content: "旧一", ts: 10, forkSeed: true },
    { id: "s2", role: "assistant", content: "旧二", ts: 20, forkSeed: true },
    { id: "n1", role: "user", content: "新一", ts: 30 },
    { id: "n2", role: "assistant", content: "新二", ts: 40 }
  ];
  const kept = Rooms.messagesAfterClear(room, messages);
  const reset = Rooms.resetAfterClear(room, kept);
  assert.deepEqual(Array.from(kept, m => m.id), ["s1", "s2"]);
  assert.equal(reset.summaryCursorTs, 20);
  assert.equal(reset.selfDigest, "");
  assert.equal(reset.selfSummedCount, 0);
  assert.equal(reset.startFrom.mode, "recent");
  assert.equal(reset.scenario, "仍在那场争吵里");
});

test("空白房清除全部记录", () => {
  const Rooms = loadRooms();
  const room = Rooms.normalize({ id: "room_blank", personId: "p1", name: "空房" }, "p1");
  assert.deepEqual(Array.from(Rooms.messagesAfterClear(room, [{ content: "新聊天" }])), []);
});

test("带入原话不参与房内自动浓缩额度", () => {
  const Rooms = loadRooms();
  const room = Rooms.normalize({ id: "room_count", personId: "p1" }, "p1");
  const seeds = Array.from({ length: 20 }, (_, i) => ({ content: "旧" + i, forkSeed: true }));
  const newRows = Array.from({ length: 49 }, (_, i) => ({ content: "新" + i }));
  assert.equal(Rooms.digestDue(room, [...seeds, ...newRows]), null);
  const due = Rooms.digestDue(room, [...seeds, ...newRows, { content: "第50条" }]);
  assert.equal(due.upto, 35);
  assert.equal(due.slice.length, 35);
});

test("清除入口同时覆盖线上、线下和房内心声", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  const components = fs.readFileSync("js/components.js", "utf8");
  assert.match(app, /commitJSONDurable\("x_chat:" \+ key, kept\)/);
  assert.match(app, /commitJSONDurable\("x_offline:" \+ key, \[\]\)/);
  assert.match(app, /delete next\[key\]; roomStatesRef\.current = next/);
  assert.match(app, /delete next\[key\]; roomStateHistRef\.current = next/);
  assert.equal((app.match(/onClearRoom: clearChatRoomRecords/g) || []).length, 2);
  assert.match(components, /清除这间房的记录/);
  assert.match(components, /进门时带来的聊天和开场方式会保留/);
});
