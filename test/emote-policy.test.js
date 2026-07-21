const test = require("node:test");
const assert = require("node:assert/strict");
const Policy = require("../js/emote-policy.js");

const msg = (turnId, kind) => ({ role: "assistant", turnId, kind: kind || "text" });

test("从未自动发表情时允许由人设决定第一次", () => {
  assert.equal(Policy.canAutoSend([msg("a"), msg("b")], 8), true);
});

test("表情后不足八个角色回复轮次会被硬冷却", () => {
  const rows = [msg("e", "emote")];
  for (let i = 0; i < 7; i++) rows.push(msg("t" + i));
  assert.equal(Policy.canAutoSend(rows, 8), false);
  rows.push(msg("t7"));
  assert.equal(Policy.canAutoSend(rows, 8), true);
});

test("同一轮拆成多个气泡只算一个回复轮次，用户手发表情不干扰", () => {
  const rows = [msg("e", "emote"), msg("same"), msg("same"), { role: "user", kind: "emote", turnId: "mine" }];
  assert.equal(Policy.canAutoSend(rows, 2), false);
  rows.push(msg("next"));
  assert.equal(Policy.canAutoSend(rows, 2), true);
});
