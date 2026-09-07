const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("js/app.js", "utf8");
const rooms = fs.readFileSync("js/chat-rooms.js", "utf8");

test("侧房键读出的字符串 id 能找到数字 id 的老角色", () => {
  assert.match(rooms, /function personFromKey\(key\) \{ return String\(key \|\| ""\)\.split\("::room::"\)\[0\]; \}/);
  const helper = app.slice(app.indexOf("const offlineCharacterFor"), app.indexOf("const offlineRoomFor"));
  assert.match(helper, /String\(c\.id\) === String\(want\)/);
  assert.match(helper, /String\(offlineChar\.id\) === String\(want\)/);
});

test("单人线下生成和 OOC 都走统一找人入口，并在真找不到时说人话", () => {
  const block = app.slice(app.indexOf("const offlinePersonId"), app.indexOf("// ---- 群聊线下模式"));
  assert.ok((block.match(/offlineCharacterFor\(scopeKey\)/g) || []).length >= 5);
  assert.match(block, /没找到这间房对应的角色，请退出线下后重新进入/);
  const gen = block.slice(block.indexOf("const genOfflineFrom"), block.indexOf("const startOffline"));
  assert.match(gen, /const char = offlineCharacterFor\(scopeKey\);/);
  assert.match(gen, /if \(!char\)/);
});
