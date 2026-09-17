"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const comp = rd("apps/fairy-garden/companion.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");

// 她 2026-09-17：「做④吧宝宝」（codex 提的第四条：做过的事真的改变生活）
test("修好了不是拿到一个勾，是村里多一处能用的地方", () => {
  assert.match(world, /export const WORKS = \{/);
  assert.match(world, /变的是日子，不是一张成就表/);
  // 每一件都得说清楚它改了什么：没有 moves 就只是个勾
  assert.match(world, /towerRoof:[\s\S]*?moves: \['rain'\]/);
  assert.match(world, /lakeShade:[\s\S]*?moves: \['walk','pond','bottle','glow'\]/);
  assert.match(world, /moves 是一【组】格子/);
  assert.match(world, /if \(!\(w\.moves \|\| \[\]\)\.includes\(activityId\)/);
});

// ⚠️小路那盏灯原来散在好几处，现在是这张表的第一行（已有的也要搬过来）
test("路灯搬进了同一张表，没有留下第二处", () => {
  assert.match(world, /pathLamp: \{ label: '小路那盏灯'/);
  assert.match(world, /export const lampOn = s => workDone\(s, 'pathLamp'\)/);
  assert.doesNotMatch(world, /restoreFixtures\(s\.fixtures\)\.pathLamp/, "别处一律走 workDone");
  // 开局那份也照表来，不写字面量
  assert.match(world, /fixtures:restoreFixtures\(null\)/);
  assert.match(world, /for \(const id of Object\.keys\(WORKS\)\) out\[id\] = d\[id\] === true;/);
});

// ⚠️这一课这一季栽过三次：tick 在 routine 模式绕开 companionPlan
test("「修好的地方改了他去哪儿」只写在 plannedActivity 一处", () => {
  assert.match(comp, /const worksFor=\(s,plan\)=>\{const spot=workSpot\(s,plan\.id\)/);
  assert.match(comp, /return homeFor\(s,worksFor\(s,list\.findLast/);
  assert.equal((comp.match(/worksFor/g) || []).length, 2, "一次定义一次调用，多了就是抄了第二份");
  assert.match(world, /export function workSpot\(s, activityId\)/);
});

// 说错了就删掉重写，不挂「除非」（施工规则/no-yes-unless.md）
test("下雨天没有遮头的那几格都挪到檐下", () => {
  assert.match(comp, /const DRY_IN_RAIN=new Set\(\['home','flowers','rain'\]\)/);
  assert.match(comp, /!MAPS\[activity\[id\]\.map\]\.interior&&!DRY_IN_RAIN\.has\(id\)/);
  assert.match(comp, /原来这条只挪林地那几格/);
});

// 走到那儿才有那颗按钮，缺什么写在按钮上
test("修这件事发生在那个地方，不在行动栏里常驻", () => {
  assert.match(world, /export function workHere\(s\)/);
  assert.match(game, /const id=workHere\(data\),b=\$\('fix-place'\)/);
  assert.match(game, /b\.textContent=short\.length\?w\.label\+'（还差'\+short\.join\('、'\)\+'）':'修好'\+w\.label/);
  assert.match(game, /\$\('fix-place'\)\.onclick=\(\)=>\{const id=workHere\(data\);/);
  // 走到了要重算一次行动栏，不然她站在那儿也看不见
  assert.match(game, /if\(task\)\{const k=task;task=null;beginAction\(k\);\}else \{ui\(\);arriveSpot\(\);\}/);
});

// 「还差什么」只算一处
test("缺什么只有一处答案", () => {
  assert.match(world, /export function workShort\(s, id\)/);
  assert.match(game, /short:workShort\(data,id\)/);
  assert.match(host, /还差" \+ w\.short\.join\("、"\)/);
  assert.doesNotMatch(host, /WORK_NEEDS|workHave/, "手机这一侧不许自己再算一遍");
});

// 整条链一枪不打
test("修东西不花一分钱", () => {
  const seg = world.slice(world.indexOf("// ── 修好的地方"), world.indexOf("export const takeError"));
  assert.doesNotMatch(seg, /callAI|host\.|await /);
});
