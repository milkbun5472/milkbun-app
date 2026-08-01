const test = require("node:test");
const assert = require("node:assert/strict");
const Repair = require("../scripts/cc-ledger-repair.cjs");

const candidate = {
  status: "candidate", turn_id: "turn-1",
  lisa_original: "今晚吃粥。其实我有点想你。",
  yanqiu_original: "粥里加个蛋。我也想你。"
};

test("返修草稿只列逐字句，默认一条也不勾选", () => {
  const draft = Repair.buildDraft(candidate);
  assert.equal(draft.turn_id, "turn-1");
  assert.ok(draft.lisa.length >= 2);
  assert.ok(draft.lisa.every(x => x.include === false && x.kind === ""));
});

test("安全返修要求两侧逐字原话、合法 kind 和显式勾选", () => {
  const plan = Repair.buildDraft(candidate);
  Object.assign(plan.lisa[1], { include:true, kind:"emotion" });
  Object.assign(plan.yanqiu[1], { include:true, kind:"emotion" });
  const result = Repair.validatePlan(candidate, plan);
  assert.deepEqual(result.lisa_segments, [{ content:"其实我有点想你。", sync_kind:"emotion" }]);
  assert.deepEqual(result.yanqiu_segments, [{ content:"我也想你。", sync_kind:"emotion" }]);
});

test("返修不允许改写、空侧、重复句或把非候选轮补投", () => {
  const base = Repair.buildDraft(candidate);
  Object.assign(base.lisa[0], { include:true, kind:"life", quote:"今晚吃面。" });
  Object.assign(base.yanqiu[0], { include:true, kind:"life" });
  assert.throws(() => Repair.validatePlan(candidate, base), /quote_not_exact/);
  const empty = Repair.buildDraft(candidate);
  assert.throws(() => Repair.validatePlan(candidate, empty), /selection_count/);
  assert.throws(() => Repair.validatePlan({ ...candidate, status:"replayed" }, base), /candidate_not_pending/);
});
