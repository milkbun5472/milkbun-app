"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const app=fs.readFileSync(require("node:path").join(__dirname,"../js/app.js"),"utf8");

// v62.37：A/E 改成【全开、不留授权】（她 2026-09-04 定）。
// 「逐角色授权」这件事本身在 A 那一路从来没接过管子（v62.36 查实），
// 所以授权整个撤掉，只剩一道急停。这条要判的因此换成两件事：
//   ① 范围没松：仍旧只在【单聊、非主动】那一轮读；
//   ② 急停真的管用：按下去立刻不进提示词。
// ⚠️A 从 v62.39 起【不在这个文件里判】——它挪去了 buildBundle，八处一起喂，
//   归 test/a-mood-eight-surfaces-62-39.test.js 管。这里只剩 E。
test("E live 的范围没松，且急停一按就停",()=>{
  assert.match(app,/const eArmed = !sideRoom && !opts\.proactive && innerLifeOnFor\(charId\);/);
  assert.match(app,/const innerLifeOnFor = charId => \{[\s\S]{0,240}emergencyOff\);/,
    "急停没接上——那就成了一个关不掉的东西");
  assert.doesNotMatch(app,/isPilotEnabled\("E",\s*charId\)/,"授权那道闸还留着");
});

test("E live 只有回复真正落地后才消费，失败不会烧掉一次余温",()=>{
  assert.match(app,/if\s*\(delivered\s*&&\s*eLiveProjection/);
  assert.match(app,/commitLiveProjection\(charId,\s*eLiveProjection\.anchor/);
});

test("余温提示明确不是任务、不是事实更新且允许完全忽略",()=>{
  assert.match(app,/这不是任务、不是事实更新/);
  assert.match(app,/当前话题已经转开，就完全不提/);
});
