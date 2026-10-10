import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_SPACES,buildSpace,registerCoreSpaces} from './spaces.mjs';
import {MAPS,walkable,findPath,segmentClear} from '../world.mjs';
const original=JSON.stringify({home:MAPS.home,hall:MAPS.hall,garden:MAPS.garden});
registerCoreSpaces(MAPS);
test('四日常场景独立注册，原三游戏地图保持原定义',()=>{
 assert.equal(Object.keys(CORE_SPACES).length,4);
 assert.equal(JSON.stringify({home:MAPS.home,hall:MAPS.hall,garden:MAPS.garden}),original);
 assert.ok(CORE_SPACES.dayHome.bounds.w>=14);assert.equal(CORE_SPACES.dayHome.zones.length,4);
});
for(const [id,map]of Object.entries(CORE_SPACES))test(id+'每个家具动作点与街道漫步点都实际可达，路线避开家具',()=>{
 assert.ok(walkable(map.spawn.x,map.spawn.z,id));
 for(const target of [...map.spots.map(s=>s.target),...(map.wander||[])]){
  assert.ok(walkable(target.x,target.z,id),JSON.stringify(target));
  const route=findPath(map.spawn,target,id);assert.ok(route?.length,'路线 '+JSON.stringify(target));
  let from=map.spawn;for(const to of route){assert.ok(segmentClear(from,to,id));from=to;}
 }
});
test('同一件家具的摆位同时更新碰撞、坐位与接近点，不写死坐标',()=>{
 const before=buildSpace('dayCafe'),old=before.spots.find(s=>s.id==='meal');
 const moved=buildSpace('dayCafe',{'cafe-chair':{x:old.seat.x+.6,z:old.seat.z+.7,heading:Math.PI/2}}),spot=moved.spots.find(s=>s.id==='meal');
 const chair=moved.furniture.find(p=>p.id==='cafe-chair');assert.equal(spot.seat.heading,Math.PI/2);assert.equal(spot.seat.pose,'chair');
 assert.ok(Math.abs(spot.seat.x-chair.x-(chair.d-.018)/2-.05)<1e-10);assert.ok(Math.abs(spot.seat.z-chair.z)<1e-10);
 assert.ok(Math.abs(spot.target.x-chair.x)<1e-10);assert.ok(Math.abs(spot.target.z-chair.z-.9)<1e-10);
 const obstacle=moved.obstacles.find(o=>o.id==='cafe-chair');assert.equal(obstacle.x,chair.x);assert.ok(Math.abs(obstacle.w-.57)<1e-10);
 assert.equal(CORE_SPACES.dayCafe.spots.find(s=>s.id==='meal').seat.x,old.seat.x);
});
