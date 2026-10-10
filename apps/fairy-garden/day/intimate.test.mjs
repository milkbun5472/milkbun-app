import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{MAPS,segmentClear,walkable}=await import('../world.mjs'),{buildSpace,registerCoreSpaces}=await import('./spaces.mjs'),{togetherPlans,createTogether}=await import('./together.mjs');
const {registerDayPlaces}=await import('./places/index.mjs');registerCoreSpaces(MAPS);registerDayPlaces(MAPS);
const social=globalThis.CharDaySocial,origin={a:{x:0,z:3.3},b:{x:0,z:4.8}};
test('亲密互动沿同一地点策略，工作/试玩/装修不会成为约会入口',()=>{
 assert.equal(Object.keys(social.intimate).length,10);
 const home=social.setting({presentation:{map:'dayHome'},slot:{type:'home'}});assert.equal(home.actions.filter(p=>p.intimate).length,10);
 for(const map of ['dayCafe','dayStreet','dayLibrary','dayGym','dayMarket','dayStation']){
  assert.ok(social.setting({presentation:{map},slot:{type:'out'}}).actions.some(p=>p.intimate));
  assert.equal(social.setting({presentation:{map},slot:{type:'work'}}),null);
 }
 for(const state of [{editing:true},{preview:true},{showcase:true}])assert.equal(social.setting({...state,presentation:{map:'dayHome'}}),null);
 for(const map of ['dayOffice','dayCampus','dayLaboratory'])assert.equal(social.setting({presentation:{map},slot:{type:'work'}}),null);
 assert.equal(social.automaticSetting({presentation:{map:'dayHome'},slot:{type:'sleep'}}),false);
});
test('两位发起方都沿真实路径走到位置，背后抱的朝向随发起方对换',()=>{
 MAPS.dayHome=buildSpace('dayHome');
 for(const kind of Object.keys(social.intimate))for(const initiator of ['a','b']){
  const plans=togetherPlans(MAPS.dayHome,kind,origin,{initiator});assert.ok(plans.length,kind+' '+initiator);
  const plan=plans[0];for(const who of ['a','b']){let from=origin[who];for(const to of plan[who+'Route']){assert.ok(segmentClear(from,to,'dayHome'),kind);assert.ok(walkable(to.x,to.z,'dayHome'));from=to;}}
  if(kind==='back-hug'){const donor=plan[initiator],receiver=plan[initiator==='a'?'b':'a'];assert.ok((receiver.x-donor.x)*Math.sin(plan.heading)+(receiver.z-donor.z)*Math.cos(plan.heading)>.4);}
 }
});
test('搂抱与喂食认实际家具，转动移动后仍接到同一坐垫，收纳后拒绝',()=>{
 for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  MAPS.dayHome=buildSpace('dayHome',{sofa:{x:-3,z:1.4,heading}});
  for(const kind of ['cuddle','feed']){const p=togetherPlans(MAPS.dayHome,kind,origin)[0];assert.ok(p);assert.equal(p.seats.a.heading,heading);assert.equal(p.seats.a.piece,'sofa');assert.equal(p.seats.b.piece,'sofa');}
 }
 MAPS.dayHome=buildSpace('dayHome',Object.fromEntries(['sofa','dining-table','coffee-table'].map(id=>[id,{stored:true}])));
 for(const kind of ['cuddle','feed'])assert.equal(togetherPlans(MAPS.dayHome,kind,origin).length,0);
});
test('靠近半路取消交还当前位置，所有亲密道具在到位前保持隐藏',()=>{
 MAPS.dayHome=buildSpace('dayHome');const actor=()=>({root:new T.Group(),animate(){},contactPose(){}}),a=actor(),b=actor(),scene=new T.Scene();scene.add(a.root,b.root);
 for(const kind of Object.keys(social.intimate)){
  let returned;const controller=createTogether({a,b,map:()=>MAPS.dayHome,from:()=>origin,onStop:s=>returned=s});assert.equal(controller.start(kind,{initiator:'a'}).ok,true);controller.tick(.02,0);const before=controller.inspect();
  assert.equal(scene.getObjectByName('TogetherSpoon').visible,false);assert.equal(controller.stop(),true);assert.deepEqual(returned.a,before.a);assert.deepEqual(returned.b,before.b);assert.equal(controller.inspect(),null);assert.equal(returned.seats?.b||null,null);
 }
});

test('六个外出地点的亲密动作按各自真实地面与家具规划双方路线',()=>{
 for(const [id,scene]of Object.entries(social.scenes).filter(([id])=>id!=='dayHome'))for(const kind of scene.actions.filter(k=>social.intimate[k]))for(const initiator of ['a','b']){
  const map=MAPS[id],from={a:{x:map.spawn.x,z:map.spawn.z-1.4},b:{...map.spawn}},p=togetherPlans(map,kind,from,{initiator})[0];assert.ok(p,id+':'+kind+':'+initiator);
  for(const who of ['a','b']){let previous=from[who];for(const q of p[who+'Route']){assert.ok(segmentClear(previous,q,id),id+':'+kind);previous=q;}}
  if(p.seats)assert.ok(map.furniture.some(f=>f.id===p.seats.a.piece));
 }
});
