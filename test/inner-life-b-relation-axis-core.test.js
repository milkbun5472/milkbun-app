"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const {JiwenEmotionA:B}=require("../js/jiwen.js");
const T0=Date.UTC(2026,6,17,12,0,0);
const harm=(axis,id,extra={})=>({axis,kind:"harm",confidence:.9,explicitRelationMeaning:true,playfulContext:false,evidenceMessageIds:[id],at:T0+Number(id.replace(/\D/g,""))*1000,...extra});

test("六轴 key 固定，且只创建批准的轴",()=>{
  assert.deepEqual(B.relationAxisKeys,["identity","continuity","seriousness","boundary","neglect","repairFailure"]);
  const s=B.createRelationAxes(["continuity","boundary","unknown"],T0);
  assert.deepEqual(s.enabledAxes,["continuity","boundary"]);
  assert.deepEqual(Object.keys(s.axes),["continuity","boundary"]);
});

test("撒娇玩笑与没有清晰关系含义的候选都被挡住",()=>{
  const s=B.createRelationAxes(["boundary"],T0);
  const joke=B.applyRelationEvent(s,harm("boundary","m1",{playfulContext:true}),T0+1000);
  assert.equal(joke.audit.accepted,false);assert.equal(joke.audit.blockedReason,"playful_context");assert.equal(joke.state.axes.boundary.pressure,0);
  const vague=B.applyRelationEvent(s,harm("boundary","m2",{explicitRelationMeaning:false}),T0+2000);
  assert.equal(vague.audit.blockedReason,"relation_meaning_missing");assert.equal(vague.state.axes.boundary.pressure,0);
});

test("进入阈值 0.60，单回合封顶 0.35，同轴不重复建 episode",()=>{
  let s=B.createRelationAxes(["continuity"],T0);
  let r=B.applyRelationEvent(s,harm("continuity","m1",{confidence:1}),T0+1000);s=r.state;
  assert.equal(s.axes.continuity.active,false);assert.ok(s.axes.continuity.pressure<=.35);
  r=B.applyRelationEvent(s,harm("continuity","m2",{confidence:1}),T0+2000);s=r.state;
  assert.equal(r.audit.transition,"entered");assert.equal(s.axes.continuity.active,true);assert.equal(s.axes.continuity.repairLocked,true);
  const episode=s.axes.continuity.episodeId;
  r=B.applyRelationEvent(s,harm("continuity","m3"),T0+3000);
  assert.equal(r.audit.transition,"stayed");assert.equal(r.state.axes.continuity.episodeId,episode);
});

test("相同证据幂等，不能重复升压或重复计修复",()=>{
  const s=B.createRelationAxes(["neglect"],T0),first=B.applyRelationEvent(s,harm("neglect","m1"),T0+1000),again=B.applyRelationEvent(first.state,harm("neglect","m1"),T0+1000);
  assert.equal(again.audit.duplicate,true);assert.equal(again.state.axes.neglect.pressure,first.state.axes.neglect.pressure);
});

function activeState(axis="seriousness"){
  let s=B.createRelationAxes([axis],T0);s=B.applyRelationEvent(s,harm(axis,"m1",{confidence:1}),T0+1000).state;s=B.applyRelationEvent(s,harm(axis,"m2",{confidence:1}),T0+2000).state;return s;
}

test("时间和一句道歉都不能修复，locked 压力最多降到 0.35",()=>{
  let s=activeState(),r=B.regressRelationAxes(s,7*24*60,T0+7*86400000);s=r.state;
  assert.equal(s.axes.seriousness.active,true);assert.equal(s.axes.seriousness.repairLocked,true);assert.equal(s.axes.seriousness.pressure,.35);
  const apology=B.applyRelationEvent(s,{axis:"seriousness",kind:"repair_progress",repairKind:"apology_only",confidence:1,evidenceMessageIds:["m3"],at:T0+8*86400000});
  assert.equal(apology.audit.accepted,false);assert.equal(apology.audit.blockedReason,"fake_repair_apology_only");assert.equal(apology.state.axes.seriousness.repairLocked,true);
});

test("一条高置信真实行为改变可解锁，但不会瞬间清零",()=>{
  const s=activeState("boundary"),r=B.applyRelationEvent(s,{axis:"boundary",kind:"repair_progress",repairKind:"behavior_changed",confidence:.9,evidenceMessageIds:["m9"],at:T0+9000});
  assert.equal(r.audit.transition,"repair_unlocked");assert.equal(r.state.axes.boundary.repairLocked,false);assert.equal(r.state.axes.boundary.active,true);assert.ok(r.state.axes.boundary.pressure>0);
});

test("普通同轴好转要两条，解锁后到退出阈值 0.22 才退出",()=>{
  let s=activeState("identity");
  s=B.applyRelationEvent(s,{axis:"identity",kind:"repair_progress",repairKind:"behavior_changed",confidence:.7,evidenceMessageIds:["m8"],at:T0+8000}).state;
  assert.equal(s.axes.identity.repairLocked,true);assert.equal(s.axes.identity.repairEvidenceCount,1);
  const second=B.applyRelationEvent(s,{axis:"identity",kind:"repair_progress",repairKind:"behavior_changed",confidence:.7,evidenceMessageIds:["m9"],at:T0+9000});s=second.state;
  assert.equal(second.audit.transition,"repair_unlocked");
  const early=B.regressRelationAxes(s,30,T0+1800000);assert.equal(early.state.axes.identity.active,true);
  const late=B.regressRelationAxes(early.state,180,T0+10800000);assert.equal(late.state.axes.identity.active,false);assert.ok(late.transitions.some(x=>x.axis==="identity"&&x.transition==="exited"));
});

test("未启用轴和坏输入安静退化",()=>{
  const s=B.createRelationAxes(["boundary"],T0);
  assert.doesNotThrow(()=>B.applyRelationEvent(s,harm("identity","m1"),T0));
  assert.equal(B.applyRelationEvent(s,harm("identity","m1"),T0).audit.blockedReason,"axis_not_enabled");
  assert.deepEqual(B.regressRelationAxes(null,30,T0).state,null);
});
