const test = require("node:test"); const assert = require("node:assert");
const A = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
const i = A.indexOf("const memEvidenceTs"), j = A.indexOf("const pastMemEntry");
const memEvidenceTs = new Function(A.slice(i, j) + "; return memEvidenceTs;")();
test("抽出来的记忆日期照证据消息那天", () => {
  const msgs = [{ id: "a", ts: 1000, content: "x" }, { mid: "b", ts: 5000, content: "y" }, { ts: 7000, content: "z" }];
  assert.equal(memEvidenceTs({ evidence_message_ids: ["a", "b"] }, msgs), 5000);
  assert.equal(memEvidenceTs({ evidence_message_ids: ["ts_7000"] }, msgs), 7000);
  assert.equal(memEvidenceTs({ evidence_message_ids: ["nope"] }, msgs), 0);
  assert.equal(memEvidenceTs({}, msgs), 0);
  assert.match(A, /ts: memEvidenceTs\(it, msgs\) \|\| now, addedTs: now/);
});
