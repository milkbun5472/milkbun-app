"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

function load() {
  const old = global.window;
  global.window = {};
  delete require.cache[require.resolve("../js/open-repair-shadow.js")];
  require("../js/open-repair-shadow.js");
  const mod = global.window.OpenRepairShadow;
  global.window = old;
  return mod;
}

test("RepairGate 报表区分证据份数与实际涉及的开环条数", () => {
  const out = load()._summarizeRows([
    { oldMemoryId: "m1", kind: "fulfilled", seenCount: 1 },
    { oldMemoryId: "m1", kind: "fulfilled", seenCount: 2 },
    { oldMemoryId: "m2", kind: "resolved", seenCount: 1 }
  ]);
  assert.equal(out.uniqueOpenMemories, 2);
  assert.equal(out.repeatedOpenMemories, 1);
  assert.equal(out.duplicateEvidenceRows, 1);
  assert.equal(out.repeatedObservations, 1);
  assert.equal(out.outcomeConflicts, 0);
});

test("同一开环被判成不同结局必须显式报警", () => {
  const out = load()._summarizeRows([
    { oldMemoryId: "m1", kind: "fulfilled" },
    { oldMemoryId: "m1", kind: "abandoned" }
  ]);
  assert.equal(out.outcomeConflicts, 1);
});

test("只有真实消息中逐字存在的闭环证据才会被交给 App", () => {
  const gate = load();
  const opens = [{ id: "m_done", text: "言秋答应把报告交给 Lisa", open: true }];
  const messages = [{ id: "msg_1", role: "assistant", content: "报告已经交给你了宝宝。" }];
  const valid = gate._validateCandidates([{
    resolveOpen: 1,
    repair_kind: "fulfilled",
    evidence_message_ids: ["msg_1"],
    evidence_quotes: ["报告已经交给你了"]
  }], opens, messages);
  assert.deepEqual(valid.map(x => ({ oldMemoryId: x.oldMemoryId, kind: x.kind })), [
    { oldMemoryId: "m_done", kind: "fulfilled" }
  ]);
});

test("编造引文、越界编号和非闭环类别全部拒绝", () => {
  const gate = load();
  const opens = [{ id: "m1", text: "还没做完", open: true }];
  const messages = [{ id: "msg_1", role: "assistant", content: "我只是道歉，还没有做完。" }];
  const invalid = gate._validateCandidates([
    { resolveOpen: 1, repair_kind: "fulfilled", evidence_message_ids: ["msg_1"], evidence_quotes: ["已经完成"] },
    { resolveOpen: 9, repair_kind: "fulfilled", evidence_message_ids: ["msg_1"], evidence_quotes: ["还没有做完"] },
    { resolveOpen: 1, repair_kind: "calmed", evidence_message_ids: ["msg_1"], evidence_quotes: ["只是道歉"] }
  ], opens, messages);
  assert.deepEqual(invalid, []);
});

test("软闭环只改命中的 open，原条目与其他开环全部保留", () => {
  const gate = load();
  const before = [
    { id: "m1", text: "报告还没交", open: true },
    { id: "m2", text: "另一个约定", open: true },
    { id: "m3", text: "本来就完成", open: false }
  ];
  const out = gate.applyResolutions(before, [{ oldMemoryId: "m1", kind: "fulfilled" }], 12345);
  assert.equal(out.closed, 1);
  assert.equal(out.entries.length, 3);
  assert.deepEqual(out.entries[0], {
    id: "m1", text: "报告还没交", open: false,
    openResolvedTs: 12345, openResolutionKind: "fulfilled", openResolvedBy: "repair_gate"
  });
  assert.equal(out.entries[1], before[1]);
  assert.equal(out.entries[2], before[2]);
});

test("同一开环同轮出现不同结局时一条也不能自动闭环", () => {
  const safe = load()._safeResolutions([
    { oldMemoryId: "m1", kind: "fulfilled" },
    { oldMemoryId: "m1", kind: "abandoned" },
    { oldMemoryId: "m2", kind: "resolved" },
    { oldMemoryId: "m2", kind: "resolved" }
  ]);
  assert.deepEqual(safe, [{ oldMemoryId: "m2", kind: "resolved" }]);
});
