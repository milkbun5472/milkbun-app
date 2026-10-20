// 她 2026-10-21：19 号夜里的梦，推门进去梦里有 20 号傍晚才聊的三文鱼——口吻参考拿了此刻最新的聊天。
const test = require("node:test");
const assert = require("node:assert/strict");
const d = require("fs").readFileSync(require("path").join(__dirname, "../js/dream.js"), "utf8");
test("昨晚的梦只拿做梦那晚之前的聊天", () => {
  assert.match(d, /function recentChatSnippet\(charId, uName, charName, beforeTs\)/);
  assert.match(d, /&& \(!beforeTs \|\| !m\.ts \|\| Number\(m\.ts\) <= beforeTs\)\)/);
  assert.match(d, /voiceRef: recentChatSnippet\(c\.id, uName, c\.name, Number\(row\.createdAt\) \|\| 0\),/);
});
