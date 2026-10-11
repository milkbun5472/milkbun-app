import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_CATALOG,homePlacements,homeFurniture} from './home-catalog.mjs';
import {HOME_SIZES} from './home-architecture.mjs';
import {checkHomeLayout,changeHomeRoom,changeHomeFurniture,addHomeFurniture,restoreHomeLayout} from './home-layout.mjs';
import {MAPS,findPath,segmentClear} from '../world.mjs';

test('三档扩建保留旧家具与坐睡点，门口和导航沿真实新边界',()=>{
 const old=homePlacements(),base=checkHomeLayout(old);
 for(const [size,dimensions]of Object.entries(HOME_SIZES)){
  const next=changeHomeRoom(old,{size});assert.ok(next.ok,size);assert.deepEqual(next.map.bounds,{w:dimensions.w,d:dimensions.d});
  for(const id of Object.keys(old).filter(id=>id!=='$room'))assert.deepEqual(next.placements[id],old[id]);
  assert.deepEqual(next.map.spots,base.map.spots);assert.equal(next.map.spawn.z,dimensions.d/2-.7);
  const previous=MAPS.dayHome;MAPS.dayHome=next.map;
  try{for(const spot of next.map.spots){const route=findPath(next.map.spawn,spot.target,'dayHome');assert.ok(route?.length);let at=next.map.spawn;for(const step of route){assert.ok(segmentClear(at,step,'dayHome'));at=step;}}}finally{MAPS.dayHome=previous;}
 }
 assert.equal(homePlacements({$room:{size:'unknown'}}).$room.size,'compact');
});
test('扩建区域可摆新装饰，缩小拒绝吞掉家具；挪回之后可缩回',()=>{
 const big=changeHomeRoom({}, {size:'loft'}),added=addHomeFurniture(big.placements,'plush-bear'),moved=changeHomeFurniture(added.placements,added.selected,{x:9,z:6});assert.ok(moved.ok);
 const json=JSON.stringify(moved.placements);assert.equal(changeHomeRoom(moved.placements,{size:'compact'}).ok,false);assert.equal(JSON.stringify(moved.placements),json);
 const back=changeHomeFurniture(moved.placements,added.selected,{x:5,z:2.5});assert.ok(back.ok);assert.ok(changeHomeRoom(back.placements,{size:'compact'}).ok);
});
test('二十件纯装饰有独立造型目录，十二件墙饰不占地面与日常路线',()=>{
 const ornaments=HOME_CATALOG.filter(p=>p.kind==='ornament');assert.equal(ornaments.length,20);assert.equal(ornaments.filter(p=>p.mount).length,12);
 const base=checkHomeLayout({});
 for(const item of ornaments){const added=addHomeFurniture({},item.id);assert.ok(added.ok,item.id);assert.equal(added.placements[added.selected].stored,false,item.id);
  if(item.mount){assert.deepEqual(added.map.obstacles,base.map.obstacles);assert.deepEqual(added.map.spots,base.map.spots);assert.deepEqual(restoreHomeLayout(JSON.parse(JSON.stringify(added.placements))),added.placements);}
 }
});
test('墙饰随扩建的墙面移动，保存沿墙位置与高度；换墙、收纳和摆回保留款色',()=>{
 const added=addHomeFurniture({},'botanical-frame'),id=added.selected,old=homeFurniture(added.placements).find(p=>p.id===id);
 const big=changeHomeRoom(added.placements,{size:'roomy'}),piece=homeFurniture(big.placements).find(p=>p.id===id);assert.equal(piece.x,old.x);assert.equal(piece.y,old.y);assert.equal(piece.z-old.z,-1.5);
 const left=changeHomeFurniture(big.placements,id,{wall:'left',along:0,y:1.9,color:'#aabbcc'});assert.ok(left.ok);const p=left.map.furniture.find(p=>p.id===id);assert.equal(p.heading,Math.PI/2);assert.equal(p.z,0);assert.ok(p.x<-8.5);
 const stored=changeHomeFurniture(left.placements,id,'store');assert.ok(stored.ok);assert.equal(stored.map.furniture.some(p=>p.id===id),false);
 const back=changeHomeFurniture(stored.placements,id,'restore');assert.ok(back.ok);assert.deepEqual(back.placements[id],left.placements[id]);
});
test('墙饰拒绝窗户、墙外、重叠、过低以及压住地面家具，失败保留原稿',()=>{
 const added=addHomeFurniture({},'botanical-frame'),id=added.selected,json=JSON.stringify(added.placements);
 for(const change of [{along:3.3,y:2},{along:10},{y:4},{y:.2}])assert.equal(changeHomeFurniture(added.placements,id,change).ok,false,JSON.stringify(change));
 const shelf=addHomeFurniture({},'cloud-wall-shelf');assert.equal(changeHomeFurniture(shelf.placements,shelf.selected,{wall:'left',along:-2.7,y:1.4}).ok,false);
 assert.equal(JSON.stringify(added.placements),json);
 const second=addHomeFurniture(added.placements,'arch-art');assert.ok(second.ok);assert.equal(changeHomeFurniture(second.placements,second.selected,{wall:'back',along:added.placements[id].along,y:added.placements[id].y}).ok,false);
});
test('墙地面与原装饰开关沿原房间存档；原墙饰收起后腾出的墙面可挂画',()=>{
 const added=addHomeFurniture({},'landscape-frame'),id=added.selected;assert.equal(changeHomeFurniture(added.placements,id,{along:-4,y:2.6}).ok,false);
 const changed=changeHomeRoom(added.placements,{originalRugs:false,originalWallDecor:false,wall:'botanical',floor:'herringbone'});assert.ok(changed.ok);
 const moved=changeHomeFurniture(changed.placements,id,{along:-4,y:2.6});assert.ok(moved.ok);assert.equal(changeHomeRoom(moved.placements,{originalWallDecor:true}).ok,false);
 assert.deepEqual(homePlacements(JSON.parse(JSON.stringify(moved.placements))),moved.placements);
});
