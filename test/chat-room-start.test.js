const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const bag = new Map();
global.localStorage = {
  getItem: key => bag.has(key) ? bag.get(key) : null,
  setItem: (key, value) => bag.set(key, String(value))
};
global.ChatContextFilter = require("../js/chat-context-filter.js");
const Rooms = require("../js/chat-rooms.js");
const app = fs.readFileSync("js/app.js", "utf8");
const components = fs.readFileSync("js/components.js", "utf8");

const rows = () => Array.from({ length: 25 }, (_, i) => ({
  id: "m" + i,
  role: i % 2 ? "assistant" : "user",
  content: "第 " + i + " 句",
  ts: 100 + i
}));

test.beforeEach(() => bag.clear());

test("空白、最近聊天、截至某句只是同一间房的三种开场", () => {
  const source = Rooms.get("p1", "main");
  const room = Rooms.normalize({ id: "r1", name: "新房", ...Rooms.PRESETS.everyday }, "p1");
  const blank = Rooms.prepareStart("p1", room, source, rows(), "blank", null);
  const recent = Rooms.prepareStart("p1", room, source, rows(), "recent", null);
  const until = Rooms.prepareStart("p1", room, source, rows(), "until", 8);
  assert.equal(blank.room.id, room.id);
  assert.deepEqual(blank.messages, []);
  assert.equal(blank.room.startFrom, null);
  assert.deepEqual(recent.messages.map(m => m.content), rows().slice(-20).map(m => m.content));
  assert.equal(recent.room.startFrom.mode, "recent");
  assert.deepEqual(until.messages.map(m => m.content), rows().slice(0, 9).map(m => m.content));
  assert.equal(until.room.startFrom.mode, "until");
  assert.equal(Rooms.list("p1").length, 1, "只选择开场不应提前创建房间");
});

test("房间类型与开场聊天互不覆盖", () => {
  const source = Rooms.get("p1", "main");
  const alternate = Rooms.normalize({ id: "r2", name: "十七岁", scenario: "他现在十七岁", ...Rooms.PRESETS.alternate, preset: "alternate" }, "p1");
  const prepared = Rooms.prepareStart("p1", alternate, source, rows(), "recent", null);
  assert.equal(prepared.room.preset, "alternate");
  assert.equal(prepared.room.scenario, "他现在十七岁");
  assert.equal(prepared.room.syncMode, "frozen");
  assert.equal(prepared.room.writeback.memoryCandidate, false);
  assert.equal(prepared.messages.length, 20);
  assert.match(Rooms.prompt(prepared.room, []), /进门时带来的聊天/);
});

test("撤回、失败、待生成与系统行不会随开场聊天复活", () => {
  const source = Rooms.get("p1", "main");
  const room = Rooms.normalize({ id: "r3", name: "新房", ...Rooms.PRESETS.everyday }, "p1");
  const messages = [
    { role: "user", content: "撤回", recalled: true },
    { role: "assistant", content: "未完成", pending: true },
    { role: "system", content: "系统行" },
    { role: "assistant", content: "（发送失败：网络断开）" },
    { role: "narration", kind: "narration", content: "雨停了", ts: 10 },
    { role: "user", kind: "photo", desc: "窗外", imageRef: "vault", ts: 11 }
  ];
  const prepared = Rooms.prepareStart("p1", room, source, messages, "recent", null);
  assert.deepEqual(prepared.messages.map(m => m.content), ["雨停了", "窗外"]);
  assert.equal(prepared.messages[0].role, "narration");
  assert.equal(prepared.messages[1].imageRef, undefined);
});

test("历史持久化成功后才创建房门，重开可以装回", async () => {
  const source = Rooms.get("p1", "main");
  const room = Rooms.normalize({ id: "r4", name: "带聊天的房", ...Rooms.PRESETS.focused }, "p1");
  const prepared = Rooms.prepareStart("p1", room, source, rows(), "until", 5);
  const result = await Rooms.commitStart(prepared, async (key, messages) => {
    assert.equal(Rooms.list("p1").length, 1);
    bag.set(key, JSON.stringify(messages));
    return true;
  });
  assert.ok(result);
  assert.equal(Rooms.list("p1").length, 2);
  const hydrated = Rooms.hydrateChats([{ id: "p1" }], (key, fallback) => bag.has(key) ? JSON.parse(bag.get(key)) : fallback);
  assert.deepEqual(hydrated[result.key], prepared.messages);
});

test("持久化失败不留下空房，原聊天不被修改", async () => {
  const original = rows(), before = JSON.stringify(original);
  const source = Rooms.get("p1", "main");
  const room = Rooms.normalize({ id: "r5", name: "新房", ...Rooms.PRESETS.everyday }, "p1");
  const prepared = Rooms.prepareStart("p1", room, source, original, "recent", null);
  assert.equal(await Rooms.commitStart(prepared, async () => false), null);
  assert.equal(Rooms.list("p1").length, 1);
  assert.equal(JSON.stringify(original), before);
  assert.equal(await Rooms.commitStart(prepared, async () => { throw Error("quota"); }), null);
});

test("长按菜单不再出现分岔，建房处统一选择开场", () => {
  assert.doesNotMatch(components, /从这里分一间房|RoomForkPage|MSG_MENU[\s\S]{0,300}fork:/);
  assert.match(components, /进门时，先放哪段聊天/);
  assert.match(components, /空白开始/);
  assert.match(components, /最近聊天/);
  assert.match(components, /挑一句接起/);
  assert.match(components, /sourceMessages/);
  assert.match(app, /createChatRoomFromStart/);
  assert.match(app, /commitJSONDurable\(key, rows\)/);
  assert.match(app, /sourceMessages: chats\[/);
  assert.doesNotMatch(app, /prepareFork|roomFork|gateForkActions|supportsCalls/);
});

test("挑一句必须是当前已载入的有效消息", () => {
  const source = Rooms.get("p1", "main");
  const room = Rooms.normalize({ id: "r6", name: "新房", ...Rooms.PRESETS.everyday }, "p1");
  assert.equal(Rooms.prepareStart("p1", room, source, rows(), "until", -1), null);
  assert.equal(Rooms.prepareStart("p1", room, source, rows(), "until", 99), null);
  assert.equal(Rooms.prepareStart("p2", room, source, rows(), "recent", null), null);
});
