// 群里 2026-11-19：「视频通话的动描是不能编辑嘛」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
test("通话里动作那一行也挂长按菜单（跟台词同一个）", () => {
  const c = fs.readFileSync(path.resolve(__dirname, "..", "js/components.js"), "utf8");
  const i = c.indexOf('"data-wk": "callact"');
  assert.match(c.slice(i, i + 400), /onTouchStart: \(\) => callPress\(messageKey\)/);
});
