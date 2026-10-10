import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {registerHooks} from 'node:module';
import {activityPhase,taskAt,luggagePosition} from './workflow.mjs';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {DAY_PLACES}=await import('./places/index.mjs');
const {MAPS,findPath,segmentClear}=await import('../world.mjs');Object.assign(MAPS,DAY_PLACES);
const env={};vm.createContext(env);for(const f of ['js/schedule-clock.js','apps/fairy-garden/day/catalog.js','js/char-day-link.js'])vm.runInContext(fs.readFileSync(f,'utf8'),env);
const app=fs.readFileSync('js/app.js','utf8'),a=app.indexOf('  const saveSchedDay ='),b=app.indexOf('  const applySchedChange =',a);assert.ok(a>0&&b>a);
let plans={},writes=0;const ref={current:plans},save=new Function('setSchedules','schedulesRef','saveJSON',app.slice(a,b)+'return saveSchedDay;')(fn=>{plans=fn(plans);},ref,()=>writes++);
const start=Date.parse('2026-10-09T10:00:00Z'),char={id:'workflow-test',name:'测试角色',tz:0};
function fixture(scene,spot,minutes=60){save(char.id,'2026-10-09',{seqs:[{time:'10:00',end:minutes===60?'11:00':'10:02',title:'整理当天资料',location:'测试工作地点',type:'work',world:{scene,spot}}]});return env.ScheduleClock.currentSlot(char,ref.current[char.id],start+1000);}
for(const [scene,spot]of [['dayLaboratory','bench'],['dayLaboratory','computer'],['dayLibrary','desk-reading'],['dayLibrary','study-notes']]){
 test(scene+'/'+spot+'原writer日程完成进入、准备、做事、休息、收拾、离开的时间流程与碰撞路线',()=>{
  const slot=fixture(scene,spot),p=env.CharDayLink.presentation(slot),before=JSON.stringify(ref.current),n=writes,phases=new Set(),map=DAY_PLACES[scene];let previous=map.spawn;
  for(let sec=0;sec<3600;sec+=15){const stage=activityPhase(p,slot,start+sec*1000);phases.add(stage.phase);const point=map.spots.find(s=>s.id===stage.spot);assert.ok(point);
   const route=findPath(previous,point.target,scene);assert.ok(route,stage.spot);let from=previous;for(const to of route){assert.ok(segmentClear(from,to,scene));from=to;}previous=point.target;
  }
  assert.deepEqual([...phases].sort(),['break','enter','exit','prepare','tidy','work']);assert.equal(JSON.stringify(ref.current),before);assert.equal(writes,n);
 });
}
test('电脑数据任务不会去实验台操作，重开衔接当前进度，短时段保留工作时间',()=>{
 const slot=fixture('dayLaboratory','computer'),p=env.CharDayLink.presentation(slot);
 for(let sec=0;sec<3600;sec+=10)assert.notEqual(activityPhase(p,slot,start+sec*1000).spot,'bench');
 assert.equal(activityPhase(p,slot,start+6*60000).motion,'type');assert.deepEqual(activityPhase(p,slot,start+6*60000),activityPhase(p,slot,start+6*60000));
 const short=fixture('dayLibrary','desk-reading',2);assert.equal(activityPhase({map:'dayLibrary',spot:'desk-reading'},short,start+60000).phase,'work');
});
test('预览、摆位、空档、其他房与缺失时钟保留直接工位动作，跨午夜按原startAt/endAt',()=>{
 const slot=fixture('dayLibrary','desk-reading'),p=env.CharDayLink.presentation(slot);
 assert.equal(activityPhase(p,slot,start+1000,{preview:true}).spot,'desk-reading');assert.equal(activityPhase(p,null,start).spot,'desk-reading');
 assert.equal(activityPhase({map:'dayCafe',spot:'meal'},slot,start).spot,'meal');
 const night={...slot,startAt:Date.parse('2026-10-09T23:30:00Z'),endAt:Date.parse('2026-10-10T01:00:00Z')};assert.equal(activityPhase(p,night,Date.parse('2026-10-09T23:35:00Z')).phase,'work');
});
test('专业道具只在本工位执行，行走只携带书，手部目标引用真实桌面高度',()=>{
 for(const [scene,key,kind]of [['dayLaboratory','bench','experiment'],['dayLaboratory','computer','type'],['dayLibrary','study-notes','write']]){
  const map=DAY_PLACES[scene],spot=map.spots.find(s=>s.id===key),stage=activityPhase({map:scene,spot:key},null,null),task=taskAt(stage,spot,map,3);
  assert.equal(task.kind,kind);const table=map.furniture.find(p=>p.id===spot.furniture);assert.ok(task.target.y>map.floor+table.top);assert.equal(taskAt(stage,spot,map,3,{moving:true}).kind,'carry');
 }
});

for(const [scene,spot]of [['dayClinic','casework'],['dayStudio','easel'],['dayStudio','handcraft'],['dayRehearsal','practice'],['dayRehearsal','piano'],['dayStation','waiting']]){
 test(scene+'/'+spot+'原writer日程完成专业活动与真实路线，所有阶段只读且原visual字段留在内部',()=>{
  const slot=fixture(scene,spot),p=env.CharDayLink.presentation(slot),before=JSON.stringify(ref.current),n=writes,map=DAY_PLACES[scene],phases=new Set();let previous=map.spawn;
  for(let sec=0;sec<3600;sec+=15){const stage=activityPhase(p,slot,start+sec*1000),point=map.spots.find(s=>s.id===stage.spot);phases.add(stage.phase);assert.ok(point,stage.spot);const path=findPath(previous,point.target,scene);assert.ok(path,previous+' -> '+stage.spot);let from=previous;
   for(const to of path){assert.ok(segmentClear(from,to,scene));if(scene==='dayStation'){const q=luggagePosition(map,to,Math.atan2(to.x-from.x,to.z-from.z));assert.ok(!map.obstacles.some(o=>o.w&&o.d&&Math.abs(q.x-o.x)<o.w/2+.14&&Math.abs(q.z-o.z)<o.d/2+.11),'随身行李也不穿家具');}from=to;}previous=point.target;
  }
  assert.ok(['enter','prepare','work','tidy','exit'].every(x=>phases.has(x)));if(scene!=='dayStation')assert.ok(phases.has('break'));
  assert.equal(JSON.stringify(ref.current),before);assert.equal(writes,n);assert.ok(!JSON.stringify(env.CharDayLink.publicSchedules(ref.current)).includes('"world"'));
 });
}
test('原日程决定练舞与排戏，琴键与画布接触点来自实际家具，同角色不添加患者或交通工具',()=>{
 const p={map:'dayRehearsal',spot:'practice'},slot=fixture(p.map,p.spot);assert.equal(activityPhase(p,{...slot,title:'练舞'},start+2*60000).motion,'dance');assert.equal(activityPhase(p,{...slot,title:'排戏与熟悉台词'},start+2*60000).motion,'rehearse');
 for(const [mapId,key]of [['dayStudio','easel'],['dayRehearsal','piano']]){const map=DAY_PLACES[mapId],spot=map.spots.find(s=>s.id===key),p=map.furniture.find(f=>f.id===spot.furniture),stage=activityPhase({map:mapId,spot:key},null,null),task=taskAt(stage,spot,map,0);assert.ok(p.work[key]);assert.ok(Math.abs(task.contact.z-(p.z+p.work[key].z))<1e-9);if(key==='piano')assert.ok(task.leftTarget.x>task.target.x);}
});

test('行李先放上实际架板，候车与走去取物时留在架上，取回后才带去站台',()=>{
 const map=DAY_PLACES.dayStation,slot=fixture('dayStation','waiting'),p=env.CharDayLink.presentation(slot),rack=map.furniture.find(f=>f.id==='luggage-shelf');
 const at=minute=>{const stage=activityPhase(p,slot,start+minute*60000),spot=map.spots.find(s=>s.id===stage.spot);return {stage,spot};};
 const prepare=at(1),pack=taskAt(prepare.stage,prepare.spot,map,5);assert.equal(pack.kind,'pack');assert.equal(pack.progress,1);assert.ok(pack.stow.y>map.floor);
 const working=at(2),wait=taskAt(working.stage,working.spot,map,3),walking=taskAt(working.stage,working.spot,map,0,{moving:true,position:map.spawn});
 assert.deepEqual(wait.luggage,pack.stow);assert.deepEqual(walking.luggage,pack.stow);assert.equal(walking.luggageHeld,false);assert.equal(wait.luggage.x,rack.x-.12);
 const tidy=at(58.75),approach=taskAt(tidy.stage,tidy.spot,map,0,{moving:true,position:map.spawn}),take=taskAt(tidy.stage,tidy.spot,map,5);assert.deepEqual(approach.luggage,pack.stow);assert.equal(take.kind,'take-luggage');assert.deepEqual(take.stow,pack.stow);
 const exit=at(59.75),leave=taskAt(exit.stage,exit.spot,map,3,{moving:true,position:map.spawn});assert.equal(leave.luggageHeld,true);assert.equal(leave.luggage.y,map.floor);
});

for(const [scene,key]of [['dayGym','treadmill'],['dayGym','weights'],['dayGym','stretch'],['dayMarket','produce'],['dayMarket','groceries'],['dayMarket','cashier']]){
 test(scene+'/'+key+'沿原writer时间流程与真实路径，不新增记录，日历仍隔离场景字段',()=>{
  const slot=fixture(scene,key),p=env.CharDayLink.presentation(slot),before=JSON.stringify(ref.current),n=writes,seen=new Set(),map=DAY_PLACES[scene];let previous=map.spawn;
  for(let sec=0;sec<3600;sec+=5){const stage=activityPhase(p,slot,start+sec*1000),spot=map.spots.find(s=>s.id===stage.spot);seen.add(stage.phase);assert.ok(spot,stage.spot);const path=findPath(previous,spot.target,scene);assert.ok(path);let from=previous;for(const to of path){assert.ok(segmentClear(from,to,scene));from=to;}previous=spot.target;const task=taskAt(stage,spot,map,3);if(task){assert.equal(task.spot,spot.id);assert.ok(Number.isFinite(task.progress));}}
  assert.ok(['enter','prepare','work','tidy','exit'].every(phase=>seen.has(phase)));if(scene==='dayGym'||key==='cashier')assert.ok(seen.has('break'));
  assert.equal(JSON.stringify(ref.current),before);assert.equal(writes,n);assert.ok(!JSON.stringify(env.CharDayLink.publicSchedules(ref.current)).includes('"world"'));
 });
}
test('超市浏览、结账、装袋、离开按原日程顺序，收银工作不冒充购物',()=>{
 const slot=fixture('dayMarket','produce'),p=env.CharDayLink.presentation(slot),map=DAY_PLACES.dayMarket;
 const steps=[.1,1,2,58.6,59.1,59.8].map(min=>activityPhase(p,slot,start+min*60000));assert.deepEqual(steps.map(s=>s.spot),['entrance','basket','produce','checkout','packing','exit']);
 for(const stage of steps){const spot=map.spots.find(s=>s.id===stage.spot),task=taskAt(stage,spot,map,3),walk=taskAt(stage,spot,map,3,{moving:true});if(walk)assert.equal(walk.kind,'carry');if(task?.contact){const piece=map.furniture.find(f=>f.id===spot.furniture);assert.equal(task.contact.y,map.floor+piece.work[spot.id].y);}}
 const cashier=activityPhase({map:'dayMarket',spot:'cashier'},fixture('dayMarket','cashier'),start+59.8*60000),leaving=taskAt(cashier,map.spots.find(s=>s.id===cashier.spot),map,5);assert.equal(leaving.basket,false);assert.equal(leaving.bag,false);
});
test('运动走路不原地跑步或举重，只有拿到哑铃才携带；结束后放回低架',()=>{
 const map=DAY_PLACES.dayGym,slot=fixture('dayGym','weights'),p=env.CharDayLink.presentation(slot),get=(min,elapsed=3,moving=false)=>{const s=activityPhase(p,slot,start+min*60000);return taskAt(s,map.spots.find(q=>q.id===s.spot),map,elapsed,{moving});};
 assert.equal(get(1,1).weights,false);assert.equal(get(1,3).weights,true);assert.equal(get(2,3,true).kind,'carry');assert.equal(get(2,3,true).weights,true);assert.equal(get(59,0).kind,'weight-return');assert.equal(get(59,0).weights,true);assert.equal(get(59,4).weights,false);
 const run=activityPhase({map:'dayGym',spot:'treadmill'},null,null),walk=taskAt(run,map.spots.find(s=>s.id==='treadmill'),map,3,{moving:true});assert.equal(walk.kind,'carry');assert.equal(walk.weights,false);
});

test('实际场景与小人共用任务：跑带只在到位时转动，哑铃与商品拿取后在原架隐藏，离开复原',async()=>{
 const {DAY_FACTORIES}=await import('./places/index.mjs'),{updateWorkScene}=await import('./work-scene.mjs');
 const gym=DAY_FACTORIES.dayGym().root,run=activityPhase({map:'dayGym',spot:'treadmill'},null,null),gymMap=DAY_PLACES.dayGym,runTask=taskAt(run,gymMap.spots.find(s=>s.id==='treadmill'),gymMap,2),stripe=gym.getObjectByName('BeltStripe:0');
 updateWorkScene(gym,runTask,false,1);const z=stripe.position.z;updateWorkScene(gym,runTask,false,2);assert.notEqual(stripe.position.z,z);assert.equal(gym.userData.sceneAction.beltRunning,true);updateWorkScene(gym,runTask,true,3);assert.equal(gym.userData.sceneAction.beltRunning,false);
 const lift=activityPhase({map:'dayGym',spot:'weights'},null,null),weights=taskAt(lift,gymMap.spots.find(s=>s.id==='weights'),gymMap,2),pair=[];gym.traverse(o=>{if(o.userData.dayWeights)pair.push(o);});assert.equal(pair.length,2);updateWorkScene(gym,weights,false,3);assert.ok(pair.every(o=>!o.visible));updateWorkScene(gym,null,false,4);assert.ok(pair.every(o=>o.visible));
 const market=DAY_FACTORIES.dayMarket().root,marketMap=DAY_PLACES.dayMarket,stage=activityPhase({map:'dayMarket',spot:'cold'},null,null),pick=taskAt(stage,marketMap.spots.find(s=>s.id==='cold'),marketMap,2),door=market.getObjectByName('MarketColdDoor'),product=market.getObjectByName('MarketProduct:cold');
 updateWorkScene(market,pick,false,2);assert.ok(Math.abs(door.rotation.y)>.8);assert.equal(product.visible,false);updateWorkScene(market,null,false,3);assert.ok(Math.abs(door.rotation.y)<1e-9);assert.equal(product.visible,true);
});
