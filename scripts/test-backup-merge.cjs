const assert = require("node:assert/strict");
const M = require("../js/backup-merge.js");

const local = [
  { id: "shared", role: "user", content: "共同消息", ts: 100 },
  { id: "bookmark-only", role: "assistant", content: "书签新增", ts: 200 },
  { role: "user", content: "没有 id 的老消息", ts: 300 }
];
const backup = [
  { id: "shared", role: "user", content: "共同消息", ts: 100, read: true },
  { id: "shell-only", role: "assistant", content: "壳新增", ts: 250 },
  { role: "user", content: "没有 id 的老消息", ts: 300 },
  { id: "backup-ledger-copy", role: "assistant", content: "书签新增", ts: 200 }
];
const merged = M.mergeMessageLists(local, backup);
assert.equal(merged.length, 4, "共有消息（含无 id 老消息）应去重");
assert.deepEqual(merged.map(x => x.id || x.content), ["shared", "bookmark-only", "shell-only", "没有 id 的老消息"]);
assert.equal(merged[0].read, true, "同 ID 时导入侧更新字段应生效");
assert.equal(M.isChatKey("x_chat:a"), true);
assert.equal(M.isChatKey("x_gchat:g"), true);
assert.equal(M.isChatKey("x_settings"), false);
console.log("backup chat merge: ok");
