const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const engine = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const components = fs.readFileSync(require.resolve("../js/components.js"), "utf8");

test("群线下短期导演提示在提示尾部再次钉住", () => {
  assert.match(engine, /本轮短期导演提示必须实际落实/);
  assert.match(engine, /Number\(n\.remaining\) > 0 \? n\.text/);
});

test("新便签默认两轮，只有成功生成后才扣轮次", () => {
  assert.match(app, /remaining: 2/);
  const consumeAt = app.indexOf("短期导演便签只在成功生成后消耗");
  const beatsAt = app.indexOf("for (let i = 0; i < beats.length; i++)", app.indexOf("const genGroupOfflineFrom"));
  assert.ok(consumeAt > beatsAt);
  assert.match(app, /remaining: Math\.max\(0, Number\(n\.remaining \|\| 0\) - 1\)/);
});

test("界面固定显示剩余轮数、结束状态并支持删除", () => {
  assert.match(components, /短期导演便签 · 固定显示/);
  assert.match(components, /还会影响接下来/);
  assert.match(components, /已结束 · 下轮不再注入/);
  assert.match(components, /onDeleteNote/);
});
