const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 群友 2026-10-13：同时给两个人发，都回了；退到消息列表再进去，一个人刚回的几条全没了。
// 旧聊天归档上云要等网络：原来等完拿【上传前那份快照】整份盖回本地，这段时间里刚到的回复就被盖掉。
test("归档裁本地只撤归档上去的那几条，等上传时新来的消息留着", () => {
  const one = app.slice(app.indexOf("const offloadChatOne = async"), app.indexOf("const offloadGChatOne = async"));
  assert.match(one, /pChat\(charId, p => p\.filter\(m => !_dropSet\.has\(m\) &&/);
  assert.ok(!/pChat\(charId, \(\) =>/.test(one), "又拿快照整份盖回去了");
  const grp = app.slice(app.indexOf("const offloadGChatOne = async"), app.indexOf("const offloadAllChats = async"));
  assert.match(grp, /pGChat\(groupId, p => p\.filter\(m => !_gDropSet\.has\(m\) &&/);
  assert.ok(!/pGChat\(groupId, \(\) => keep\)/.test(grp), "群聊又整份盖回去了");
});
