const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("ordinary private-chat action is re-observed every turn", () => {
  assert.match(app, /【实时动作字段·普通角色每轮必填】/);
  assert.match(app, /action 不属于按需字段，普通角色每轮都要填写/);
  assert.match(app, /if \(onlineAction && String\(onlineAction\)\.trim\(\)\) st\.actionUpdatedAt = stateNow/);
});

test("missing ordinary action clears stale snapshot without touching engineer autonomy", () => {
  assert.match(app, /if \(!_s\.engineerEyes\) \{\s*if \(onlineAction/);
  assert.match(app, /else \{ st\.action = null; st\.actionUpdatedAt = 0; \}/);
  assert.match(app, /言秋自治边界：engineerEyes 是本人专线/);
});
