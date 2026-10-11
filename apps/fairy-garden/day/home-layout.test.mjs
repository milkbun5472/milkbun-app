import test from 'node:test';
import assert from 'node:assert/strict';
import {homePlacements,homeFurniture,checkHomeLayout,changeHomeFurniture,restoreHomeLayout} from './home-layout.mjs';
import {buildSpace,CORE_SPACES} from './spaces.mjs';
import {MAPS,findPath,segmentClear,sleepPose} from '../world.mjs';

test('默认小家通过真实碰撞和路线检查，存档只收已有家具与有限坐标',()=>{
 const result=checkHomeLayout({});assert.equal(result.ok,true);assert.equal(homeFurniture(result.placements).length,12);
 const clean=homePlacements({ghost:{x:1,z:2},sofa:{x:NaN,z:Infinity,heading:Math.PI/2,stored:true}});
 assert.equal(clean.ghost,undefined);assert.equal(clean.sofa.x,-3);assert.equal(clean.sofa.z,1.4);assert.equal(clean.sofa.stored,true);
 assert.deepEqual(restoreHomeLayout({'double-bed':{x:100,z:0}}),homePlacements());
});
test('重叠、墙外、门口和不可达动作点拒绝，原摆位与世界地图都保留',()=>{
 const baseline=homePlacements(),json=JSON.stringify(baseline),world=MAPS.dayHome;
 for(const [id,point,match]of [['home-plant',{x:-3,z:1.4},/挤到/],['double-bed',{x:20,z:0},/超出/],['home-plant',{x:0,z:4.8},/门口/]]){
  const bad=changeHomeFurniture(baseline,id,point);assert.equal(bad.ok,false);assert.match(bad.reason,match);
 }
 const rotate=changeHomeFurniture(baseline,'dining-chair','rotate');assert.equal(rotate.ok,false);assert.match(rotate.reason,/走不过去/);
 assert.equal(JSON.stringify(baseline),json);assert.equal(MAPS.dayHome,world);
});
test('挪床并转九十度后，床位、躺姿朝向和真实避障路线都更新',()=>{
 const moved=changeHomeFurniture({},'double-bed',{x:3.7,z:2.9,heading:Math.PI/2});assert.equal(moved.ok,true);
 const before=MAPS.dayHome;MAPS.dayHome=moved.map;
 try{const spot=moved.map.spots.find(s=>s.action==='sleep'),pose=sleepPose({map:'dayHome',companion:{map:'dayHome',position:spot.target},sleep:{companion:spot.id}},'companion');
  assert.equal(pose.heading,Math.PI/2);assert.ok(Math.abs(pose.x-4.35)<1e-10);assert.ok(Math.abs(pose.z-2.35)<1e-10);
  const route=findPath(moved.map.spawn,spot.target,'dayHome');assert.ok(route?.length);let p=moved.map.spawn;for(const q of route){assert.ok(segmentClear(p,q,'dayHome'));p=q;}
 }finally{if(before)MAPS.dayHome=before;else delete MAPS.dayHome;}
 assert.equal(CORE_SPACES.dayHome.furniture.find(p=>p.id==='double-bed').x,-4);
});
test('收纳同时移除家具、碰撞、床椅动作点，摆回优先保留上次位置',()=>{
 const moved=changeHomeFurniture({},'dining-chair',{x:1,z:2,heading:0});assert.equal(moved.ok,true);
 const stored=changeHomeFurniture(moved.placements,'dining-chair','store');assert.equal(stored.ok,true);
 assert.equal(stored.map.seats.meal.piece,'partner-chair');assert.equal(stored.map.obstacles.some(p=>p.id==='dining-chair'),false);
 const back=changeHomeFurniture(stored.placements,'dining-chair','restore');assert.equal(back.ok,true);assert.equal(back.map.seats.meal.x,1);assert.ok(Math.abs(back.map.seats.meal.z-(2+.06))<1e-10);assert.equal(back.map.seats.meal.pose,'deep');
 const noBed=changeHomeFurniture(back.placements,'double-bed','store');assert.equal(noBed.ok,true);assert.deepEqual(noBed.map.beds,{});
 assert.equal(buildSpace('dayHome',noBed.placements).furniture.length,11);
});
test('摆回时原位被占会寻找真正可达的新空位',()=>{
 const stored=changeHomeFurniture({},'home-plant','store');
 const chair=changeHomeFurniture(stored.placements,'partner-chair',{x:6,z:3.8,heading:0});assert.equal(chair.ok,true);
 const restored=changeHomeFurniture(chair.placements,'home-plant','restore');assert.equal(restored.ok,true);
 assert.notDeepEqual(restored.placements['home-plant'],homePlacements()['home-plant']);assert.equal(checkHomeLayout(restored.placements).ok,true);
});
test('同一地图替换家具后公共导航重新建格子，旧格子不会封死新通道',()=>{
 const previous=MAPS.dayHome;MAPS.dayHome=buildSpace('dayHome');
 try{
  findPath(MAPS.dayHome.spawn,MAPS.dayHome.spots.find(s=>s.id==='sleep').target,'dayHome');
  const next=checkHomeLayout({'double-bed':{stored:true},sofa:{stored:true},'coffee-table':{stored:true}});assert.equal(next.ok,true);MAPS.dayHome=next.map;
  const start={x:-4,z:-3},target={x:5.5,z:-2.5},route=findPath(start,target,'dayHome');assert.ok(route?.length);let p=start;for(const q of route){assert.ok(segmentClear(p,q,'dayHome'));p=q;}
 }finally{if(previous)MAPS.dayHome=previous;else delete MAPS.dayHome;}
});
