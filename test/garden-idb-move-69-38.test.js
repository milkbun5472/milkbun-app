"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const engine = fs.readFileSync("js/engine.js", "utf8");
const garden = fs.readFileSync("js/fairy-garden.js", "utf8");

// 一档庭院（日子、背包、碎片、聊过的话）实测零点几 MB；localStorage 只有 5MB，
// 而它一满是整个 app 都写不进去。所以存档归文字仓（IndexedDB）管。
test("庭院存档与名册都归 IDB 文字仓管", () => {
  const m = engine.match(/const IDB_TEXT_PREFIXES = \[([^\]]*)\]/);
  assert.ok(m, "常量还在原地");
  assert.ok(m[1].includes('"x_fairyGarden"'), "前缀要罩住 x_fairyGarden / x_fairyGarden:<id> / x_fairyGardenSaves");
});

// 搬家只有一份实现：hydrateTxtVault 的「复制→逐字读回核对→才删本地」。
// 庭院这边一个字都不许自己再搬一次（施工规则/one-public-mechanism.md）。
test("庭院自己不许写第二套搬家代码", () => {
  assert.ok(!/idbTxtPut|idbTxtGet|hydrateTxtVault/.test(garden), "搬家是文字仓那一层的事");
});

test("删一档要四处都删干净，不能只删 localStorage", () => {
  assert.match(engine, /function dropStored\(k\)/);
  const seg = engine.slice(engine.indexOf("function dropStored(k)"), engine.indexOf("function isQuotaError"));
  assert.match(seg, /localStorage\.removeItem\(k\)/);
  assert.match(seg, /_txtMirror\(\)\.delete\(k\)/);
  assert.match(seg, /idbTxtDel\(k\)/);
  assert.ok(!/localStorage\.removeItem\(saveKeyOf\(row\)\)/.test(garden), "删存档要走 dropStored");
  assert.match(garden, /dropStored\(saveKeyOf\(row\)\)/);
});

// 存档搬走之后，localStorage 里多半只剩没迁完的那几个：两边都要扫，
// 否则「找回的一档 / 聊天里的庭院房」会从选择页上凭空消失。
test("认回没登记的存档要同时扫 localStorage 和内存镜像", () => {
  const i = garden.indexOf("function readSaves()");
  const seg = garden.slice(i, garden.indexOf("function saveMeta", i));
  assert.match(seg, /localStorage\.key\(i\)/);
  assert.match(seg, /__txtMirror/);
});

// ⚠️最要紧的一条：空 ≠ 没有这一档。仓没灌起来时读回来也是空，
// 这时候开一档新的，第一次保存就把她真正那一档原地盖掉了。
test("文字仓没打开时不许当作没有存档、更不许写", () => {
  assert.match(garden, /function vaultStalled\(key\)/);
  const seg = garden.slice(garden.indexOf("function vaultStalled"), garden.indexOf("const write ="));
  assert.match(seg, /txtVaultState/);
  assert.match(garden, /const stall = vaultStalled\(k\); if \(stall\) throw new Error\(stall\)/);
  assert.match(garden, /const stall = vaultStalled\(INDEX_KEY\)/);
});

// dropStored 真跑一遍：镜像删了、IDB 也去删了。
test("dropStored 真的把镜像那份也删掉", () => {
  const src = engine.slice(engine.indexOf("function dropStored(k)"), engine.indexOf("function isQuotaError"));
  const mirror = new Map([["x_fairyGarden:g1", "{}"]]);
  const removed = [], idbDel = [];
  const fn = new Function("localStorage", "isIdbTextKey", "_txtMirror", "idbTxtDel", "walDel", "console",
    src + "; return dropStored;")(
    { removeItem: k => removed.push(k) },
    k => k.indexOf("x_fairyGarden") === 0,
    () => mirror,
    k => { idbDel.push(k); return Promise.resolve(); },
    () => Promise.resolve(),
    console);
  fn("x_fairyGarden:g1");
  assert.deepEqual(removed, ["x_fairyGarden:g1"]);
  assert.deepEqual(idbDel, ["x_fairyGarden:g1"]);
  assert.equal(mirror.size, 0);
});
