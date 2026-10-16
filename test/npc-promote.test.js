// 她 2026-10-15：「npc怎么转正啊搞一个」——同一个 id 原地摘掉 npc / ownerId，聊天记忆关系都不搬
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), comp = R("components.js");
test("转正：原地摘掉 npc 和 ownerId，记下原来挂在谁身边", () => {
  assert.match(app, /onPromoteNpc: id =>/);
  assert.match(app, /const n = \{ \.\.\.c, promotedFrom: c\.ownerId \|\| "" \}; delete n\.npc; delete n\.ownerId;/);
  assert.match(comp, /onPromote: onPromoteNpc/);
  assert.match(comp, /"data-wk": "npcpromotego", onClick: \(\) => \{ setPromoArm\(null\); setOpenId\(null\); onPromote\(cur\.id\); \}/);
});
