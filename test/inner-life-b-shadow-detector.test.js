"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const {DongnianEmotionA:Core}=require("../js/dongnian.js");
const B=require("../js/inner-life-b-shadow.js");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");

// v64.26 起【出厂就是关的】：试点名单空着，pilotFor 对谁都返回 null，
// 所以整条 observe 一行模型调用都不发（她 2026-09-06 定的——B 是唯一每轮真发一次
// callAI 的影子层，产出只进一个她从没打开过的面板，而她按次计费）。
//
// ⚠️但那台机器本身没删，想再开只是把 id 填回名单。所以【机器还得测】：
//   下面这一份是把源码里那行名单换掉之后单独跑起来的一个实例，
//   专测「真开着的时候它还对不对」；出厂那一份用上面的 B，专测「它确实是关的」。
//   只留一半都是错的：只测关着的＝机器烂了没人知道；只测开着的＝哪天悄悄开回来也没人知道。
const BOn = (() => {
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "inner-life-b-shadow.js"), "utf8");
  const PIL = '{"char_1783061729716":["continuity","neglect","boundary","seriousness"],"char_1783354607122":["identity","continuity","boundary","neglect"]}';
  assert.equal((src.match(/const PILOTS=Object\.freeze\(\{\}\);/g) || []).length, 1, "出厂名单不是空的了？那这一层又在花钱");
  const on = src.replace("const PILOTS=Object.freeze({});", "const PILOTS=Object.freeze(" + PIL + ");");
  // ⚠️必须跑在【同一个 realm】里（runInThisContext，不是 runInNewContext）：
  //   新 context 里造的数组是另一套 Array.prototype，deepEqual(strict) 会判成
  //   「结构一样但不是同一个引用」；而且模块认的 root 会变成那个假 globalThis，
  //   下面几条往 globalThis 上挂 InnerLifeAShadow 的桩它就读不到了。
  const mod = { exports: {} };
  vm.runInThisContext("(function(module){" + on + "\n})")(mod);
  delete globalThis.InnerLifeBShadow;   // 别把出厂那一份挤掉
  return mod.exports;
})();

const msgs=[
  {role:"user",mid:"u1",content:"我刚才只是开玩笑啦"},
  {role:"assistant",mid:"a1",content:"我知道，你逗我呢"},
  {role:"user",mid:"u2",content:"我会认真听完你的边界，不再继续推你"}
];

test("出厂就是关的：名单空着，谁都不是试点",()=>{
  [{id:"char_1783061729716",name:"沈屿白"},{id:"char_1783354607122",name:"顾暮"},{id:"4",name:"阿屿"}]
    .forEach(c=>assert.equal(B.pilotFor(c),null,c.name+" 还在试点名单上——这一层每轮要多花一次调用"));
});

test("真开回来的话：试点按稳定角色 ID 锁定，改昵称不掉线，小克不接",()=>{
  assert.deepEqual(BOn.pilotFor({id:"char_1783061729716",name:"沈屿白"}).enabledAxes,["continuity","neglect","boundary","seriousness"]);
  assert.deepEqual(BOn.pilotFor({id:"char_1783354607122",name:"顾暮的新备注"}).enabledAxes,["identity","continuity","boundary","neglect"]);
  assert.equal(BOn.pilotFor({id:"3",name:"小克"}),null);
  assert.equal(BOn.pilotFor({id:"4",name:"阿屿"}),null);
});

test("检测请求只带最近真实消息、试点轴和已批准性情",()=>{
  const char={id:"char_1783061729716",name:"沈屿白"},pilot=BOn.pilotFor(char),state=Core.createState("h",1);
  state.emotion.temperament=Core.temperamentFromAnchors(["黏人","敏感"],true);
  const spec=BOn.detectorSpec(char,pilot,state,msgs.concat({role:"system",content:"内部提示"}));
  const payload=JSON.parse(spec.messages[0].content);
  assert.equal(spec.maxTokens,8000);
  assert.deepEqual(payload.enabledAxes,pilot.enabledAxes);
  assert.deepEqual(payload.role.temperament,["黏人","敏感"]);
  assert.equal(payload.messages.some(x=>x.text.includes("内部提示")),false);
});

test("detector 输出必须逐字证据有效，坏 quote 和未启用轴被丢弃",()=>{
  const raw={events:[
    {axis:"boundary",kind:"repair_progress",confidence:.9,explicitRelationMeaning:true,playfulContext:false,repairKind:"behavior_changed",evidenceMessageIds:["u2"],evidenceQuotes:["认真听完你的边界"]},
    {axis:"boundary",kind:"harm",confidence:.9,explicitRelationMeaning:true,playfulContext:false,repairKind:null,evidenceMessageIds:["u1"],evidenceQuotes:["原文没有这句"]},
    {axis:"identity",kind:"harm",confidence:.9,explicitRelationMeaning:true,playfulContext:false,repairKind:null,evidenceMessageIds:["u1"],evidenceQuotes:["只是开玩笑"]}
  ]};
  const out=BOn.validateEvents(raw,["boundary"],msgs);
  assert.equal(out.length,1);assert.equal(out[0].axis,"boundary");assert.deepEqual(out[0].evidenceMessageIds,["u2"]);
});

test("observe 串行写进同一 A 状态行，但不改十维情绪",async()=>{
  let row=null,calls=0,diagnostics=0;
  globalThis.DongnianEmotionA=Core;
  globalThis.InnerLifeAShadow={hash:x=>"h_"+x,get:async()=>row,put:async(_o,_c,next)=>(row=structuredClone(next)),addRelationDiagnostic:async()=>{diagnostics++;}};
  const char={id:"char_1783061729716",name:"沈屿白"},before=Core.createState("h_ayu",1).emotion.current;
  const result=await BOn.observe({ownerId:"owner",char,messages:msgs,runDetector:async()=>{calls++;return {events:[{axis:"boundary",kind:"harm",confidence:1,explicitRelationMeaning:true,playfulContext:false,repairKind:null,evidenceMessageIds:["u2"],evidenceQuotes:["不再继续推你"]}]};}});
  assert.equal(calls,1);assert.equal(diagnostics,1);assert.equal(result.saved,true);assert.ok(row.relationAxes);assert.deepEqual(row.emotion.current,before);
});

test("非试点完全不调用 detector",async()=>{
  let calls=0;
  const out=await BOn.observe({ownerId:"owner",char:{id:"ke",name:"小克"},messages:msgs,runDetector:async()=>{calls++;return {};}});
  assert.equal(out.skipped,true);assert.equal(calls,0);
});

test("出厂那一份：连原来在名单上的那两位也一行调用都不发",async()=>{
  let calls=0;
  for (const id of ["char_1783061729716","char_1783354607122"]) {
    const out=await B.observe({ownerId:"owner",char:{id,name:"某人"},messages:msgs,runDetector:async()=>{calls++;return {};}});
    assert.deepEqual(out,{skipped:true});
  }
  assert.equal(calls,0,"还在发模型调用");
});

test("detector 失败只记无正文失败诊断，不向外抛错",async()=>{
  let diagnostic=null;
  globalThis.DongnianEmotionA=Core;
  globalThis.InnerLifeAShadow={hash:x=>"h_"+x,get:async()=>null,put:async()=>null,addRelationDiagnostic:async(_o,_c,input)=>{diagnostic=input;}};
  const out=await BOn.observe({ownerId:"owner",char:{id:"char_1783354607122",name:"顾暮"},messages:msgs,runDetector:async()=>{throw new Error("secret raw response");}});
  assert.equal(out.saved,false);assert.equal(out.error,"B shadow detector failed");assert.equal(diagnostic.detectorFailed,true);assert.equal(JSON.stringify(diagnostic).includes("secret raw response"),false);
});
