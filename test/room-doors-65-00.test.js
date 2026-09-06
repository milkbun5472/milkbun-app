const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const Rooms = require("../js/chat-rooms.js");
const components = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
const rooms = fs.readFileSync(path.join(__dirname, "../js/chat-rooms.js"), "utf8");
const sheet = components.slice(components.indexOf("function ChatRoomSheet("), components.indexOf("window.ChatRoomSheet ="));

const bag = new Map();
global.localStorage = {
  getItem: k => bag.has(k) ? bag.get(k) : null,
  setItem: (k, v) => bag.set(k, String(v)),
  removeItem: k => bag.delete(k)
};

// 房间是走廊上的几扇门，不是一排 tab（tabs-not-plain-pills）：
// 拱顶门牌、竖排字、右边一颗把手，开着的那扇齐地板、纸色跟下面那块板同一张。
test("换房间的是几扇门，不是侧边一列按钮", () => {
  assert.match(sheet, /borderRadius: "36px 36px 5px 5px"/);
  // 门牌上的字一个字一行（writing-mode 在这层 flex 里会叠成一坨）
  assert.match(sheet, /flexDirection: "column"[^\n]*lineHeight: 1\.12/);
  // 选中态不能只靠色差：高度、纸色、把手大小都跟着变
  assert.match(sheet, /height: on \? 104 : 84/);
  assert.match(sheet, /background: on \? t\.bg : "transparent"/);
  // 旧的 sidebar 网格已经拆掉
  assert.doesNotMatch(sheet, /const sidebar = h\("div"/);
  assert.doesNotMatch(sheet, /gridTemplateColumns: "minmax\(92px, 31%\)/);
  // 深色主题里不许写死白字
  assert.doesNotMatch(sheet, /color: on \? "#fff"/);
});

test("进门先给一句话，说的是他记不记得、这儿的事出不出得去", () => {
  const p = "pDoor";
  const main = Rooms.get(p, "main");
  assert.match(Rooms.doorLine(main), /完整的他/);

  const shut = Rooms.create(p, "十七岁", "alternate");
  assert.match(Rooms.doorLine(shut), /不记得你们的过去/);
  assert.match(Rooms.doorLine(shut), /带不出去/);

  const open = { ...shut, cognition: { ...shut.cognition, formalMemory: true, innerLife: true }, writeback: { ...shut.writeback, sharedState: true, memoryCandidate: true } };
  assert.match(Rooms.doorLine(open), /记得你们的全部/);
  assert.match(Rooms.doorLine(open), /走出门/);

  // 这一句真的挂在编辑面板最上头
  assert.match(sheet, /Kit\.doorLine\(draft\)/);
});

test("这几栏说的是人话，不是权限位", () => {
  assert.match(sheet, /"他进这扇门时带着什么"/);
  assert.match(sheet, /"这儿发生的事，出不出这道门"/);
  assert.doesNotMatch(sheet, /"认知权限"/);
  assert.doesNotMatch(sheet, /"写回权限"/);
  // key 一个都没改，存档不受影响
  assert.ok(Rooms.GROUPS.cognition.some(x => x[0] === "formalMemory"));
  assert.ok(Rooms.GROUPS.writeback.some(x => x[0] === "sharedState"));
  assert.doesNotMatch(rooms, /"正式记忆", "可读取/);
});
