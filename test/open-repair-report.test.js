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
