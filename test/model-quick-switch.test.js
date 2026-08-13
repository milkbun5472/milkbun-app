const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

test("optional assistive model switch persists online and offline routes separately", () => {
  assert.match(app, /function ModelQuickSwitch\(/);
  assert.match(app, /x_modelFloatOn/);
  assert.match(app, /saveJSON\("x_activeApi", id\)/);
  assert.match(app, /saveJSON\("x_offlineApi", id\)/);
  assert.match(app, /角色专线仍由 apiFor\/offlineApiFor 优先/);
  assert.match(screens, /模型快速切换浮窗/);
  assert.match(screens, /角色专线不受影响/);
});
