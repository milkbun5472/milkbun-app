const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const engine = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");
const screens = fs.readFileSync(require.resolve("../js/screens.js"), "utf8");

test("subscription diagnostics distinguish request evidence from provider usage", () => {
  assert.match(engine, /bridge: !!p\.proxyRef, cacheRequested: cacheHist/);
  assert.match(engine, /systemBreakpoint:/);
  assert.match(engine, /historyBreakpoint:/);
  assert.match(engine, /usageReported: _usageReported/);
  assert.match(screens, /Max\/Fable 订阅桥已回传 CLI 缓存账单/);
  assert.match(screens, /缓存由 CLI 引擎管理/);
  assert.match(screens, /不把 0 冒充未命中/);
});
