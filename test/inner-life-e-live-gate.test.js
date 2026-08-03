"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const app=fs.readFileSync(require("node:path").join(__dirname,"../js/app.js"),"utf8");

test("E live 只在逐角色授权后读取，主动消息不注入",()=>{
  assert.match(app,/!opts\.proactive\s*&&\s*window\.InnerLifePromotionGate/);
  assert.match(app,/isPilotEnabled\("E",\s*charId\)/);
});

test("E live 只有回复真正落地后才消费，失败不会烧掉一次余温",()=>{
  assert.match(app,/if\s*\(delivered\s*&&\s*eLiveProjection/);
  assert.match(app,/commitLiveProjection\(charId,\s*eLiveProjection\.anchor/);
});

test("余温提示明确不是任务、不是事实更新且允许完全忽略",()=>{
  assert.match(app,/这不是任务、不是事实更新/);
  assert.match(app,/当前话题已经转开，就完全不提/);
});
