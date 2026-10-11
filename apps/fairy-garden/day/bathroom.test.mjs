import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {BASE_HOME,homePlacements} from './home-catalog.mjs';
import {checkHomeLayout,changeHomeFurniture,changeHomeRoom,restoreHomeLayout} from './home-layout.mjs';
import {HOME_SIZES} from './home-architecture.mjs';
import {homeBathroom} from './bathroom-layout.mjs';
import {MAPS,walkable,findPath,segmentClear} from '../world.mjs';
import {chorePlans,choreIntent,chorePose} from './chores.mjs';
import {activityGroup} from './activity-groups.mjs';

test('三档小家独立扩出浴室，原家具完整保留，三项动作都沿真实门口和碰撞路线',()=>{
 for(const size of Object.keys(HOME_SIZES)){
  const result=changeHomeRoom({}, {size});assert.ok(result.ok,result.reason);const map=result.map,prev=MAPS.dayHome;MAPS.dayHome=map;
  try{for(const p of BASE_HOME)assert.deepEqual(result.placements[p.id],homePlacements()[p.id]);
   const b=homeBathroom(map.room);assert.ok(b.edge>=7);assert.equal(walkable(b.edge+1,-4,'dayHome'),false,'扩建外不能在空中行走');assert.equal(walkable(-b.edge-1,0,'dayHome'),false);
   for(const kind of ['shower','wash-hands','toilet']){
    const plan=chorePlans(map,kind,map.spawn,null)[0];assert.ok(plan,kind);assert.ok(plan.at.x>b.edge);assert.equal(plan.personal,true);let at=map.spawn;
    for(const point of plan.route){assert.ok(segmentClear(at,point,'dayHome'));at=point;}
    assert.ok(findPath(plan.at,map.spawn,'dayHome'));assert.equal(activityGroup({map:'dayHome',action:kind,spot:kind},map),null,'洗漱不轮换成看书');
   }
   assert.deepEqual(restoreHomeLayout(JSON.parse(JSON.stringify(result.placements))),result.placements);
  }finally{MAPS.dayHome=prev;}
 }
});
test('现有布局和装饰配色不因浴室收纳重置，浴室移位旋转改变动作接触，扩建仍留在浴室',()=>{
 const old=changeHomeFurniture({},'home-plant',{x:5.7,z:3.4,color:'#123456'});assert.ok(old.ok);const json=JSON.stringify(old.placements);
 const store=changeHomeFurniture(old.placements,'home-basin','store');assert.ok(store.ok);assert.ok(!store.map.spots.some(s=>s.action==='wash-hands'));assert.deepEqual(store.placements['home-plant'],old.placements['home-plant']);
 const back=changeHomeFurniture(store.placements,'home-basin','restore');assert.ok(back.ok);const big=changeHomeRoom(back.placements,{size:'loft'});assert.ok(big.ok);assert.equal(big.placements['home-basin'].x-back.placements['home-basin'].x,4);assert.equal(JSON.stringify(old.placements),json);
 const moved=changeHomeFurniture(big.placements,'home-basin',{x:13,z:1.4,heading:0});assert.ok(moved.ok,moved.reason);const prev=MAPS.dayHome;MAPS.dayHome=moved.map;
 try{const plan=chorePlans(moved.map,'wash-hands',moved.map.spawn,null)[0];assert.equal(plan.target.x,13);assert.equal(plan.heading,Math.PI);assert.equal(plan.target.z,1.7);}finally{MAPS.dayHome=prev;}
});
test('洗澡洗手如厕按真实日程只读匹配，明确手改位置仍优先',()=>{
 const env={};vm.createContext(env);for(const f of ['apps/fairy-garden/day/catalog.js','js/char-day-link.js'])vm.runInContext(fs.readFileSync(f,'utf8'),env);
 for(const [title,kind]of [['回家淋浴','shower'],['睡前洗手','wash-hands'],['去如厕','toilet']]){const row={title,type:'home',location:'家里'},before=JSON.stringify(row),p=env.CharDayLink.presentation(row);assert.equal(p.map,'dayHome');assert.equal(p.action,kind);assert.equal(choreIntent(row),kind);assert.equal(JSON.stringify(row),before);assert.equal(env.CharDayLink.presentation({...row,world:{scene:'dayHome',spot:'read',manual:true}}).action,'read');}
});

test('洗漱和如厕各用真实设施，已占用的设施不抢；坐姿只在到达和使用期间启用',()=>{
 const map=changeHomeRoom({},{}).map,prev=MAPS.dayHome;MAPS.dayHome=map;
 try{const toilet=chorePlans(map,'toilet',map.spawn,null)[0],wash=chorePlans(map,'wash-hands',map.spawn,toilet.seat)[0];assert.ok(wash);assert.equal(chorePlans(map,'toilet',map.spawn,toilet.seat).length,0);
  assert.deepEqual(chorePose(toilet,2,false,toilet.at),{seated:true,seatPose:'chair',height:.61});
  for(const [elapsed,moving,at]of [[0,true,toilet.at],[toilet.duration,false,toilet.at],[2,false,map.spawn]])assert.deepEqual(chorePose(toilet,elapsed,moving,at),{});
  assert.deepEqual(chorePose(wash,2,false,wash.at),{});
 }finally{MAPS.dayHome=prev;}
});
