// 群里 2026-10-09：「我有一版非常喜欢，但重 roll / 生成新的就会覆盖了，想把重 roll 生成的删除」。
// TA眼里每一块能锁、能删掉现在这版（上一版顶回来）、能把旧的换回来。
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "gaze.js"), "utf8");
function boot() {
  const store = {};
  const win = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  const ctx = { window: win, localStorage: win.localStorage, document: { createElement: () => ({}) },
    React: { useState: v => [v, () => {}], createElement: () => null }, h: () => null, F_BODY: "", F_DISPLAY: "", console };
  ctx.globalThis = ctx; ctx.self = ctx; vm.createContext(ctx); vm.runInContext(SRC, ctx);
  return { G: win.Gaze, box: () => JSON.parse(store.x_gaze || "{}").c1 || {} };
}

test("删掉现在这版：上一版顶回来；旧的能换回来、能删", () => {
  const { G, box } = boot();
  G.apply("c1", "me", "person", "喜欢的那一版");
  G.apply("c1", "me", "person", "重roll出来的");
  assert.ok(G.delVersion("c1", "me.person", 0, "", true));
  assert.equal(box().blocks["me.person"].text, "喜欢的那一版");
  assert.equal(box().hist.length, 0);
  G.apply("c1", "me", "person", "又一版");
  const old = box().hist[0];
  assert.ok(G.useVersion("c1", "me.person", old.ts, old.old));
  assert.equal(box().blocks["me.person"].text, "喜欢的那一版");
  assert.equal(box().hist[0].old, "又一版");
  assert.ok(G.delVersion("c1", "me.person", box().hist[0].ts, "又一版", false));
  assert.equal(box().hist.length, 0);
});

test("锁住的那块：自动改写、复看、整份重写都改不动", () => {
  const { G, box } = boot();
  G.apply("c1", "me", "person", "喜欢的那一版");
  G.setLock("c1", "me.person", true);
  assert.equal(G.apply("c1", "me", "person", "新的"), false);
  G.seed("c1", { me: { person: "整份重写的" } });
  assert.equal(box().blocks["me.person"].text, "喜欢的那一版");
  G.setLock("c1", "me.person", false);
  assert.ok(G.apply("c1", "me", "person", "新的"));
});

test("重 roll 掉的那一轮改的块撤回到上一版；锁住的、别的轮写的不动", () => {
  const { G, box } = boot();
  G.apply("c1", "me", "person", "喜欢的那一版");
  G.apply("c1", "me", "person", "那一轮叠上去的");
  const t = "t_" + (Date.now() + 1);
  assert.equal(G.rollbackTurns("c1", [t]), 1);
  assert.equal(box().blocks["me.person"].text, "喜欢的那一版");
  assert.equal(G.rollbackTurns("c1", ["t_" + (Date.now() + 60000)]), 0);   // 一分钟后的那一轮跟这块无关
  G.apply("c1", "me", "person", "又叠一版"); G.setLock("c1", "me.person", true);
  assert.equal(G.rollbackTurns("c1", ["t_" + (Date.now() + 1)]), 0);
});

test("rollbackCharTurns 顺手撤回 TA眼里", () => {
  const a = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(a, /window\.Gaze\.rollbackTurns\(charId, ordered\)/);
});
