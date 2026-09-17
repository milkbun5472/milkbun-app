"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const order = rd("庭院工单-会开的路-2026-09-17.md");

// 她 2026-09-17：「先做吧宝宝」——先把我这半边做好，等 codex 的网格一到就通
test("挡不挡路只有一处答案，walkable 和 segmentClear 都问它", () => {
  // codex 2026-09-17 实测：落脚点能走、跨过去却被拦——segmentClear 那一句抢跑的
  // 快筛不问存档。现在两边都问同一个 blocksNow（湖结冰那一句也搬了进去）。
  assert.match(world, /function blocksNow\(o,s\)\{/);
  assert.match(world, /if\(o\.kind==='lake'&&lakeFrozen\(s\)\)return false;/);
  assert.match(world, /if\(o\.opensWith&&opened\(s,o\.opensWith\)\)return false;/);
  assert.match(world, /obstacles\.some\(o=>\{if\(!blocksNow\(o,s\)\)return false;/);
  assert.match(world, /o\.w&&o\.d&&!o\.except&&blocksNow\(o,s\)&&clipsBox\(a,b,o\)/);
  // 一台寻路器、一张乐观格子：结冰那台假存档的双胞胎退役了
  assert.doesNotMatch(world, /iceNavigator|iceState/, "会变的地形每多一种就多一台寻路器，她的手机撑不住");
  assert.match(world, /export const findPath=\(a,b,map='garden',avoid=\[\],s=null\)=>navigator\(a,b,map,avoid,s\);/);
  // ⚠️s 可以是空的：不挡这一下，主寻路器会当场抛错
  assert.match(world, /export const opened = \(s, key\) => isOpening\(key\) && !!s && !!castAt\(s, key\);/);
  // 代码里只该有两处用到这个字段：walkable 那一句判断，openingReady 那一句找标记。
  // （注释里那一处不算——把注释也数进来，写句说明就会把测试弄红。）
  const code = world.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  const lines = code.split("\n").filter(l => l.includes("opensWith"));
  assert.equal(lines.length, 5, [
    "blocksNow：这一块此刻还挡不挡路",
    "openDeck：开了的桥面本身就是路",
    "segmentClear：这张图上有开着的桥面时不许抢跑快筛",
    "floorHeight：没搭起来的桥面还不是地面",
    "openingReady：模型那边有没有标记",
  ].join(" / "));
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

// codex 2026-09-17：室外模型切换会漏——后来懒加载的倒树、芦苇桥没有一起更新
test("分区流式加载进来的那几块也要跟着切", () => {
  assert.match(game, /\[view\.root,\.\.\.\(view\.stream\?\.roots\(\)\|\|\[\]\)\]\.filter\(Boolean\)/);
  assert.match(game, /function watchOpenings\(\)\{if\(openingMark\(\)!==loadedMark\)syncOpenings\(\);\}/);
  assert.match(game, / watchOpenings\(\);\n if\(now-lastRender/, "每帧看一眼，哪一块新加载进来就重扫");
});

// codex 2026-09-17：芦苇桥需要真正可走的桥面，还要处理桥下那段湖水
test("桥面就是一块 surface，没搭起来之前那儿还是湖", () => {
  assert.match(world, /const openDeck=\(map,x,z,s\)=>/);
  assert.match(world, /if\(openDeck\(map,x,z,s\)\)return true;/, "开了的桥面本身就是路，压在湖上也算");
  assert.match(world, /if\(s\.opensWith&&!opened\(state,s\.opensWith\)\)continue;/, "没搭之前不许有桥面高度");
  assert.match(world, /桥本来就得是一块 surface/);
});
