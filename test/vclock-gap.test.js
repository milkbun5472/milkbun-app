// 「中间隔了多久」按虚拟钟算：拨钟跳过去的那段也算（她 2026-11-01）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = { console, window: { addEventListener() {} }, navigator: { userAgent: "" }, document: { addEventListener() {} } };
vm.createContext(ctx);
try { vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8"), ctx); } catch (e) {}
test("拨钟往后三天、现实只过一分钟：间隔算三天", () => {
  const t0 = 1700000000000, jumpAt = t0 + 30000, t1 = t0 + 60000, DAY = 86400000;
  const base0 = Date.UTC(2026, 0, 1), base1 = base0 + 3 * DAY;
  ctx.window.__vclock = { clocks: { main: { on: true, base: base1, at: jumpAt, speed: 1, hist: [{ until: jumpAt, base: base0, at: t0, speed: 1 }] } }, maskOf: () => "" };
  const g = vm.runInContext("vGap", ctx)(t0, t1, "c1");
  assert.ok(g > 3 * DAY - 60000 && g < 3 * DAY + 60000, "got " + g);
});
test("没开虚拟钟：跟现实一样", () => {
  ctx.window.__vclock = null;
  assert.equal(vm.runInContext("vGap", ctx)(1000, 61000, "c1"), 60000);
});
test("线下、群线下、群聊三处都用 vGap", () => {
  const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8"), app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.equal((eng.match(/const _vg = vGap\(prevTs, ts, clockId\);/g) || []).length, 2);
  assert.match(app, /vGap\(_gprev, ts, "g:" \+ groupId\)/);
});
