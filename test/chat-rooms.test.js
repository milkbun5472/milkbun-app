const test = require("node:test");
const assert = require("node:assert/strict");

const bag = new Map();
global.localStorage = {
  getItem: key => bag.has(key) ? bag.get(key) : null,
  setItem: (key, value) => bag.set(key, String(value)),
  removeItem: key => bag.delete(key)
};
const Rooms = require("../js/chat-rooms.js");

test.beforeEach(() => bag.clear());

test("main chat and every side room use independent history keys", () => {
  const side = Rooms.create("p1", "只聊这件事", "focused");
  assert.equal(Rooms.chatKey("p1", "main"), "p1");
  assert.equal(Rooms.chatKey("p1", side.id), `p1::room::${side.id}`);
  assert.equal(Rooms.personFromKey(Rooms.chatKey("p1", side.id)), "p1");
});

test("three permission groups persist independently, including main chat actions", () => {
  const main = Rooms.get("p1", "main");
  main.actions.study = false;
  main.cognition.formalMemory = false;
  main.writeback.sharedState = true;
  Rooms.save("p1", main);
  const again = Rooms.get("p1", "main");
  assert.equal(again.actions.study, false);
  assert.equal(again.cognition.formalMemory, false);
  assert.equal(again.writeback.sharedState, true);
  assert.equal(Rooms.list("p1")[0].actions.study, false);
});

test("room action switches expose only explicit extras", () => {
  assert.deepEqual(Rooms.GROUPS.actions.map(([key]) => key), ["study", "games"]);
  const side = Rooms.create("p1", "侧房", "everyday");
  assert.match(Rooms.prompt(side, []), /侧房不触发朋友圈、论坛、钱包或日记/);
});

test("isolated preset keeps only its own history and receives no main delta", () => {
  const room = Rooms.create("p1", "秘密角落", "isolated");
  const prompt = Rooms.prompt(room, [{ role: "user", content: "主房后来发生的事", ts: Date.now() + 10 }]);
  assert.equal(room.syncMode, "frozen");
  assert.equal(room.writeback.roomHistory, true);
  assert.equal(room.writeback.memoryCandidate, false);
  assert.equal(room.writeback.sharedState, false);
  assert.doesNotMatch(prompt, /主房后来发生的事｜只作参考/);
});

test("follow room can receive only newer main-room delta", () => {
  const room = Rooms.create("p1", "厨房", "everyday");
  room.mainCursorTs = 200;
  const prompt = Rooms.prompt(room, [
    { role: "user", content: "旧话", ts: 100 },
    { role: "assistant", content: "新话", ts: 300 }
  ]);
  assert.doesNotMatch(prompt, /旧话/);
  assert.match(prompt, /新话/);
});

test("person rooms never leak into another person's room list", () => {
  Rooms.create("p1", "甲的房", "everyday");
  Rooms.create("p2", "乙的房", "focused");
  assert.deepEqual(Rooms.list("p1").map(r => r.name), ["主聊天", "甲的房"]);
  assert.deepEqual(Rooms.list("p2").map(r => r.name), ["主聊天", "乙的房"]);
});
