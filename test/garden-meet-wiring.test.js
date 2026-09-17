"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");

// 她 2026-09-17：「继续做玩法吧宝宝」
test("碰见记在世界那一处，场上只负责谁站在哪儿", () => {
  assert.match(world, /export function noteMeet\(s, \{ a, b, nameA, nameB, place \}\)/);
  const seg = game.slice(game.indexOf("function meetTick"), game.indexOf("// ── 衣柜预览"));
  assert.match(seg, /data=noteMeet\(data,\{a:a\.id,b:b\.id/);
  assert.doesNotMatch(seg, /happenings|meets:/, "怎么记是世界的事，这儿不许自己往账上写");
  assert.doesNotMatch(seg, /callAI|host\./, "一枪都不打");
});

// ⚠️每帧算六对就是白烧电，她的手机要撑一整天
test("半秒才看一眼", () => {
  assert.match(game, /meetClock\+=dt;if\(meetClock<\.5\)return;meetClock=0;/);
  assert.match(game, /missTick\(\);chaseTick\(\);tickNeighbors\(dt\);meetTick\(dt\);/);
});

// 并排走一路就是几十条，村里的账会被一件事塞满
test("同一段时间同一对只记一次", () => {
  assert.match(world, /export const MEET_SLOTS = 6;/);
  assert.match(world, /if \(row && row\.day === s\.day && row\.slot === slot\) return s;/);
});

// 「在集市碰见阿棠」是真的；替阿棠编一句台词就是无中生有
test("只记世界看见的事，不替谁说话", () => {
  const seg = world.slice(world.indexOf("// ── 碰见"), world.indexOf("// 控制器跑邻居用的那一份适配"));
  assert.match(seg, /只记世界看见的事，不替谁说话/);
  assert.doesNotMatch(seg, /callAI|await /);
  // 账上那一句的形状：谁、在哪儿、碰上了。三个零件拼完就完了，没有第四个
  const line = world.slice(world.indexOf("const line = String(a) === 'me'"), world.indexOf("return noteHappening({ ...s, meets:"));
  assert.match(line, /碰见了/);
  assert.match(line, /碰上了/);
  assert.doesNotMatch(line, /[，。？！…]/, "台词才有标点，记一笔账没有");
});

// 邻居之间碰得再多也不是她的交情
test("熟到什么程度只数她自己碰见的那几次", () => {
  assert.match(world, /export const metCount = \(s, charId\) => \(restoreMeets\(s\.meets\)\.find\(r => r\.key === meetKey\('me', charId\)\)/);
  assert.match(host, /这个数只数【她自己碰见的】/);
  assert.match(host, /n\.met \? "碰见过 " \+ n\.met \+ " 次 · " \+ n\.closeness/);
});

// 这句话从做邻居屋那天起就写在 world.mjs 里等着了
test("屋里住了人，公告栏就落真名", () => {
  assert.match(world, /export function questFrom\(s, seed\)/);
  assert.match(world, /from: questFrom\(s, seed\),/);
  assert.match(world, /谁住进来【不改抽中哪一间】/);
  // ⚠️住户不许掺进抽签：搬一次家整块板子重抽，她接了一半的委托会当场换人
  const board = world.slice(world.indexOf("export function questBoard(s){"), world.indexOf("export const questTaken"));
  assert.doesNotMatch(board, /neighbors/);
});
