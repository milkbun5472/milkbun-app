const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadCore() {
  const window = {};
  vm.runInNewContext(fs.readFileSync("js/desire-drive-shadow.js", "utf8"), { window });
  return window.DesireDriveShadow;
}

test("九维旧引擎 baseline 永久冻结，不再被反复推演带跑", () => {
  const core = loadCore();
  let state = core.step(null, "message", 1_000_000);
  const baseline = { ...state.baselines };
  for (let i = 1; i <= 500; i++) state = core.step(state, "message", 1_000_000 + i * 3600000);
  for (const [key, value] of Object.entries(baseline)) assert.equal(state.baselines[key], value);
  assert.equal(state.warnings.includes("baseline_drift"), false);
});

test("旧版已经漂移的 baseline 留审计快照后迁回冻结初值", () => {
  const core = loadCore();
  const old = core.step(null, "time", 1_000_000);
  old.baselines.intimacy = 69.8;
  old.baselines.joy = 68.8;
  const migrated = core.step(old, "time", 1_000_000 + 3600000);
  assert.equal(migrated.baselines.intimacy, 35);
  assert.equal(migrated.baselines.joy, 35);
  assert.equal(migrated.legacyBaselineDrift.values.intimacy, 69.8);
  assert.equal(migrated.legacyBaselineDrift.values.joy, 68.8);
  assert.equal(migrated.baselineFreezeVersion, 1);
  assert.equal(migrated.warnings.includes("baseline_drift"), false);
});
