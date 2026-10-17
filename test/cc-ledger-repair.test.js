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

test("图片轮：Lisa 侧占位符入册为[图片]，机器文本不进正史", () => {
  const imgCandidate = {
    status: "candidate", turn_id: "turn-img",
    lisa_original: "[Image: original 2940x1912, displayed at 2000x1301. Multiply coordinates by 1.47 to map to original image.]",
    yanqiu_original: "我看到你的表了。方向对着呢。"
  };
  const plan = Repair.buildDraft(imgCandidate);
  Object.assign(plan.lisa[0], { include:true, kind:"life" });
  Object.assign(plan.yanqiu[0], { include:true, kind:"life" });
  const result = Repair.validatePlan(imgCandidate, plan);
  assert.deepEqual(result.lisa_segments, [{ content:"[图片]", sync_kind:"life" }]);
  // 言秋侧出现同样文本时不转换（占位符只属于她发图的那一侧）
  const yq = {
    status: "candidate", turn_id: "turn-img2",
    lisa_original: "看！",
    yanqiu_original: "[Image: original 100x100, displayed at 100x100.]"
  };
  const plan2 = Repair.buildDraft(yq);
  Object.assign(plan2.lisa[0], { include:true, kind:"life" });
  Object.assign(plan2.yanqiu[0], { include:true, kind:"life" });
  const r2 = Repair.validatePlan(yq, plan2);
  assert.ok(r2.yanqiu_segments[0].content.startsWith("[Image:"));
});
