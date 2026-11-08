const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
// 她 2026-11-08 转群里许愿：删除好友；他一直来加，被拒了可能换小号
test("删好友存在 x_blocks 那一份里，加回来落墓碑（留着他加了几次、用没用小号）", () => {
  assert.match(app, /if \(merged\.iBlocked \|\| merged\.theyBlocked \|\| merged\.deleted\) n\[charId\] = merged;/);
  assert.match(app, /n\[charId\] = \{ endedTs: Date\.now\(\), sinceTs: Number\(cur\.deletedTs\) \|\| 0, by: "del", reqs \};/);
  assert.match(app, /if \(b\.deleted\) return "【她把你删了好友】"/);
});
test("被删着时：主动那一路改成发好友申请，她发消息、按回复都拦下", () => {
  assert.match(app, /if \(opts && opts\.proactive\) return typeof bgJob === "function" \? bgJob\("proactive", [^\n]*sendFriendReq\(charId\)\)/);
  assert.match(app, /if \(\(blocksRef\.current\[activeChar\.id\] \|\| \{\}\)\.deleted\) \{ toast\("你已经删了 TA，先加回好友才能发消息"\); return; \}/);
  assert.match(app, /if \(!autoRefreshOn\("proactive", charId\)\) return false;/);
  assert.match(app, /reqs\.some\(r => r\.status === "pending"\)\) return false;/);
});
test("申请自己定用不用小号；她在「新的朋友」里通过或拒绝", () => {
  assert.match(app, /schemaHint: "\{\\"send\\":true,\\"alt\\":\\"\\",\\"note\\":\\"验证语\\"\}"/);
  assert.match(c, /function FriendReqPage\(\{ t, reqs, onAnswer, onClose \}\)/);
  assert.match(c, /entry\("新的朋友"/);
  assert.match(c, /"data-wk": "csdelfriend"/);
});
