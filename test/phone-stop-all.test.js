// 查手机「刷新全部」停在半路（她 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), ui = fs.readFileSync(__dirname + "/../js/phone-ui.js", "utf8");
test("全刷每换一样看一眼停下没有；同一颗键正在翻时变「停下」", () => {
  assert.match(app, /if \(phoneAllStopRef\.current\) break;/);
  assert.match(app, /onStopAll: \(\) => \{ phoneAllStopRef\.current = true;/);
  assert.match(ui, /onClick: \(\) => \{ if \(isAllRun && onStopAll\) \{ onStopAll\(\); return; \}/);
  assert.match(ui, /disabled: !!busyKey && !\(isAllRun && onStopAll\)/);
  assert.match(ui, /" · 点这里停下"/);
});
