import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{MAPS,segmentClear}=await import('../world.mjs'),{buildSpace}=await import('./spaces.mjs'),{createTogether,togetherPlans}=await import('./together.mjs');
const actor=()=>{const root=new T.Group();for(const name of ['Right_hand','Left_hand','HeadAnchor']){const child=new T.Group();child.name=name;child.position.y=1;root.add(child);}return {root,animate(_time,pose){this.pose=pose;root.position.y=pose.height;},contactPose(pose){this.contact=pose;}};};
test('六种双人活动沿原地图寻路，到位才做动作，取消交还位置',()=>{
 MAPS.dayHome=buildSpace('dayHome');
 for(const kind of ['hand','hug','shoulder','read','meal','cook']){
  const a=actor(),b=actor(),origin={a:{x:0,z:3.3},b:{x:0,z:4.8}},events=[];
  const controller=createTogether({a,b,map:()=>MAPS.dayHome,from:()=>origin,onUpdate:s=>events.push(s?.phase),onStop:s=>events.push(s.reason)});
  assert.equal(controller.start(kind).ok,true,kind);assert.notEqual(controller.inspect().phase,'active');
  for(let i=0;i<2500&&controller.inspect()?.phase!=='active';i++)controller.tick(.02,i*.02);
  assert.equal(controller.inspect()?.phase,'active',kind);controller.tick(.02,60);
  const s=controller.inspect(),ap=s.seats?.a||s.a,bp=s.seats?.b||s.b;assert.ok(Math.hypot(ap.x-bp.x,ap.z-bp.z)>=(['hug','shoulder','hand'].includes(kind)?.32:.65),kind);
  if(['read','meal'].includes(kind))assert.ok(a.pose.task.daily&&b.pose.task.daily);
  if(kind==='cook')assert.equal(a.pose.task.kind,'cook');
  assert.equal(controller.stop(),true);assert.equal(controller.inspect(),null);
 }
});
test('转动与收纳后的家具决定共同活动位置，无家具不报告成功',()=>{
 for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  MAPS.dayHome=buildSpace('dayHome',{sofa:{x:-3,z:1.4,heading}});const choices=togetherPlans(MAPS.dayHome,'read',{a:{x:0,z:3.3},b:{x:0,z:4.8}});assert.ok(choices.length);assert.equal(choices[0].seats.a.heading,heading);
  for(const who of ['a','b']){let from=who==='a'?{x:0,z:3.3}:{x:0,z:4.8};for(const to of choices[0][who+'Route']){assert.ok(segmentClear(from,to,'dayHome'));from=to;}}
 }
 MAPS.dayHome=buildSpace('dayHome',{sofa:{stored:true},kitchen:{stored:true},'partner-chair':{stored:true}});
 for(const kind of ['shoulder','read','meal','cook'])assert.equal(togetherPlans(MAPS.dayHome,kind,{a:{x:0,z:3.3},b:{x:0,z:4.8}}).length,0,kind);
});
test('互动路段被家具阻挡时中止，坐位和动作不提前提交',()=>{
 MAPS.dayHome=buildSpace('dayHome');const controller=createTogether({a:actor(),b:actor(),map:()=>MAPS.dayHome,from:()=>({a:{x:0,z:3.3},b:{x:0,z:4.8}})});
 assert.equal(controller.start('meal').ok,true);MAPS.dayHome.obstacles.push({x:0,z:3.3,w:3,d:3});controller.tick(.02,0);assert.equal(controller.inspect(),null);
});

test('街灯旁开始两种散步会走到可转身的空位，沿短路真实同行，脚步不穿灯座',()=>{
 MAPS.dayStreet=buildSpace('dayStreet');
 for(const kind of ['walk','arm-walk']){
  const origin={a:{x:1.1453906063665442,z:3.9618967640335208},b:{x:1.1453906063665442,z:4.486216777146543}},controller=createTogether({a:actor(),b:actor(),map:()=>MAPS.dayStreet,from:()=>origin});
  assert.equal(controller.start(kind).ok,true);
  for(let i=0;i<3000&&controller.inspect()?.phase!=='active';i++)controller.tick(.02,i*.02);
  assert.equal(controller.inspect()?.phase,'active');let previous=controller.inspect(),travel=0;
  for(let i=0;i<900;i++){controller.tick(.02,70+i*.02);const next=controller.inspect();assert.ok(next);for(const who of ['a','b']){assert.ok(segmentClear(previous[who],next[who],'dayStreet'));travel+=Math.hypot(previous[who].x-next[who].x,previous[who].z-next[who].z);}const gap=Math.hypot(next.a.x-next.b.x,next.a.z-next.b.z);assert.ok(gap>.45&&gap<.75);previous=next;}
  assert.ok(travel>2);assert.ok(previous.tour.round>0);controller.stop();
 }
});
