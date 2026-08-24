"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const Gate=require("../js/inner-life-promotion-gate.js");

test("A 只有观察窗、样本、类型、未命中和封顶全部过线才可试点",()=>{
  const ok=Gate.evaluateA({sampleCount:40,spanHours:80,unmatchedMoodCount:4,clippedCount:4,dimensionCounts:{warmth:20,hurt:8,fatigue:4}});
  assert.equal(ok.ready,true);assert.equal(ok.metrics.unmatchedRate,.1);
  const bad=Gate.evaluateA({sampleCount:40,spanHours:80,unmatchedMoodCount:20,clippedCount:0,dimensionCounts:{warmth:40}});
  assert.equal(bad.ready,false);assert.ok(bad.blockers.some(x=>x.includes("未识别")));assert.ok(bad.blockers.some(x=>x.includes("3 类")));
});

test("A 新词典样本不足不会拿旧样本凑数",()=>{
  const r=Gate.evaluateA({sampleCount:5,legacySampleCount:100,spanHours:100,unmatchedMoodCount:0,clippedCount:0,dimensionCounts:{warmth:2,hurt:2,fatigue:1}});
  assert.equal(r.ready,false);assert.ok(r.blockers.some(x=>x.includes("20 轮")));
});

test("E 铁律违规时绝不放行，夜巡缺口只限制试点范围",()=>{
  const base={diagnostics:30,spanHours:90,kinds:{packet_created:5,would_surface:3},invariants:{sessionOpenWoke:0,writesExperience:0},nightWatchCoverage:"waiting_for_cloud_tidal_row"};
  const ok=Gate.evaluateE(base);assert.equal(ok.ready,true);assert.equal(ok.scope,"app_foreground_only");assert.equal(ok.nightWatchPending,true);
  assert.equal(Gate.evaluateE({...base,invariants:{sessionOpenWoke:1,writesExperience:0}}).ready,false);
  assert.equal(Gate.evaluateE({...base,invariants:{sessionOpenWoke:0,writesExperience:1}}).ready,false);
});

test("没有达标报告不能武装试点",()=>{
  const result=Gate.armPilot("A","char-1",{ready:false,blockers:["样本不足"]});
  assert.equal(result.ok,false);assert.equal(result.reason,"not_ready");
});

test("E 全角色授权仍必须先通过机械审计",()=>{
  assert.equal(Gate.armAllE({ready:false,blockers:["观察不足"]}).ok,false);
  assert.equal(Gate.armAllE({ready:true,metrics:{diagnostics:40}}).ok,true);
});

test("E 全角色授权用通配闸生效，仍可单独撤销某个角色",()=>{
  const values=new Map(),fake={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const old=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  Object.defineProperty(globalThis,"localStorage",{value:fake,configurable:true});
  try{
    assert.equal(Gate.armAllE({ready:true,metrics:{diagnostics:40}}).ok,true);
    assert.equal(Gate.state("E","char-a").mode,"pilot");
    assert.equal(Gate.state("E","char-b").mode,"pilot");
    Gate.disarm("E","char-a");
    assert.equal(Gate.state("E","char-a").mode,"shadow");
    assert.equal(Gate.state("E","char-b").mode,"pilot");
  }finally{
    if(old)Object.defineProperty(globalThis,"localStorage",old);else delete globalThis.localStorage;
  }
});
