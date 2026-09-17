"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const comp = rd("apps/fairy-garden/companion.mjs");
const host = rd("js/fairy-garden.js");

// 她 2026-09-17：「让 a 做邻居然后邀请 a 同行就会变成有两个」
test("同行者是谁，世界这边必须知道", () => {
  assert.match(game, /data\.partnerId=boundPartner\?String\(boundPartner\.id\):'';/);
  assert.match(game, /if\(data\.partnerId&&neighborOf\(data,data\.partnerId\)\)data=moveOut\(data,data\.partnerId\);/);
  assert.match(world, /partnerId:typeof d\.partnerId==='string'\?d\.partnerId\.slice\(0,64\):''/);
  assert.match(game, /moveInError 里那句「TA 已经和你住在一起了」一次都没响过/);
});

// 她 2026-09-17：「改变同行应该是只能从邻居里面选」
test("住在村里的那几位排在选人那一页前面", () => {
  assert.match(host, /住在村里的那几位排在前面/);
  assert.match(host, /live\.includes\(String\(c\.id\)\) \? " · 住在村里" : ""/);
  assert.match(host, /不是把别人挡掉：新存档村里一个人都没有/);
});

// 她 2026-09-17：「邀请邻居的话改不了外貌」
test("住在村里的那几位走的是同一套换样貌", () => {
  assert.match(game, /const n=neighborOf\(data,who\);/);
  assert.match(game, /if\(x\)x\.avatar\.setLook\(look\);/);
  assert.match(game, /给邻居另写一套，六根滑杆那条链就活在两处了/);
  // 同一份 merge：浅合并会把另外五根滑杆打回中性
  const fn = game.slice(game.indexOf(" setLook:(who,look)=>"), game.indexOf(" applyAction:"));
  assert.equal((fn.match(/const merge=/g) || []).length, 1, "merge 只许有一份");
  assert.match(game, /\.\.\.Object\.fromEntries\(restoreNeighbors\(data\.neighbors\)\.map\(n=>\[String\(n\.charId\),\{\.\.\.\(n\.look\|\|\{\}\)\}\]\)\)/);
  assert.match(host, /\.\.\.\(\(\(crew && crew\.rows\) \|\| \[\]\)\.map\(n => \[String\(n\.charId\), n\.name\]\)\)/);
  assert.match(host, /onClick: \(\) => \{ pullLook\(\); pullGarden\(\); setDress\(true\); \}/, "开样貌页之前要先有邻居名单");
});

// 她 2026-09-17：「地图太大走路太慢了」
test("脚步跟着地方的大小走，只写在一处", () => {
  assert.match(world, /export const walkSpeedFor = map =>/);
  assert.match(world, /世界大了四倍腿没跟上/);
  assert.match(game, /walkSpeed:walkSpeedFor\(data\.map\)/);
  assert.match(comp, /walkSpeed:walkSpeedFor\(c\.map\)\*\.79/, "他那一档一直是她的 .79，村子变大也照这个比例");
  assert.doesNotMatch(game, /walkSpeed:[\d.]/, "不许在游戏那边给玩家单独调快，不然他永远跟不上");
});
