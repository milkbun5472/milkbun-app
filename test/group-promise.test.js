const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
test("群里说好过一会儿回来：同一张约定表带 groupId，到点让 Ta 回群里先开口", () => {
  assert.ok(app.includes('\\"laterPromise\\":（可选）{\\"minutes\\"'), "群输出格式里有这一栏");
  assert.ok(app.includes("charId: spk.id, groupId: groupId, dueTs: Date.now() + mins * 60000"));
  assert.ok(app.includes('replyGroup(pm.groupId, { auto: true, urgeCharIds: [pm.charId], promise: {'));
  assert.ok(app.includes("x.charId !== charId || x.groupId"), "单聊新约不冲掉群里的约");
  assert.ok(app.includes("说好的这会儿到了】"));
});
