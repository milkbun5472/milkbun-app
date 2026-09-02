"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("js/app.js", "utf8");
const components = fs.readFileSync("js/components.js", "utf8");

test("主聊天和每一间侧房都用自己的生成状态，不能串钥匙", () => {
  assert.match(app, /const _curChatKey = activeChar[\s\S]*?ChatRooms\.chatKey\(activeChar\.id, activeRoomId\)/);
  assert.match(app, /_curChatKey \? "c:" \+ _curChatKey/);
  assert.match(app, /startLane\("c:" \+ chatKey\)/);
  assert.match(app, /endLane\("c:" \+ chatKey\)/);
});

test("生成期间在聊天流末尾显示原来的白色三点气泡", () => {
  const thread = components.slice(components.indexOf("function ChatThread("), components.indexOf("// ---- chat settings"));
  const indicator = thread.slice(thread.indexOf("}), sending &&"), thread.indexOf("selMode ?", thread.indexOf("}), sending &&")));
  assert.match(thread, /\[messages\.length, sending\]/, "输入气泡出现时要自动滚到底");
  assert.match(indicator, /role: "status"/);
  assert.match(indicator, /"aria-label": character\.name \+ " 正在输入"/);
  assert.match(indicator, /padding: "12px 14px"/);
  assert.match(indicator, /background: "#fff"/);
  assert.match(indicator, /\[0, 1, 2\]\.map/);
  assert.doesNotMatch(indicator, /}, "正在输入"/, "气泡里不要出现文字");
});
