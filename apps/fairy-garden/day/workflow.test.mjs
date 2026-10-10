import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {registerHooks} from 'node:module';
import {activityPhase,taskAt} from './workflow.mjs';
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
 assert.equal(activityPhase({map:'dayClinic',spot:'casework'},slot,start).spot,'casework');
 const night={...slot,startAt:Date.parse('2026-10-09T23:30:00Z'),endAt:Date.parse('2026-10-10T01:00:00Z')};assert.equal(activityPhase(p,night,Date.parse('2026-10-09T23:35:00Z')).phase,'work');
});
test('专业道具只在本工位执行，行走只携带书，手部目标引用真实桌面高度',()=>{
 for(const [scene,key,kind]of [['dayLaboratory','bench','experiment'],['dayLaboratory','computer','type'],['dayLibrary','study-notes','write']]){
  const map=DAY_PLACES[scene],spot=map.spots.find(s=>s.id===key),stage=activityPhase({map:scene,spot:key},null,null),task=taskAt(stage,spot,map,3);
  assert.equal(task.kind,kind);const table=map.furniture.find(p=>p.id===spot.furniture);assert.ok(task.target.y>map.floor+table.top);assert.equal(taskAt(stage,spot,map,3,{moving:true}).kind,'carry');
 }
});
