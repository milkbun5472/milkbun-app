"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const world = fs.readFileSync("apps/fairy-garden/world.mjs", "utf8");
const comp = fs.readFileSync("apps/fairy-garden/companion.mjs", "utf8");
const rules = fs.readFileSync("apps/fairy-garden/rules.js", "utf8");

// 她 2026-09-18：「一个时间段能不能圈出一个活动范围」
test("范围照 sites 和 furniture 推导，不另开一张点位表", () => {
  assert.match(world, /export function areaSpots\(map, center\)/);
  assert.match(world, /范围【推导】出来，不手写一张点位表/);
  assert.doesNotMatch(world, /const AREA_SPOTS *= *\{/, "又写了一张要养的表");
  // sites 也算（她点名：「算上sites」）
  assert.match(world, /sites 也算（她 2026-09-18 点名：「算上sites」）/);
});

// ⚠️她 2026-09-18：「每天接着上次转圈不也是人机，有些东西就会有些人干得多有些人干得少」
test("用稳定的权重，不用轮盘", () => {
  assert.match(world, /不许用轮盘/);
  assert.match(world, /export const spotWeight = \(s, who, key\)/);
  assert.match(world, /:taste:' \+ \(who \|\| ''\)/, "种子要带 charId：邻居各有各的习惯位置");
  assert.doesNotMatch(world, /roundRobin|轮着来/);
});

// ⚠️和 companion.mjs 那张地板表同一个待遇：它不假装是性格
test("注释里把「这不是他的性格」写死", () => {
  assert.match(world, /这一层【不是他的性格】/);
  assert.match(world, /换个角色还照样成立的就是写坏了/);
  assert.match(world, /真正照着人设来的那一份在季节手册那一枪里/);
});

// ⚠️tick 在 mode==='routine' 时绕开 companionPlan 直接用 plannedActivity
test("这一层挂在 plannedActivity 那一处，和另外三层一起", () => {
  assert.match(comp, /return homeFor\(s,areaFor\(s,worksFor\(s,list\[at\]\),start,end\)\);/);
  assert.match(comp, /这一课这一季栽过四次了，这是第五处要挂在这儿的东西/);
});

// ⚠️最坏的一种：他到了工坊却再也不帮忙照看材料，而且不报任何错
test("这一格本来那个点排第一，钉在上面的活儿不会悄悄没掉", () => {
  assert.match(comp, /const home=\{key:'plan:'\+plan\.id,label:'',target:\{\.\.\.plan\.target\},gesture:plan\.gesture\};/);
  assert.match(comp, /const picks=\[home,\.\.\.areaPick\(/);
  assert.match(comp, /这正是「他从此再也不浇花了」那一种悄悄没掉的东西/);
});

test("id 不许改，换了地方挂在 spot 上", () => {
  assert.match(comp, /return at\.label\?\{\.\.\.plan,spot:at\.key,/);
  assert.doesNotMatch(comp, /id:plan\.id\+'@'/, "改 id 会让 tick 里那几处判断当场失灵");
  assert.match(comp, /\$\{plan\.id\}:\$\{plan\.spot\|\|''\}/, "路线键要带上 spot");
  assert.match(comp, /\$\{routine\.id\}:\$\{routine\.spot\|\|''\}/, "跟在她身边那一档的缓存键也要带");
});

// ⚠️原来「翻看魔法笔记」的落点在公共厅门口，和「看告示板」「在村里走走」几乎同一处
test("三格不许转同一圈：翻笔记挪进厅里那排书架", () => {
  assert.match(rules, /study:\{map:'hall',target:MAPS\.hall\.sites\.books\.target/);
  assert.match(rules, /三格转的是同一圈/);
});
