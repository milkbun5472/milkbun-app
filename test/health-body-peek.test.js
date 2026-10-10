// 她 2026-10-10：群友想让角色知道自己不舒服——不编病历，读她在健康里真记过的
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "health.js"), "utf8");
function boot(data) {
  const store = { x_health: JSON.stringify(data) };
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const day = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const win = { localStorage: ls, ScheduleClock: { deviceDayKey: d => day(d), shiftDayKey: (k, n) => { const [y, m, dd] = k.split("-").map(Number); return day(new Date(y, m - 1, dd + n)); } } };
  const ctx = { window: win, localStorage: ls, React: { useState: v => [v, () => {}], createElement: () => null }, h: () => null, F_BODY: "", F_DISPLAY: "", console,
    loadJSON: (k, d) => { try { return JSON.parse(store[k]); } catch (e) { return d; } }, saveJSON: (k, v) => { store[k] = JSON.stringify(v); } };
  ctx.globalThis = ctx; ctx.self = ctx; Object.assign(ctx, win); vm.createContext(ctx);
  try { vm.runInContext(SRC, ctx); } catch (e) {}
  return { H: ctx.HealthCtx || win.HealthCtx, today: day(new Date()) };
}
test("源码：bodyLine / peekText 都在，饭点外也会带上身体那一句", () => {
  assert.match(SRC, /function bodyLine\(d, t, n\)/);
  assert.match(SRC, /function peekText\(now\)/);
  assert.match(SRC, /return \(env \? env \+ "这是她自己开的[^;]*\) \+ body;/);
  assert.match(SRC, /env \+ HEALTH_READ \+ body;/);
});
