import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{HOME_CATALOG,furnitureSeat}=await import('./home-catalog.mjs'),{createHomeFurniture}=await import('./home-furniture.mjs'),{createRoomKit}=await import('./places/room-kit.mjs'),{styleOf}=await import('./spaces.mjs');
test('全部沙发餐椅的旋转坐点：臀部下方是真坐面，深椅坐回座内、沙发小腿与鞋跟在坐垫外',()=>{
 for(const item of HOME_CATALOG.filter(p=>['sofa','chair'].includes(p.kind)))for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const p={...item,x:2,z:-1,heading},kit=createRoomKit(),g=createHomeFurniture(kit,p,styleOf('warm'));kit.root.updateMatrixWorld(true);
  const offset={x:p.kind==='sofa'?.6:0},seat=furnitureSeat(p,null,offset),forward={x:Math.sin(heading),z:Math.cos(heading)};
  const at=distance=>new T.Vector3(seat.x-forward.x*distance,2,seat.z-forward.z*distance);
  const cast=distance=>new T.Raycaster(at(distance),new T.Vector3(0,-1,0)).intersectObject(g,true).find(h=>h.point.y<=.533);
  const support=cast(p.kind==='sofa'?0:.1);assert.ok(support,item.id+' pelvis needs a cushion');assert.ok(Math.abs(support.point.y-.53)<.003,item.id+' actual seat height');
  // The bent knee places the shoes forward of the supported pelvis.
  if(p.kind==='sofa'){const heel=cast(-.10);assert.ok(!heel||heel.point.y<.51,item.id+' heel crosses cushion');}else{assert.equal(seat.pose,'deep');assert.ok(Math.abs((seat.x-p.x)*forward.x+(seat.z-p.z)*forward.z)<p.d/2-.07);}
 }
});
test('窄长椅的坐点在坐板内，四个朝向都由真实坐面承托',()=>{
 for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const p={id:'regression-bench',kind:'bench',x:2,z:-1,w:3.4,d:.65,heading},kit=createRoomKit(),bench=kit.bench(p),seat=furnitureSeat(p);kit.root.updateMatrixWorld(true);
  const hit=new T.Raycaster(new T.Vector3(seat.x,2,seat.z),new T.Vector3(0,-1,0)).intersectObject(bench,true)[0];
  assert.ok(hit,'pelvis cannot hang beyond the bench edge');assert.ok(Math.abs(hit.point.y-.53)<.003);assert.equal(seat.pose,'chair');
 }
});
test('每处职业场景的长椅坐点落在实际构建的坐板上',async()=>{
 const {DAY_PLACES}=await import('./places/index.mjs'),{DAY_FACTORIES}=await import('./places/factories.mjs');let checked=0;
 for(const [id,map]of Object.entries(DAY_PLACES)){
  if(!map.furniture.some(p=>p.kind==='bench'))continue;const view=DAY_FACTORIES[id]();view.root.updateMatrixWorld(true);
  for(const seat of Object.values(map.seats||{})){
   if(!map.furniture.some(p=>p.kind==='bench'&&p.id===seat.piece))continue;
   const hits=new T.Raycaster(new T.Vector3(seat.x,2,seat.z),new T.Vector3(0,-1,0)).intersectObject(view.root,true);
   assert.ok(hits.some(h=>Math.abs(h.point.y-map.floor-seat.rise)<.007),id+' '+seat.piece+' pelvis support');checked++;
  }
  view.root.traverse(o=>{o.geometry?.dispose();[].concat(o.material||[]).forEach(m=>m.dispose());});
 }
 assert.ok(checked>=18);
});

test('旧档前沿外的沙发坐点恢复到真正坐面内，保留同一侧座位',()=>{
 for(const item of HOME_CATALOG.filter(p=>p.kind==='sofa'))for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const p={...item,x:2,z:-1,heading},kit=createRoomKit(),g=createHomeFurniture(kit,p,styleOf('warm'));kit.root.updateMatrixWorld(true);
  const surface=p.collection?{z:.035,d:p.d-(p.collection==='soft'?.14:.22)}:{z:.065,d:p.d-.31},saved={x:.6,z:surface.z+surface.d/2+.05},seat=furnitureSeat(p,null,saved);
  const ray=new T.Raycaster(new T.Vector3(seat.x,2,seat.z),new T.Vector3(0,-1,0));assert.ok(ray.intersectObject(g,true).some(h=>Math.abs(h.point.y-.53)<.003));
  const dx=seat.x-p.x,dz=seat.z-p.z;assert.ok(Math.abs(dx*Math.cos(heading)-dz*Math.sin(heading)-.6)<1e-8);
 }
});
test('全部小家床铺的躺姿支撑高度就是实体被面，旋转后仍一致',async()=>{
 const {HOME_BED_SURFACE,furniturePoint}=await import('./home-catalog.mjs'),{buildSpace}=await import('./spaces.mjs');
 for(const item of HOME_CATALOG.filter(p=>p.kind==='bed'))for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const p={...item,x:2,z:-1,heading},kit=createRoomKit(),g=createHomeFurniture(kit,p,styleOf('warm'));kit.root.updateMatrixWorld(true);const q=furniturePoint(p,{x:.55,z:.35});
  const ray=new T.Raycaster(new T.Vector3(q.x,1,q.z),new T.Vector3(0,-1,0)),hit=ray.intersectObject(g,true)[0];assert.ok(Math.abs(hit.point.y-HOME_BED_SURFACE)<.003);
  const map=buildSpace('dayHome',{'double-bed':{x:2,z:-1,heading}});assert.equal(map.spots.find(s=>s.id==='sleep').sleep.supportY,HOME_BED_SURFACE);
 }
});
