import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{HOME_HOBBIES,homePlacements,homeInventory,BASE_HOME,BATH_HOME}=await import('./home-catalog.mjs'),{buildSpace}=await import('./spaces.mjs'),{checkHomeLayout,addHomeFurniture}=await import('./home-layout.mjs'),{MAPS,segmentClear,floorHeight}=await import('../world.mjs'),{dailyTaskAt}=await import('./daily-workflow.mjs'),{activityPhase}=await import('./workflow.mjs'),{createSceneVisit}=await import('./visit.mjs');
const env={};vm.createContext(env);for(const f of ['apps/fairy-garden/day/catalog.js','apps/fairy-garden/day/home-hobbies.js','js/char-day-link.js'])vm.runInContext(fs.readFileSync(f,'utf8'),env);
const H=globalThis.CharDayHomeHobbies,plain=x=>JSON.parse(JSON.stringify(x));
function layout(kind,heading=0){const raw=homePlacements();for(const p of Object.values(raw))if(p?.catalogId)p.stored=true;raw['furniture-1']={catalogId:HOME_HOBBIES[kind].catalogId,x:2,z:1.5,heading,stored:false};return raw;}
function actor(){const root=new T.Group();return {root,animate(time,p){root.position.y=p.height;this.pose=p;}};}
test('五类兴趣家具沿原装修writer进入小家，旧家不强塞乐器；手机与实际地图认同一实例和数量上限',()=>{
 assert.deepEqual(Object.keys(HOME_HOBBIES),['piano','guitar','paint','weights','stretch']);assert.equal(buildSpace('dayHome').furniture.some(p=>p.hobby),false);
 for(const [kind,p]of Object.entries(HOME_HOBBIES)){const added=addHomeFurniture({},p.catalogId);assert.ok(added.ok,p.catalogId);assert.ok(added.map.spots.some(s=>s.id===kind));assert.deepEqual(H.available(added.placements,homeInventory()),[kind]);}
 const raw={};for(let n=1;n<=80-(BASE_HOME.length+BATH_HOME.length);n++)raw['furniture-'+n]={catalogId:'plant',stored:true};raw['furniture-99']={catalogId:'home-piano',stored:false};assert.deepEqual(H.available(raw,homeInventory()),[]);assert.equal(homePlacements(raw)['furniture-99'],undefined);
});
test('四朝向同时转动家具、坐位和手的接触点；途中、未走到、收纳后不假装弹奏或画画',()=>{
 for(const kind of Object.keys(HOME_HOBBIES))for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const raw=layout(kind,heading),checked=checkHomeLayout(raw);assert.ok(checked.ok,kind+' '+heading+' '+checked.reason);const map=checked.map,spot=map.spots.find(p=>p.id===kind),stage={map:'dayHome',spot:kind,action:kind};
  const task=dailyTaskAt(stage,spot,map,3,{position:spot.target});assert.equal(task.kind,kind);assert.equal(task.furniture,'furniture-1');assert.equal(task.supportHeight,0);
  assert.equal(dailyTaskAt(stage,spot,map,3,{moving:true}),null);assert.equal(dailyTaskAt(stage,spot,map,3,{position:map.spawn}),null);
  if(kind==='piano'){assert.equal(spot.seat.piece,'furniture-1');assert.equal(spot.seat.heading,heading+Math.PI);assert.ok(task.leftTarget&&task.target);}
  if(kind==='stretch')assert.ok(floorHeight((MAPS.dayHome=map).id,spot.target)>.08);
  raw['furniture-1'].stored=true;assert.equal(dailyTaskAt(stage,null,buildSpace('dayHome',raw),3),null);
 }
});
test('人设爱好只在实际摆出的兴趣角成为空档候选，否定不算喜欢；夜间照旧睡觉，不写布局或日程',()=>{
 const all=homePlacements();let n=1;for(const p of Object.values(HOME_HOBBIES))all['furniture-'+n++]={catalogId:p.catalogId,x:2,z:1.5,stored:false};
 const L=env.CharDayLink,likes=L.idleLikes('喜欢弹钢琴和吉他、画画与健身，也会做瑜伽。');assert.ok(Object.keys(HOME_HOBBIES).every(k=>likes.includes(k)));
 for(const [text,k]of [['不喜欢弹钢琴','piano'],['讨厌画画','paint'],['不爱健身','weights']])assert.ok(!L.idleLikes(text).includes(k),text);
 const before=JSON.stringify(all),seen=new Set();for(let h=0;h<64;h++){const q=L.resolve(null,Date.parse('2026-10-12T08:00:00Z')+h*3600000,{minute:600,seed:'兴趣测试甲',likes,homePlacements:all});assert.equal(q.activitySlot,null);seen.add(q.presentation.spot);const empty=L.resolve(null,h*3600000,{minute:600,likes,homePlacements:{}});assert.ok(!HOME_HOBBIES[empty.presentation.spot]);}
 for(const k of Object.keys(HOME_HOBBIES))assert.ok(seen.has(k),k);assert.equal(JSON.stringify(all),before);assert.equal(L.resolve(null,1,{minute:60,likes,homePlacements:all}).presentation.spot,'sleep');
 const missing=activityPhase({map:'dayHome',spot:'piano',action:'piano'},null,0,{space:buildSpace('dayHome')});assert.equal(missing.unavailableHobby,'piano');assert.equal(missing.motion,null);
});
test('我的手选兴趣动作沿真路径到位，菜单及重进保持，任意等待不切回自动；TA占琴凳时拒绝共用',()=>{
 for(const kind of Object.keys(HOME_HOBBIES)){
  MAPS.dayHome=buildSpace('dayHome',layout(kind));const map=()=>MAPS.dayHome,a=actor(),ta=()=>({x:0,z:3.3}),c=createSceneVisit({avatar:a,ta,map});c.join();assert.equal(c.act(kind),true,kind);let previous=c.inspect().position;
  for(let n=0;n<1500&&c.inspect().busy;n++){c.tick(.025,n*.025);const next=c.inspect().position;assert.ok(segmentClear(previous,next,'dayHome'));previous=next;}
  c.tick(.025,40);assert.equal(c.inspect().task.kind,kind);assert.equal(c.inspect().control,'manual');const saved=c.pauseState(),next=createSceneVisit({avatar:actor(),ta,map});assert.equal(next.restore(saved),true);next.tick(10000,10000);assert.equal(next.inspect().manualAction,kind);assert.equal(next.inspect().task.kind,kind);assert.equal(next.inspect().control,'manual');
 }
 MAPS.dayHome=buildSpace('dayHome',layout('piano'));const spot=MAPS.dayHome.spots.find(p=>p.id==='piano'),c=createSceneVisit({avatar:actor(),ta:()=>({...spot.seat,seat:spot.seat}),map:()=>MAPS.dayHome});c.join();assert.equal(c.act('piano'),false);assert.equal(c.inspect().control,'manual');assert.equal(c.inspect().task,null);
});
