"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");
const html = rd("apps/fairy-garden/index.html");

// 她 2026-09-17：「能不能做开放交互，每一个地方的家具都能交互」
test("这张表只按 kind，家具本身还住在 codex 那边", () => {
  assert.match(world, /export const FURNITURE = \{/);
  assert.match(world, /这张表【只按 kind】/);
  assert.doesNotMatch(world, /FURNITURE\[[^\]]*\]\s*=\s*\{/, "不许在这儿另存一份「哪间屋有哪几件」");
  assert.match(world, /他新盖一间屋、摆一张同样的桌子，这边不用改一个字/);
});

// ⚠️家具本身是障碍，点上去 walkable 一定是 false
test("点家具要排在「走过去」前面", () => {
  assert.match(game, /const box=pickFurniture\(ray\);if\(box&&openNear\(box\)\)return;/);
  assert.match(game, /const furn=furnitureAtPoint\(data\.map,point\);/);
  assert.match(game, /if\(walkable\(point\.x,point\.z,data\.map,data\)\)go\(\{x:point\.x,z:point\.z\}\);/);
  // 射线真打中一件家具，是这一串里最准的信号，排在最前面
  assert.ok(game.indexOf("const box=pickFurniture(ray)") < game.indexOf("hitInteraction(data.map,point"));
  assert.ok(game.indexOf("const furn=furnitureAtPoint") < game.indexOf("if(walkable(point.x,point.z,data.map,data))go("),
    "先问家具，再走地面；反过来点沙发就永远没反应");
  // 走过去开菜单只写一段，两个入口共用
  assert.equal((game.match(/function openNear\(key\)/g) || []).length, 1);
  assert.equal((game.match(/openNear\(/g) || []).length, 3, "一次定义，tapMap 里两处入口共用");
});

// ⚠️镜头是斜的：点在沙发靠背上，射线落到地面已经是沙发后面那一块
test("点的是家具自己的盒子，不是地面落点", () => {
  assert.match(game, /function pickFurniture\(ray\)/);
  assert.match(game, /ray\.ray\.intersectBox\(box,hit\)/);
  assert.match(game, /new THREE\.Box3\(new THREE\.Vector3\(f\.x-f\.w\/2,y,f\.z-f\.d\/2\)/);
  assert.match(game, /盒子的尺寸 rules\.js 里本来就有/, "盒子就是碰撞盒，不另存一份");
  assert.match(world, /挑最近的，是因为放宽之后两件挨着的家具会同时认领/);
});

// 她定的规矩：点了自动带路，不传送也不隔空操作
test("走到了才开菜单", () => {
  assert.match(game, /if\(go\(spot\)\)\{pendingSpot=key;return true;\}/);
  assert.match(game, /function arriveSpot\(\)\{const key=pendingSpot;pendingSpot=null;if\(key\)openFurniture\(key\);\}/);
  assert.match(game, /beginAction\(k\);\}else \{ui\(\);arriveSpot\(\);\}/);
  assert.match(game, /if\(!spot\)\{say\('这一件旁边站不下人。'\);return true;\}/, "站不下也要说一句");
});

// 原来能摆的只有屋檐、窗台、池边三个位置
test("放得住东西的家具都是一个位置，老三样一个都没丢", () => {
  assert.match(world, /export const SPOTS = \{ eaves: '屋檐下', sill: '窗台', pond: '池边' \};/);
  assert.match(world, /export function spotsAll\(\)\{/);
  assert.match(world, /export const isSpot = key => Object\.hasOwn\(SPOTS, key\)/);
  assert.match(world, /if \(!t \|\| !thingReady\(s, t\) \|\| \(spot && !isSpot\(spot\)\)\) return s;/);
  // ⚠️写存档和读存档是同一层的两半：读那一半只认老三样的话，她摆出去的东西一刷新就掉
  assert.match(world, /spot: isSpot\(x\.spot\) \? x\.spot : null/);
  assert.doesNotMatch(world, /Object\.hasOwn\(SPOTS, x\.spot\)/);
});

// 五十几个位置，一件东西底下铺五十几颗药丸没法用
test("花册里只留够得着的那几处，其余都在世界里", () => {
  assert.match(game, /here:furnitureHereKey\(\)/);
  assert.match(host, /\["eaves", "sill", "pond"\]\.includes\(k\) \|\| k === t\.spot \|\| k === things\.here/);
  assert.match(host, /走过去点它就行/);
});

test("这一整条一枪都不打", () => {
  const seg = world.slice(world.indexOf("// ── 开放交互"), world.indexOf("export function placeThing"));
  assert.doesNotMatch(seg, /callAI|host\.|await /);
  assert.match(seg, /先说她自己的东西/);
  assert.match(html, /id="spot-note"/);
});
