"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const comp = rd("apps/fairy-garden/companion.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");

// 她 2026-09-17：「更像邻居关系」。三间屋早就盖在那儿，名额就是三间。
test("邻居就是同行者那一份东西，没有第二套走路逻辑", () => {
  assert.match(world, /const NEIGHBOR_HOUSES = \['neighbor1', 'neighbor2', 'neighbor3'\]/);
  assert.match(world, /export const asCompanion = \(s, n\) =>/);
  assert.match(world, /不改控制器内部——邻居和同行者用的是同一段走路逻辑/);
  // 跑邻居用的是同一个控制器、同一个 createTraveler
  assert.match(game, /crew\.set\(id,\{ctrl:makeCompanionController\(\),avatar\}\)/);
  assert.match(game, /createTraveler\(dollSource,true,n\.look\|\|\{\}\)/);
  // ⚠️不许出现一套只给邻居用的位移／寻路
  const seg = game.slice(game.indexOf("function tickNeighbors"), game.indexOf("function drawNeighbors"));
  assert.doesNotMatch(seg, /findPath|walkable/, "走路要走同行者那一条，不许在这儿另写一段");
  assert.match(seg, /x\.ctrl\.tick\(asCompanion\(data,n\),dt,\{allowCare:false,autonomous:true\}\)/);
});

// ⚠️这一课这一季栽过两次：tick 在 mode==='routine' 时绕开 companionPlan，
//   所以「邻居的家在哪儿」必须放进两个调用方都会读的那一处＝plannedActivity。
test("「他家在哪儿」只有一处实现，companionPlan 和 tick 都读得到", () => {
  assert.match(comp, /export function plannedActivity\(s\)\{const star=starFor\(s\);if\(star\)return star;/);
  assert.match(comp, /return homeFor\(s,areaFor\(s,worksFor\(s,list\[at\]\),start,end\)\);/,
    "homeFor 必须包在最外层：他家在哪儿是最后一句话");
  assert.match(comp, /邻居的「家」是他自己那间屋/);
  // homeFor 只被 plannedActivity 叫一次：多一处就是同一层活在两处
  const code = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.equal((code.match(/homeFor\(/g) || []).length, 2, "一次定义一次调用，多了就是抄了第二份");
});

// 「来找你说话」「去馆里看你留下的东西」「帮你浇花」都是【你和他之间】的事
test("邻居不来找你说话、不进收藏馆、不浇你的花", () => {
  assert.match(comp, /autonomous＝这一位是邻居/);
  assert.match(comp, /wants=autonomous\?null:\(missIntent\(s\)\|\|guideIntent\(s\)\)/, "来找你、带路，邻居一样都不做");
  assert.match(comp, /if\(allowCare&&!autonomous&&plan\.id==='flowers'/);
  assert.match(comp, /if\(!autonomous&&plan\.id==='museum'/);
  assert.match(comp, /const NEIGHBOR_DAY=\[\[420,'home'\],\[540,'walk'\],\[780,'market'\],\[1020,'bridge'\],\[1200,'home'\]\]/,
    "邻居有自己的一天：FALLBACK 里那个 flowers 是【你家】的活儿");
});

// 三个人挤在同一个点上，看着就是坏的
test("三个邻居错开站、错开出门", () => {
  assert.match(comp, /function spread\(id,target,map\)/);
  assert.match(comp, /return walkable\(p\.x,p\.z,map\)\?p:target/, "错开之后还得站得住");
  assert.match(comp, /const shift=who&&who\.home\?shiftBy\(who\.charId\):0/);
});

// 此刻跟你在一起的那一个不能同时又是邻居
test("住进来这件事有闸", () => {
  assert.match(world, /export function moveInError\(s, charId\)/);
  assert.match(world, /三间邻居屋都住满了/);
  assert.match(world, /export const freeHouse = s =>/);
  assert.match(game, /moveIn:row=>\{const err=moveInError\(data,row&&row\.charId\);if\(err\)return err;/);
});

// 搬进搬出是村里的事，账上要有
test("搬进来搬出去都记进村里的账", () => {
  const inSeg = world.slice(world.indexOf("export function moveIn(s,"), world.indexOf("export function moveOut(s,"));
  const outSeg = world.slice(world.indexOf("export function moveOut(s,"), world.indexOf("export function moveOut(s,") + 400);
  assert.equal((inSeg.match(/noteHappening\(/g) || []).length, 1, "搬进记一笔");
  assert.equal((outSeg.match(/noteHappening\(/g) || []).length, 1, "搬出记一笔");
});

// 花册里看得见谁住在村里、此刻在哪儿
test("花册有邻居那一页", () => {
  assert.match(host, /"crew", "邻居"/);
  assert.match(host, /村里有三间邻居屋/);
  assert.match(host, /g\.moveOut\(n\.charId\)/);
  assert.match(host, /g\.moveIn\(\{ charId: invite\.charId, name: invite\.name, look: \{\}, door: invite\.door \}\)/,
    "请谁搬进来现在先开一张设定页，搬那一下把门一起带过去");
  assert.match(host, /onClick: \(\) => setInvite\(\{ charId: c\.id, name: c\.remark \|\| c\.name, door: \{\}, fresh: true \}\)/);
  assert.match(game, /getNeighbors:\(\)=>/);
});

// 邻居这条链一枪不打：谁住在哪儿、走到哪儿，全是算出来的
test("邻居不花一分钱", () => {
  const seg = world.slice(world.indexOf("// ── 住进来的邻居"), world.indexOf("export function restoreState"));
  assert.doesNotMatch(seg, /callAI|host\.|await /);
});
