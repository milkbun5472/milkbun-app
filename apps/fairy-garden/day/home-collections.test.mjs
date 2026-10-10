import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_CATALOG,HOME_COLLECTIONS,BASE_HOME,homePlacements,homeFurniture} from './home-catalog.mjs';
import {addHomeFurniture,changeHomeFurniture,checkHomeLayout,restoreHomeLayout} from './home-layout.mjs';
import {MAPS,findPath,walkable} from '../world.mjs';

test('四组新增家具沿原实例存档，旧款和原房间不被替换',()=>{
 assert.equal(new Set(HOME_CATALOG.map(p=>p.id)).size,HOME_CATALOG.length);
 for(const id of Object.keys(HOME_COLLECTIONS))assert.equal(HOME_CATALOG.filter(p=>p.collection===id).length,8);
 assert.equal(BASE_HOME.length,12);assert.equal(homeFurniture({}).some(p=>p.collection),false);
 for(const p of HOME_CATALOG.filter(p=>p.collection)){
  const added=addHomeFurniture({},p.id),loaded=restoreHomeLayout(JSON.parse(JSON.stringify(added.placements)));
  assert.equal(loaded[added.selected].catalogId,p.id);assert.deepEqual(homePlacements(loaded),added.placements);
 }
});
test('四张地毯允许桌椅叠放和通行，但仍检查房间边界和隔墙',()=>{
 for(const p of HOME_CATALOG.filter(p=>p.kind==='rug')){
  const added=addHomeFurniture({},p.id),moved=changeHomeFurniture(added.placements,added.selected,{x:3,z:0});assert.equal(moved.ok,true,p.id);
  const map=moved.map;assert.equal(map.obstacles.some(o=>o.id===added.selected),false);
  const before=MAPS.dayHome;MAPS.dayHome=map;
  try{assert.equal(walkable(3,1.65,'dayHome'),true);assert.ok(findPath(map.spawn,map.spots.find(s=>s.id==='read').target,'dayHome').length);}finally{MAPS.dayHome=before;}
  assert.equal(changeHomeFurniture(moved.placements,added.selected,{x:7,z:0}).ok,false);
  assert.equal(changeHomeFurniture(moved.placements,added.selected,{x:-1.55,z:-3}).ok,false);
  assert.equal(changeHomeFurniture(moved.placements,added.selected,'rotate').ok,true);
  const second=addHomeFurniture(moved.placements,p.id);assert.ok(second.ok);assert.equal(second.placements[second.selected].stored,false);
  assert.equal(changeHomeFurniture(second.placements,second.selected,{x:3,z:0}).ok,false);
 }
});
test('屏风是实际障碍，不能挤进家具或门口；收纳同步放开通道',()=>{
 for(const p of HOME_CATALOG.filter(p=>p.kind==='screen')){
  const added=addHomeFurniture({},p.id);assert.ok(added.map.obstacles.some(o=>o.id===added.selected));
  assert.equal(changeHomeFurniture(added.placements,added.selected,{x:-3,z:1.4}).ok,false);
  assert.equal(changeHomeFurniture(added.placements,added.selected,{x:0,z:5}).ok,false);
  const stored=changeHomeFurniture(added.placements,added.selected,'store');assert.ok(stored.ok);assert.equal(stored.map.obstacles.some(o=>o.id===added.selected),false);
 }
});
test('新床沙发餐椅的指定用途、旋转后接触点与原坐睡契约相同',()=>{
 for(const p of HOME_CATALOG.filter(p=>p.collection&&['bed','sofa','chair'].includes(p.kind))){
  const raw=homePlacements();for(const id of Object.keys(raw))if(id!=='$room')raw[id].stored=true;
  const added=addHomeFurniture(raw,p.id),move=changeHomeFurniture(added.placements,added.selected,{x:0,z:0,heading:Math.PI/2}),used=changeHomeFurniture(move.placements,added.selected,'use');assert.equal(used.ok,true,p.id);
  const action=p.kind==='bed'?'sleep':p.kind==='chair'?'meal':'read',spot=used.map.spots.find(s=>s.id===action);assert.equal(spot.piece,added.selected);
  if(spot.seat){assert.equal(spot.seat.rise,.45);assert.equal(spot.seat.heading,Math.PI/2);}else{assert.equal(spot.sleep.y,.94);assert.equal(spot.sleep.heading,Math.PI/2);}
  assert.equal(checkHomeLayout(used.placements).ok,true);
 }
});
