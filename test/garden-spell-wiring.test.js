"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");
const html = rd("apps/fairy-garden/index.html");
const rules = rd("apps/fairy-garden/rules.js");

// 她 2026-09-17：「我可以 cast spell 的那种」
test("念咒在许愿树下，那棵树原来只是个景", () => {
  assert.match(rules, /cast:\{x:0,z:-4\.9\}/, "站位就是那棵树");
  assert.match(world, /if\(kind==='cast'\)return s\.map!=='forest'/);
  assert.match(html, /id="cast-dialog"/);
  assert.match(game, /\$\('cast'\)\.onclick=\(\)=>request\('cast'\)/);
  assert.match(world, /cast:'念一个咒'/, "日记里也要认得这一趟");
});

// ⚠️施法整条链一枪不打：封进去之后那句话是碎片自己的原文
test("念咒不花一分钱", () => {
  const seg = world.slice(world.indexOf("// ── 念咒"), world.indexOf("// ── 星井（下潜）"));
  assert.doesNotMatch(seg, /callAI|host\.|await /);
  assert.match(seg, /一枪都不打/);
  const fn = game.slice(game.indexOf("function openCast()"), game.indexOf("$('cast-close')"));
  assert.doesNotMatch(fn, /host\.|callAI/);
});

// ⚠️烧掉「那天他在楼下等你」去换一场雨，感觉是坏的，也违背这库最深的一条
test("施法不烧掉碎片，只是把它封进世界里", () => {
  assert.match(world, /施法【不烧掉那片碎片】/);
  assert.match(world, /东西不会凭空没了/);
  // 封出去的还读得到：桥上要递出去，册子里要显示
  assert.match(game, /casts:\(data\.casts\|\|\[\]\)\.map/);
  assert.match(host, /"封出去的"/);
});

// 那场戏的分量：唤醒种子是全库唯一真的双人动作，留着，只是醒来的东西换了
test("种子那场戏留着，醒来的多了一个咒", () => {
  assert.match(world, /醒来的不只是一颗种子，还有【一个咒】/);
  assert.match(world, /if\(kind==='seed'\)\{if\(!companionNearby\(s\)\)return s;/, "他不在旁边就唤不醒，这一层不许动");
  assert.match(game, /醒来的还有一个咒：/);
});

// 封在哪儿，走到了就该听见
test("走到封过咒的地方会说出那一句", () => {
  assert.match(game, /const SPELL_SPOT=\{/);
  assert.match(game, /const line=where\?castLine\(data,where\):''/);
  assert.match(game, /封在这一处的那片碎片，走到了就该听见/);
});

// ⚠️点不了的地方要说清【为什么】：不然「灯下」灰着，她只会以为坏了
test("封不进去的地方要说明白为什么", () => {
  const fn = game.slice(game.indexOf("function openCast()"), game.indexOf("$('cast-close')"));
  assert.match(fn, /locked=castPlaceError\(data,key\)/);
  assert.match(fn, /b\.textContent=taken\?label\+'（封着了）':locked\?label\+'（还不行）':label/);
  assert.match(fn, /if\(locked\)b\.onclick=\(\)=>say\(locked\)/, "灰着还得点得出那句解释");
});

// 灯不是终点，是一处能封咒的地方——这就是那个四盏灯天花板的拆法
test("灯把魔法那条线接进了别的线", () => {
  assert.match(world, /这就是那个四盏灯天花板的拆法/);
  assert.match(world, /屋前那几盏是星铃灯做出来的（月光花那条）/);
  assert.match(world, /小路那盏是委托修好的（公告栏那条）/);
});

// 月露原来唯一的用处是代替一壶水浇花，谁都不会特地去炼
test("月露进锅那一路接上了", () => {
  assert.match(world, /export function hastenThing\(s, id\)/);
  assert.match(game, /hasten:id=>\{const err=hastenError\(data,id\)/);
  assert.match(host, /g\.hasten\(t\.id\)/);
  assert.match(host, /倒一滴月露 · 今天就开/);
  // 没月露的时候按钮要自己说，不是点了才报错
  assert.match(host, /倒一滴月露（没有月露了）/);
});
