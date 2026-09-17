"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const order = rd("庭院工单-会开的路-2026-09-17.md");

// 她 2026-09-17：「先做吧宝宝」——先把我这半边做好，等 codex 的网格一到就通
test("挡不挡路只改在 walkable 一处，就在湖结冰那一句旁边", () => {
  assert.match(world, /if\(o\.kind==='lake'&&lakeFrozen\(s\)\)return false;if\(o\.opensWith&&opened\(s,o\.opensWith\)\)return false;/);
  // 代码里只该有两处用到这个字段：walkable 那一句判断，openingReady 那一句找标记。
  // （注释里那一处不算——把注释也数进来，写句说明就会把测试弄红。）
  const code = world.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  const lines = code.split("\n").filter(l => l.includes("opensWith"));
  assert.equal(lines.length, 2, "只该有两行：walkable 那一句判断，openingReady 那一句找标记");
});

// ⚠️开路不是第二套魔法：同一个 castSpell、同一份 casts
test("开路就是往那一处封一片碎片", () => {
  for (const key of ["fallenTree", "reedBridge", "towerVines"])
    assert.ok(world.includes("'" + key + "'") || world.includes(key + ":"), key + " 要在表里");
  assert.match(world, /fallenTree: '林道上那棵倒树'/, "开口也是封咒的地点之一");
  assert.match(world, /这【不是第二套魔法】/);
  assert.doesNotMatch(world, /export function openPath|export function openWith/, "不许另开一个动词");
  // 碎片照旧不烧掉
  assert.match(world, /碎片照旧【不烧掉】/);
});

// ⚠️封了却走不过去＝骗她
test("模型没标记之前不让封，标记一到自己就开口", () => {
  assert.match(world, /export const openingReady = key => isOpening\(key\)/);
  assert.match(world, /o\.opensWith === key/);
  assert.match(world, /if \(isOpening\(place\) && !openingReady\(place\)\) return '那一处还没通到这个世界里来。';/);
  assert.match(world, /标记一到（codex 在 obstacles 上加 opensWith），这三处自己就开了口/);
  // 灰着摆在那儿是吊她胃口，而那一处此刻根本不存在
  const game2 = require("node:fs").readFileSync("apps/fairy-garden/game.mjs", "utf8");
  assert.match(game2, /if\(isOpening\(key\)&&!openingReady\(key\)\)continue;/);
});

// 灰着不解释，她只会以为坏了
test("开口只认它自己那个咒，而且说得出为什么", () => {
  assert.match(world, /if \(isOpening\(place\) && OPENINGS\[place\]\.spell !== spell\)/);
  assert.match(world, /'要的是' \+ SPELLS\[OPENINGS\[place\]\.spell\]\.name/);
});

// 名字即契约，先例是 doll.glb 那十二款头发
test("场景那一侧按名字切两份网格", () => {
  assert.match(game, /const m=\/\^\(shut\|open\):\(\.\+\)\$\/\.exec\(o\.name\|\|''\)/);
  assert.match(game, /o\.visible=\(m\[1\]==='open'\)===opened\(data,m\[2\]\)/);
  assert.match(game, /先例是 doll\.glb 那十二款头发/);
  assert.match(game, /function showMap\(atPlayer=false\)\{syncOpenings\(\);/, "换地图、读档之后也要切一次");
  assert.match(game, /\$\('cast-dialog'\)\.close\(\);syncOpenings\(\);/, "封完当场切");
});

// 哪一处地点对着哪一个开口：从 OPENINGS 倒过来推，不另写一张表
test("走到那儿说的是这一处此刻的样子", () => {
  assert.match(game, /const OPENING_AT=Object\.fromEntries\(Object\.entries\(OPENINGS\)\.map\(\(\[k,v\]\)=>\[v\.site,k\]\)\)/);
  assert.match(game, /if\(key&&openingReady\(key\)\)setTimeout\(\(\)=>say\(openingLine\(data,key\)\),1400\)/);
  assert.match(world, /opened\(s, key\) \? OPENINGS\[key\]\.open : OPENINGS\[key\]\.shut/);
});

// 工单上写给 codex 的那两条，代码这边要真的成立
test("工单和代码说的是同一件事", () => {
  assert.match(order, /opensWith/);
  assert.match(order, /shut:fallenTree/);
  assert.match(order, /open:fallenTree/);
  assert.match(order, /不许在 `rules\.js` 里写"谁能开它"/);
  for (const key of ["fallenTree", "reedBridge", "towerVines"]) assert.ok(order.includes(key), "工单里要点名 " + key);
});
