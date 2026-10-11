import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {registerHooks} from 'node:module';
import {activityGroup} from './activity-groups.mjs';
import {activityPhase,taskAt} from './workflow.mjs';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {DAY_PLACES}=await import('./places/index.mjs');
const {CORE_SPACES,buildSpace}=await import('./spaces.mjs');
const {MAPS,findPath,segmentClear,walkable}=await import('../world.mjs');
Object.assign(MAPS,CORE_SPACES,DAY_PLACES);
const env={};vm.createContext(env);
for(const f of ['js/schedule-clock.js','apps/fairy-garden/day/catalog.js','js/char-day-link.js'])vm.runInContext(fs.readFileSync(f,'utf8'),env);
const app=fs.readFileSync('js/app.js','utf8'),a=app.indexOf('  const saveSchedDay ='),b=app.indexOf('  const applySchedChange =',a);assert.ok(a>0&&b>a);
let plans={},writes=0;const ref={current:plans};
const save=new Function('setSchedules','schedulesRef','saveJSON',app.slice(a,b)+'return saveSchedDay;')(fn=>plans=fn(plans),ref,()=>writes++);
const start=Date.parse('2026-10-10T10:00:00Z'),char={id:'groups-a',name:'活动组验收',tz:0};
function slotFor(scene,spot,patch={}){
 save(char.id,'2026-10-10',{seqs:[{time:'10:00',end:'14:00',title:'按原安排做事',location:'测试地点',type:'work',world:{scene,spot},...patch}]});
 return env.ScheduleClock.currentSlot(char,ref.current[char.id],start+1000);
}
const representatives={dayHome:'read',dayWork:'work',dayCafe:'meal',dayStreet:'walk',dayLaboratory:'bench',dayLibrary:'window-reading',dayClinic:'casework',dayStudio:'easel',dayRehearsal:'piano',dayStation:'waiting',dayGym:'weights',dayMarket:'produce',dayOffice:'computer',dayCampus:'listen',dayInvestigation:'clues',dayService:'cook',dayFilm:'perform',dayBroadcast:'voice',dayLegal:'draft',dayTraining:'patrol',dayWorkshop:'repair',dayFarm:'records',dayFleaMarket:'fabric',dayStudy:'read'};
for(const [scene,primary]of Object.entries(representatives))test(scene+'：四小时原日程在本场景轮换动作和实际位置，连续路线可达且零写入',()=>{
 const map=MAPS[scene],slot=slotFor(scene,primary),p=env.CharDayLink.presentation(slot),before=JSON.stringify(ref.current),count=writes,anchors=new Set(),seen=new Set();let previous=map.spawn;
 assert.ok(activityGroup(p,map));
 for(let sec=0;sec<14400;sec+=30){
  const stage=activityPhase(p,slot,start+sec*1000,{space:map});assert.equal(stage.map,scene);assert.ok(stage.groupLabel);seen.add(stage.spot);
  const spot=map.spots.find(s=>s.id===stage.spot);assert.ok(spot,scene+'/'+stage.spot);
  const at=stage.stroll?map.spawn:spot.target;assert.ok(walkable(at.x,at.z,scene));
  const rendered=stage.standing||stage.stroll?at:spot.seat||at;anchors.add(rendered.x.toFixed(3)+','+rendered.z.toFixed(3));
  if(Math.hypot(previous.x-at.x,previous.z-at.z)>.001){const path=findPath(previous,at,scene);assert.ok(path,'缺路线 '+scene+'/'+stage.spot);let from=previous;for(const to of path){assert.ok(segmentClear(from,to,scene));from=to;}previous=at;}
  if(stage.phase==='break'){assert.equal(stage.motion,null);assert.equal(taskAt(stage,spot,map,3),null);}
  assert.deepEqual(activityPhase(p,slot,start+sec*1000,{space:map}),stage,'重开由同一日程时钟恢复');
 }
 assert.ok(anchors.size>1,scene+'仍只有一个实际位置');assert.ok(seen.has(primary));assert.equal(JSON.stringify(ref.current),before);assert.equal(writes,count);assert.equal(env.CharDayLink.publicRow(slot).world,undefined);
});
test('全部211个原摆位：长期安排使用合法动作，短时预览、手动位置和睡眠保持明确选择',()=>{
 let n=0;
 for(const [scene,map]of Object.entries({...CORE_SPACES,...DAY_PLACES}))for(const spot of map.spots){
  n++;const slot=slotFor(scene,spot.id),p=env.CharDayLink.presentation(slot);
  for(let minute=0;minute<240;minute+=.5){const stage=activityPhase(p,slot,start+minute*60000,{space:map});assert.ok(map.spots.some(s=>s.id===stage.spot),scene+'/'+stage.spot);if(stage.phase==='break')assert.equal(stage.motion,null);}
  for(const at of [start+1000,start+59*60000,start+239*60000]){
   assert.equal(activityPhase({...p,manual:true},slot,at,{space:map}).spot,spot.id);
   assert.equal(activityPhase(p,slot,at,{space:map,preview:true}).spot,spot.id);
  }
  if(p.action==='sleep')assert.equal(activityPhase(p,slot,start+120*60000,{space:map}).group,undefined);
 }
 assert.equal(n,211);
});
test('收纳与移动家具：活动只取实际锚点，床上睡眠和锅边等候不强制离开',()=>{
 const home=buildSpace('dayHome',{sofa:{stored:true}}),slot=slotFor('dayHome','read'),p=env.CharDayLink.presentation(slot);
 assert.equal(activityGroup(p,home),null,'收起沙发不留下不存在的座位循环');
 const live=CORE_SPACES.dayHome,cook=slotFor('dayHome','cook');
 for(let minute=0;minute<240;minute++){const stage=activityPhase({map:'dayHome',action:'cook',spot:'cook'},cook,start+minute*60000,{space:live});assert.equal(stage.spot,'cook');assert.equal(stage.stroll,false);}
 const sleep=slotFor('dayHome','sleep');
 for(let minute=0;minute<240;minute++)assert.equal(activityPhase({map:'dayHome',action:'sleep',spot:'sleep'},sleep,start+minute*60000,{space:live}).spot,'sleep');
 const moved=buildSpace('dayHome',{sofa:{x:-3.0,z:2.0}});assert.notDeepEqual(moved.spots.find(s=>s.id==='read').target,live.spots.find(s=>s.id==='read').target);
});
test('专业辅助位置保持自己的事项，不代替用户改职业；跨午夜仍用原区间时间',()=>{
 for(const [scene,spot,forbidden]of [['dayLegal','draft',['judge','argue']],['dayFilm','camera',['perform','pose']],['dayBroadcast','voice',['sing','stream']],['dayWorkshop','tools',['repair','craft']],['dayLibrary','window-reading',['study-notes']],['dayFarm','records',['crops','dock']]]){
  const slot=slotFor(scene,spot),p=env.CharDayLink.presentation(slot),map=MAPS[scene];for(let minute=0;minute<240;minute+=.5)assert.ok(!forbidden.includes(activityPhase(p,slot,start+minute*60000,{space:map}).spot));
 }
 const slot=slotFor('dayHome','read'),p=env.CharDayLink.presentation(slot),map=CORE_SPACES.dayHome;
 const night={...slot,startAt:Date.parse('2026-10-10T23:30:00Z'),endAt:Date.parse('2026-10-11T03:30:00Z')};
 assert.deepEqual(activityPhase(p,night,night.startAt+13*60000,{space:map}),activityPhase(p,slot,start+13*60000,{space:map}));
});
