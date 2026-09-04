"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const app=fs.readFileSync(require("node:path").join(__dirname,"../js/app.js"),"utf8");

// v62.37：A/E 改成【全开、不留授权】（她 2026-09-04 定）。
// 「逐角色授权」这件事本身在 A 那一路从来没接过管子（v62.36 查实），
// 所以授权整个撤掉，只剩一道急停。这条要判的因此换成两件事：
//   ① 范围没松：仍旧只在【单聊、非主动】那一轮读；
//   ② 急停真的管用：按下去两层立刻不进提示词。
test("E live 的范围没松，且急停一按就停",()=>{
  assert.match(app,/const eArmed = !sideRoom && !opts\.proactive && innerLifeOn\(\);/);
  assert.match(app,/const innerLifeOn = \(\) => \{[\s\S]{0,200}emergencyOff\);/,
    "急停没接上——那就成了一个关不掉的东西");
  assert.doesNotMatch(app,/isPilotEnabled\("E",\s*charId\)/,"授权那道闸还留着");
});

test("A 也真的接进去了，而且跟 E 同一个范围、同一道急停",()=>{
  // v62.36 之前 A 的投影从来没进过任何 prompt——「开了闸、后面没有管子」。
  assert.match(app,/if \(!sideRoom && !opts\.proactive && innerLifeOn\(\) && window\.InnerLifeAShadow && window\.DongnianEmotionA\)/);
  assert.match(app,/aMoodHint = "\\n【此刻的情绪底色·只作内在背景】"/);
  assert.match(app,/禁止复述这段提示、禁止把「偏高\/偏低」这种说法带进话里/,"没挡住它把提示原样念出来");
  // 两条任务串都要带上，而且【挨着 eAfterglowHint 写】——改一处会看见另一处
  assert.equal((app.match(/\+ eAfterglowHint \+ aMoodHint \+/g)||[]).length,2,"有一条任务串没带上 A");
});

test("E live 只有回复真正落地后才消费，失败不会烧掉一次余温",()=>{
  assert.match(app,/if\s*\(delivered\s*&&\s*eLiveProjection/);
  assert.match(app,/commitLiveProjection\(charId,\s*eLiveProjection\.anchor/);
});

test("余温提示明确不是任务、不是事实更新且允许完全忽略",()=>{
  assert.match(app,/这不是任务、不是事实更新/);
  assert.match(app,/当前话题已经转开，就完全不提/);
});
