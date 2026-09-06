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
const weekly = fs.readFileSync("js/weekly.js", "utf8");

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
  assert.match(roomSheet, /长篇如果/);
  assert.match(roomSheet, /不带出门/);
  assert.match(roomSheet, /进去继续/);
  assert.match(roomSheet, /新留一间/);
  assert.match(roomSheet, /把这 " \+ pending \+ " 条带回主线/);
  assert.match(roomSheet, /key === "writeback" && k === "roomHistory"/);
});

test("本房限定设定放在醒目位置，且压在每轮房间提示词最后", () => {
  const room = Rooms.create("p17", "十七岁", "alternate");
  const saved = Rooms.save("p17", { ...room, scenario: "在这条支线里，他是 17 岁，还没有经历后来的人生。" });
  const prompt = Rooms.prompt(saved, [{ role: "user", content: "主线后来发生的事", ts: saved.createdAt + 10 }]);
  assert.equal(Rooms.get("p17", saved.id).scenario, "在这条支线里，他是 17 岁，还没有经历后来的人生。");
  assert.match(prompt, /【本房限定设定｜本房内优先级最高】/);
  assert.ok(prompt.endsWith("不要复述这份指令。"), "限定设定没有压在房间提示词最后");
  assert.doesNotMatch(prompt, /主线后来发生的事/);
  assert.match(components, /本房限定设定 · 每轮最后提醒 TA/);
  assert.match(components, /这是本房优先级最高的设定，每一轮都会放在提示词最后提醒 TA/);
  assert.match(components, /: r\.scenario\s*\? \{ label: "长篇如果"/);
});

test("长篇如果默认隔离，但认知与写回权限可以自由混搭", () => {
  const room = Rooms.create("p17", "十七岁", "alternate");
  room.scenario = "他现在 17 岁";
  const mainRows = [{ role: "user", content: "主线后来发生的事", ts: room.createdAt + 10 }];
  assert.equal(Rooms.canWrite(room, "state"), false);
  assert.doesNotMatch(Rooms.prompt(room, mainRows), /主线后来发生的事/);

  room.cognition.formalMemory = true;
  room.cognition.innerLife = true;
  room.cognition.mainDelta = true;
  room.syncMode = "follow";
  room.writeback.sharedState = true;
  room.writeback.stateMood = true;
  room.writeback.stateGaze = true;
  room.writeback.memoryCandidate = true;
  room.writeback.mainSummary = true;
  assert.equal(Rooms.canWrite(room, "state"), true);
  assert.equal(Rooms.canWrite(room, "mood"), true);
  assert.equal(Rooms.canWrite(room, "gaze"), true);
  const prompt = Rooms.prompt(room, mainRows);
  assert.match(prompt, /主线后来发生的事/);
  assert.match(prompt, /本房可影响共同状态/);
  assert.match(prompt, /重要内容可经过既有闸进入记忆候选/);
  assert.match(prompt, /离房时可以形成一份可追溯交接/);
  assert.match(app, /const _roomSharesState = !room \|\| !!\(room\.writeback && room\.writeback\.sharedState\)/);
  assert.match(app, /const _roomMayRemember = !room \|\| !!\(room\.writeback && room\.writeback\.memoryCandidate\)/);
  assert.match(weekly, /!room\.main && room\.writeback && room\.writeback\.mainSummary/);
  // v65.00 换成她的说法：不再叫「认知/写回权限」，叫「他带什么进门 / 这儿的事出不出门」。
  assert.match(components, /他带什么进门、这儿的事出不出门都能任意混搭/);
  assert.match(components, /什么都没带进来 · 可以一条条放行/);
  assert.doesNotMatch(components, /!draft\.scenario && group\("cognition"/);
  assert.doesNotMatch(components, /!draft\.scenario && group\("writeback"/);
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
