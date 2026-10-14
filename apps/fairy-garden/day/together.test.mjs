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
test('换掌勺先让开占用锅位，两人逐帧沿真实路线换位，分工任务落在各自台面',()=>{
 MAPS.dayHome=buildSpace('dayHome');let origins={a:{x:0,z:3.3},b:{x:0,z:4.8}},job={kind:'cook',recipeId:'tomato-rice',cooking:globalThis.CharDayKitchen.cookingSession('tomato-rice',{mode:'hands',lead:'ta'})};const a=actor(),b=actor(),controller=createTogether({a,b,map:()=>MAPS.dayHome,from:()=>origins,kitchen:()=>({job,progress:job.cooking.progress}),onStop:s=>{origins={a:s.a,b:s.b};}});
 assert.equal(controller.start('cook',{lead:'ta'}).ok,true);for(let i=0;i<2500&&controller.inspect()?.phase!=='active';i++)controller.tick(.02,i*.02);assert.equal(controller.inspect().phase,'active');controller.tick(.02,60);const before=controller.inspect();assert.equal(before.aTask,null);assert.equal(before.bTask.kind,'prep');job.cooking.lead='me';assert.equal(controller.start('cook',{lead:'me'}).ok,true);assert.equal(controller.inspect().phase,'walking-stage-b');let prev=controller.inspect();for(let i=0;i<2500&&controller.inspect()?.phase!=='active';i++){controller.tick(.02,61+i*.02);const next=controller.inspect();assert.ok(next);for(const who of ['a','b'])assert.ok(segmentClear(prev[who],next[who],'dayHome'));assert.ok(Math.hypot(next.a.x-next.b.x,next.a.z-next.b.z)>.58);prev=next;}assert.equal(controller.inspect().phase,'active');controller.tick(.02,120);const after=controller.inspect();assert.ok(Math.hypot(after.a.x-before.b.x,after.a.z-before.b.z)<.001);assert.ok(Math.hypot(after.b.x-before.a.x,after.b.z-before.a.z)<.001);assert.equal(after.aTask.kind,'prep');assert.equal(after.bTask,null);
});
test('站姿互动从TA此刻的脚下开始；近墙亲吻无需整圈空地，双方发起均沿真实通道靠近',()=>{
 const id='standing-test';MAPS[id]={id,radius:10,bounds:{w:10,d:10},floor:.08,obstacles:[{x:0,z:0,w:1,d:2}],furniture:[],spots:[],wander:[]};
 const kinds=['look','cup','hand','hug','pat','kiss','kiss-cheek','kiss-forehead','forehead','back-hug','dance','stretch'];
 for(const at of [{x:3,z:2},{x:-3,z:-2},{x:4.7,z:2},{x:-4.7,z:-2},{x:2,z:4.7}])for(const initiator of ['a','b'])for(const kind of kinds){
  const origin={a:{...at},b:{x:at.x>0?2:-2,z:at.z>0?-3:3}},plans=togetherPlans(MAPS[id],kind,origin,{initiator}),p=plans[0];
  assert.ok(p,kind+' '+JSON.stringify(at));assert.deepEqual(p.a,origin.a,kind);assert.equal(p.anchor,'a');assert.equal(p.hostShift,0);assert.deepEqual(p.aRoute,[]);
  let previous=origin.b;for(const next of p.bRoute){assert.ok(segmentClear(previous,next,id),kind);previous=next;}
 }
});
test('镜头遮挡不能把站着牵手的TA带去另一处；靠近途中及到位后TA保持当前站位',()=>{
 MAPS.dayHome=buildSpace('dayHome');const origin={a:{x:0,z:3.3},b:{x:0,z:4.8}},controller=createTogether({a:actor(),b:actor(),map:()=>MAPS.dayHome,from:()=>origin,visibility:p=>Math.hypot(p.a.x-origin.a.x,p.a.z-origin.a.z)<.01?10000:0});
 assert.equal(controller.start('hand').ok,true);let reached=false;
 for(let i=0;i<700;i++){controller.tick(.025,i*.025);const s=controller.inspect();assert.ok(s);assert.ok(Math.hypot(s.a.x-origin.a.x,s.a.z-origin.a.z)<.001);if(s.phase==='active')reached=true;}
 assert.ok(reached);assert.equal(controller.inspect().local,true);controller.dispose();
});
test('站姿动作只在TA附近微调；周围全堵住时拒绝，不挑房间另一头的空地',()=>{
 const id='standing-blocked',origin={a:{x:0,z:0},b:{x:4,z:4}};
 MAPS[id]={id,radius:10,floor:.08,furniture:[],spots:[],obstacles:[{x:.45,z:0,w:.1,d:1.3},{x:-.45,z:0,w:.1,d:1.3},{x:0,z:.45,w:.7,d:.1},{x:0,z:-.45,w:.7,d:.1}]};
 for(const kind of ['hand','hug','kiss','pat','back-hug'])assert.equal(togetherPlans(MAPS[id],kind,origin).length,0,kind);
});
test('共餐夹菜以正在坐的餐椅为锚，TA留在原座，我沿路走到椅旁，餐桌不改成沙发',()=>{
 for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  MAPS.dayHome=buildSpace('dayHome',{...Object.fromEntries(buildSpace('dayHome').furniture.filter(p=>!['dining-table','dining-chair','partner-chair'].includes(p.id)).map(p=>[p.id,{stored:true}])),...Object.fromEntries(['dining-table','dining-chair','partner-chair'].map(id=>{const p=buildSpace('dayHome').furniture.find(p=>p.id===id);const c=Math.cos(heading),s=Math.sin(heading);return [id,{x:p.x*c+p.z*s,z:p.z*c-p.x*s,heading:(p.heading||0)+heading}];}))});
  const map=MAPS.dayHome,origins={a:{x:Math.sin(heading)*3.3,z:Math.cos(heading)*3.3},b:{x:Math.sin(heading)*4.8,z:Math.cos(heading)*4.8}},meal=togetherPlans(map,'meal',origins)[0];assert.ok(meal);
  const from={a:{...meal.a,seat:meal.seats.a},b:{...meal.b,seat:meal.seats.b}},plans=togetherPlans(map,'feed',from,{tableSeats:meal.seats});assert.ok(plans.length);
  for(const p of plans){assert.equal(p.tableMeal,true);assert.equal(p.retain.a,true);assert.deepEqual(p.seats.a,meal.seats.a);assert.equal(p.seats.b,null);assert.deepEqual(p.aRoute,[]);assert.deepEqual(p.mealSeats,meal.seats);let at=from.b;for(const to of p.bRoute){assert.ok(segmentClear(at,to,'dayHome'));at=to;}}
 }
});
