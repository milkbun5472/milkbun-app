"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");
const rules = rd("apps/fairy-garden/rules.js");
const html = rd("apps/fairy-garden/index.html");

// 她 2026-09-17：「收藏馆和配方都做吧宝宝」
test("收藏馆借公共厅那栋楼，不另起一座（模型那边归 codex）", () => {
  assert.match(rules, /museum:\{x:-\.2,z:-1\.65\}/, "站位写在地图这一处");
  assert.match(rules, /\{kind:'museum',x:-\.3,z:-2\.1,r:\.5\}/);
  assert.match(world, /if\(kind==='museum'\)return s\.map!=='garden'\?'收藏馆在公共厅里。':''/);
  assert.match(world, /museum:'去收藏馆'/, "日记里也要认得这一趟");
  assert.match(html, /id="museum-dialog"/);
  assert.match(game, /\$\('museum'\)\.onclick=\(\)=>request\('museum'\)/);
});

// ⚠️成本地板：这两条都是纯代码算的。哪天这儿开始打枪，庭院就从「不花钱也好玩」
//   变成「每挖一下都要钱」。
test("配方和收藏馆整条链不许出现模型调用", () => {
  const seg = world.slice(world.indexOf("// ── 锅：把碎片做成"), world.indexOf("// ── 星井（下潜）"));
  assert.doesNotMatch(seg, /callAI|host\.|await /);
  assert.match(seg, /一枪都不打/);
  const dialog = game.slice(game.indexOf("function openMuseum()"), game.indexOf("$('museum').onclick"));
  assert.doesNotMatch(dialog, /host\.|callAI/);
});

// 全表只在 world.mjs 那一处生成（施工规则/one-public-mechanism.md）
test("炼金笔记的全表只有一份，界面不许自己再抄一张", () => {
  assert.match(world, /export function recipeIndex\(\)/);
  assert.match(game, /recipeIndex,RECIPE_TOTAL/);
  assert.match(host, /museum\.recipes/);
  assert.doesNotMatch(host, /蒸馏|凝结|发酵|合炉/, "做法的名字在 CRAFT_WAYS 里，界面照它显示就行");
});

test("收藏馆在花册里占一格，捐东西要走到公共厅", () => {
  assert.match(host, /\["museum", "收藏馆"/);
  assert.match(host, /走到公共厅门口才能捐/);
  assert.match(host, /背包会被挤掉，这一份不会/);
});

// 合炉吃两片，所以弹层里选中的必须是【一个数组】
test("锅前挑两片才合得了炉", () => {
  assert.match(game, /let craftPicks=\[\]/);
  assert.match(game, /\[\.\.\.craftPicks,sh\.id\]\.slice\(-2\)/, "点第三片要把最早那片挤出去");
  assert.match(game, /CRAFT_WAYS\[x\.dataset\.way\]\.pair\?craftPicks\.length<2:!craftPicks\.length/);
  assert.match(game, /craftError\(data,first,key,second\)/);
});
