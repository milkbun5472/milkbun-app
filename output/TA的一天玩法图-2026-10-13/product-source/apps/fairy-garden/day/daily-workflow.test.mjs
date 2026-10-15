import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSpace} from './spaces.mjs';
import {dailyTaskAt} from './daily-workflow.mjs';
import {HOME_COOK,homePlacements} from './home-catalog.mjs';
import {changeHomeFurniture,checkHomeLayout} from './home-layout.mjs';
import {MAPS,findPath,segmentClear} from '../world.mjs';

test('四种生活动作只在实际家具位置到达后出现，途中不悬空做事',()=>{
 const map=buildSpace('dayHome');
 for(const [action,kind]of [['read','read'],['tea','drink'],['meal','eat'],['cook','cook']]){
  const spot=map.spots.find(s=>s.action===action),stage={map:map.id,action,spot:spot.id};
  assert.equal(dailyTaskAt(stage,spot,map,3,{moving:true}),null);
  const task=dailyTaskAt(stage,spot,map,3);assert.equal(task.kind,kind);assert.equal(task.furniture,spot.piece);assert.ok(task.progress>=0&&task.progress<1);
 }
 assert.equal(dailyTaskAt({action:'cook'},null,buildSpace('dayHome',{kitchen:{stored:true}}),3),null);
 assert.equal(dailyTaskAt({action:'rest'},null,map,3),null);
});
test('料理台的旋转和挪动同时驱动站位、锅、接触点与真实路线',()=>{
 const result=changeHomeFurniture({},'kitchen',{x:5.5,z:0,heading:Math.PI/2});
 assert.equal(result.ok,true,result.reason);
 const map=result.map,spot=map.spots.find(s=>s.id==='cook'),task=dailyTaskAt({action:'cook'},spot,map,2),p=map.furniture.find(p=>p.id==='kitchen');
 assert.ok(Math.abs(task.pot.x-p.x-HOME_COOK.z)<1e-7);assert.ok(Math.abs(task.pot.z-p.z+HOME_COOK.x)<1e-7);assert.equal(task.contact.y,HOME_COOK.contactY);
 const before=MAPS.dayHome;MAPS.dayHome=map;try{const path=findPath(map.spawn,spot.target,'dayHome');assert.ok(path?.length);let from=map.spawn;for(const to of path){assert.ok(segmentClear(from,to,'dayHome'));from=to;}}finally{MAPS.dayHome=before;}
});
test('厨房收纳保留偏好并使用另一台；旧版布置仍可通过',()=>{
 const raw=homePlacements();raw.kitchen.stored=true;raw.$room.uses.cook='furniture-1';raw['furniture-1']={catalogId:'kitchen',x:3.4,z:-4.65,heading:0};
 const result=checkHomeLayout(raw);assert.equal(result.ok,true);assert.equal(result.map.spots.find(s=>s.id==='cook').piece,'furniture-1');
 const stored=changeHomeFurniture(result.placements,'furniture-1','store');assert.equal(stored.ok,true);assert.equal(stored.placements.$room.uses.cook,'furniture-1');assert.equal(stored.map.spots.some(s=>s.id==='cook'),false);
 assert.equal(checkHomeLayout({}).ok,true);
});
test('厨房旧布置挡住新动作点时保留整套家具，不恢复默认房间',()=>{
 const raw=homePlacements();raw['home-plant']={...raw['home-plant'],x:4.48,z:-3.9};
 const result=checkHomeLayout(raw);assert.equal(result.ok,true,result.reason);assert.equal(result.placements['home-plant'].x,4.48);
 // Nearby candidates share the real collision padding, rather than a second formula.
 const cook=result.map.spots.find(s=>s.id==='cook');assert.ok(!cook||cook.target.x!==4.48);
});
