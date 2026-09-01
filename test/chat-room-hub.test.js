"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const bag = new Map();
global.localStorage = {
  getItem: key => bag.has(key) ? bag.get(key) : null,
  setItem: (key, value) => bag.set(key, String(value)),
  removeItem: key => bag.delete(key)
};
const Rooms = require("../js/chat-rooms.js");
const app = fs.readFileSync("js/app.js", "utf8");
const components = fs.readFileSync("js/components.js", "utf8");

test.beforeEach(() => bag.clear());

test("主聊天不新增顶栏按钮，房间入口收进原有输入模式弹层", () => {
  const thread = components.slice(components.indexOf("function ChatThread("), components.indexOf("// ---- chat settings"));
  assert.match(thread, /modeOpen && h\(Sheet/);
  assert.match(thread, /onOpenRooms && h\("button"/);
  assert.match(thread, /把一件想慢慢继续的事单独收起来/);
  assert.match(thread, /room && !room\.main && h\("button", \{\s*onClick: onOpenRooms/);
  assert.match(app, /onOpenRooms: \(\) => setChatRoomsOpen\(true\)/);
});

test("房间首页先问用途，不把权限矩阵当成创建流程", () => {
  const roomSheet = components.slice(components.indexOf("function ChatRoomSheet("), components.indexOf("window.ChatRoomSheet"));
  assert.match(roomSheet, /和 " \+ \(character\.remark \|\| character\.name\) \+ " 的小房间/);
  assert.match(roomSheet, /慢慢聊这件事/);
  assert.match(roomSheet, /一起做件事/);
  assert.match(roomSheet, /不带出门/);
  assert.match(roomSheet, /进去继续/);
  assert.match(roomSheet, /新留一间/);
  assert.match(roomSheet, /把这 " \+ pending \+ " 条带回主线/);
  assert.match(roomSheet, /key === "writeback" && k === "roomHistory"/);
});

test("房间目的会保存并进入该分线的提示词", () => {
  const room = Rooms.create("p1", "施工间", "focused");
  const saved = Rooms.save("p1", { ...room, purpose: "把记忆系统一起修明白" });
  assert.equal(Rooms.get("p1", saved.id).purpose, "把记忆系统一起修明白");
  assert.match(Rooms.prompt(Rooms.get("p1", saved.id), []), /这间房想慢慢继续的事】把记忆系统一起修明白/);
});

test("按需补近况只有点过以后才读主聊天，并且成功轮会清掉一次性请求", () => {
  const room = Rooms.create("p1", "施工间", "focused");
  const mainRows = [{ role: "user", content: "主聊天的新近况", ts: room.createdAt + 10 }];
  assert.equal(room.syncMode, "ask");
  assert.doesNotMatch(Rooms.prompt(room, mainRows), /主聊天的新近况/);
  const armed = Rooms.save("p1", { ...room, syncOnce: true });
  assert.match(Rooms.prompt(armed, mainRows), /主聊天的新近况/);
  assert.match(app, /const clearOneShot = room\.syncMode === "ask" && room\.syncOnce/);
  assert.match(app, /syncOnce: clearOneShot \? false : room\.syncOnce/);
});

