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

test("关钟：以前虚拟那段照旧是虚拟日子，之后的照现实；再开：关着那段照现实", () => {
  const DAY = 86400000, t0 = 1700000000000, vBase = Date.UTC(2026, 0, 1);
  const keep = vm.runInContext("vclockKeepHist", ctx);
  const on1 = { main: { on: true, base: vBase, at: t0, speed: 1 } };
  const offAt = t0 + DAY, off = keep(on1, { main: { on: false, base: vBase, at: t0, speed: 1 } }, offAt);
  ctx.window.__vclock = { clocks: off, maskOf: () => "" };
  const map = vm.runInContext("vclockMap", ctx);
  assert.equal(map(t0 + 1000, "c"), vBase + 1000, "关钟前那条还是虚拟日子");
  assert.equal(map(offAt + 5000, "c"), offAt + 5000, "关钟后那条照现实");
  const onAt = offAt + 2 * DAY, vBase2 = Date.UTC(2026, 5, 1);
  const on2 = keep(off, { main: { on: true, base: vBase2, at: onAt, speed: 1 } }, onAt);
  ctx.window.__vclock = { clocks: on2, maskOf: () => "" };
  assert.equal(map(t0 + 1000, "c"), vBase + 1000, "最早那段还是第一只钟");
  assert.equal(map(offAt + 5000, "c"), offAt + 5000, "关着那段是现实");
  assert.equal(map(onAt + 1000, "c"), vBase2 + 1000, "再开以后照新钟");
  ctx.window.__vclock = null;
});
