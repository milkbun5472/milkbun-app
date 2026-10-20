// 她 2026-10-21：TA 拉黑我、我发解除申请、TA 拒——对 TA 那几句重 Roll，结果像没拉黑一样正常聊。
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
test("回申请的气泡挂上 unblockOf，重 Roll 时退回申请重新判", () => {
  assert.match(app, /queueUnblockSpeech\(chatKey, says, 300, charId, false, \{ unblockOf: cid, turnId: "ub_" \+ cid \}\);/);
  const i = app.indexOf("if (m.unblockOf) reqAt = msgs.findIndex(");
  assert.ok(i > 0);
  const seg = app.slice(i, i + 1400);
  assert.match(seg, /setBlockFor\(threadKey, \{ theyBlocked: true, tries: Math\.max\(0, tries0\) \}\);/);
  assert.match(seg, /setTimeout\(\(\) => sendMyUnblockReq\(activeChar\.id, req\.plea \|\| "", threadKey\), 200\);/);
  assert.ok(i < app.indexOf("      const turnId = m.turnId;\n      let rerollAvoid"), "要排在普通重 Roll 之前");
});
