// 带上最近几次线下（群友许愿 2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = rd("app.js"), eng = rd("engine.js"), comp = rd("components.js"), ts = rd("theme-studio.js");
test("一份取法，单聊／线下走 ctxFor，群聊走成员私有背景", () => {
  assert.equal((app.match(/const pastOfflineFor = /g) || []).length, 1);
  assert.match(app, /pastOffline: settingsFor\(char\.id\)\.engineerEyes \? "" :/);
  assert.match(app, /return pastOfflineFor\(c, inCross \? newest\.id : null\);/);
  assert.match(app, /pastOfflineN \?\? 0\)/);
  assert.match(eng, /ctx\.pastOffline && String\(ctx\.pastOffline\)\.trim\(\)/);
});
test("每人一格，默认 0（跟原来一样），存得上", () => {
  assert.match(comp, /settings\.pastOfflineN == null \? 0/);
  assert.match(app, /pastOfflineN: Math\.max\(0, Math\.min\(10, Number\(s\.pastOfflineN\) \|\| 0\)\)/);
  assert.match(ts, /"pastoffline"/);
});
