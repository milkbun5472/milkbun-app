const test = require("node:test");
const assert = require("node:assert/strict");

const bag = new Map();
global.localStorage = {
  getItem: key => bag.has(key) ? bag.get(key) : null,
  setItem: (key, value) => bag.set(key, String(value)),
  removeItem: key => bag.delete(key)
};
const Rooms = require("../js/chat-rooms.js");

test.beforeEach(() => { bag.clear(); delete global.window; });

test("main chat and every side room use independent history keys", () => {
  const side = Rooms.create("p1", "只聊这件事", "focused");
  assert.equal(Rooms.chatKey("p1", "main"), "p1");
  assert.equal(Rooms.chatKey("p1", side.id), `p1::room::${side.id}`);
  assert.equal(Rooms.personFromKey(Rooms.chatKey("p1", side.id)), "p1");
});

test("app restart hydrates the saved main and side-room histories", () => {
  const side = Rooms.create("p1", "十七岁的他", "alternate");
  const sideKey = Rooms.chatKey("p1", side.id);
  bag.set("x_chat:p1", JSON.stringify([{ role: "user", content: "主房还在" }]));
  bag.set("x_chat:" + sideKey, JSON.stringify([{ role: "user", content: "侧房也还在" }]));

  const load = (key, fallback) => {
    const raw = bag.get(key);
    return raw == null ? fallback : JSON.parse(raw);
  };
  const chats = Rooms.hydrateChats([{ id: "p1" }], load);

  assert.equal(chats.p1[0].content, "主房还在");
  assert.equal(chats[sideKey][0].content, "侧房也还在");
  assert.deepEqual(Object.keys(chats).sort(), ["p1", sideKey].sort());
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
  assert.equal(Rooms.prompt(Rooms.get("p1", "main"), []), "");
  const side = Rooms.create("p1", "侧房", "everyday");
  assert.match(Rooms.prompt(side, []), /本房可提议的活动/);
  side.actions.study = false;
  side.actions.games = false;
  assert.doesNotMatch(Rooms.prompt(side, []), /本房可提议的活动/);
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

test("side-room summaries return only to the matching person's main prompt", () => {
  Rooms.addSummary({ personId: "p1", roomId: "r1", roomName: "梦里", frame: "这是你做的一场梦：", summary: "我们在雪地走了一圈。" });
  assert.match(Rooms.prompt(Rooms.get("p1", "main"), []), /我们在雪地走了一圈/);
  assert.doesNotMatch(Rooms.prompt(Rooms.get("p2", "main"), []), /我们在雪地走了一圈/);
});

// v65.02 起课还认房间：roomId 是 study.js 建课时戳的（没戳＝主线）。
// 所以这间房要看见自己那门课，桩里就得戳上这间房的 id——照着写入方写。
test("study-enabled room lists only this character's existing sessions", () => {
  const room = Rooms.create("p1", "补习角", "focused");
  global.window = { Study: { loadSessions: () => [
    { id: "mine", teacher_id: "p1", subject: "日语", updated_at: 20, roomId: room.id },
    { id: "other", teacher_id: "p2", subject: "吉他", updated_at: 30, roomId: room.id },
    { id: "mainline", teacher_id: "p1", subject: "主线那门", updated_at: 40 }
  ] } };
  const prompt = Rooms.prompt(room, []);
  assert.match(prompt, /sessionId=mine/);
  assert.doesNotMatch(prompt, /sessionId=other/);
  assert.doesNotMatch(prompt, /sessionId=mainline/);   // 主线的课不串进侧房
});
