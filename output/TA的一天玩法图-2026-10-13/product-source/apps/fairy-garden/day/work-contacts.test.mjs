import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{DAY_PLACES}=await import('./places/index.mjs'),{DAY_FACTORIES}=await import('./places/factories.mjs'),{activityPhase,taskAt}=await import('./workflow.mjs'),{updateWorkScene}=await import('./work-scene.mjs');
const release=root=>root.traverse(o=>{o.geometry?.dispose();[].concat(o.material||[]).forEach(m=>m.dispose());});
test('小家琴凳的真实坐面与坐高一致，琴键同时跟随四个装修朝向',async()=>{
 const {homePlacements,HOME_HOBBIES,furniturePoint}=await import('./home-catalog.mjs'),{buildSpace}=await import('./spaces.mjs'),{createSpaceView}=await import('./space-view.mjs'),{dailyTaskAt}=await import('./daily-workflow.mjs'),{WORK_CHAIR}=await import('./work-contacts.mjs');
 for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const raw=homePlacements();for(const p of Object.values(raw))if(p?.catalogId)p.stored=true;raw['furniture-1']={catalogId:'home-piano',x:2,z:1.5,heading};
  const map=buildSpace('dayHome',raw),spot=map.spots.find(s=>s.id==='piano'),piece=map.furniture.find(p=>p.id===spot.piece),view=createSpaceView('dayHome','warm',map,{furnitureOnly:true});view.root.updateMatrixWorld(true);
  const centre=furniturePoint(piece,{x:0,z:HOME_HOBBIES.piano.seat.z+WORK_CHAIR.forward}),ray=new T.Raycaster(new T.Vector3(centre.x,2,centre.z),new T.Vector3(0,-1,0));
  assert.ok(ray.intersectObject(view.root,true).some(h=>Math.abs(h.point.y-map.floor-spot.seat.rise)<.001),'stool top follows the actor support height');
  const task=dailyTaskAt({map:'dayHome',spot:'piano',action:'piano'},spot,map,3,{position:spot.target});assert.ok(task.workSurface);
  ray.set(new T.Vector3(task.contact.x,task.contact.y+.025,task.contact.z),new T.Vector3(0,-1,0));ray.far=.05;
  assert.ok(ray.intersectObject(view.root,true).some(h=>Math.abs(h.point.y-task.contact.y)<.001),'home hand contact is on the white key');release(view.root);
 }
});
test('打字与弹琴触点落在真实琴键和键盘上，两只手对准不同按键',()=>{
 let checked=0;
 for(const [id,map]of Object.entries(DAY_PLACES)){
  const view=DAY_FACTORIES[id]();view.root.updateMatrixWorld(true);
  for(const spot of map.spots){
   const stage=activityPhase({map:id,spot:spot.id,action:spot.action},null,null,{preview:true}),task=taskAt(stage,spot,map,3);
   if(!['type','piano'].includes(task?.kind))continue;
   const ray=new T.Raycaster(new T.Vector3(task.contact.x,task.contact.y+.02,task.contact.z),new T.Vector3(0,-1,0));ray.far=.04;
   assert.ok(ray.intersectObject(view.root,true).some(h=>Math.abs(h.point.y-task.contact.y)<.003),id+'/'+spot.id+' contact is on a key');
   assert.ok(task.leftTarget&&task.leftTarget.x>task.target.x);assert.ok(task.target.y>task.contact.y&&task.target.y-task.contact.y<.06);checked++;
  }
  release(view.root);
 }
 assert.ok(checked>=8);
});
test('混音双手与两个实体推子共用同一时段时钟，停止后复原',()=>{
 const map=DAY_PLACES.dayBroadcast,spot=map.spots.find(s=>s.id==='mix'),stage=activityPhase({map:'dayBroadcast',spot:'mix'},null,null,{preview:true}),view=DAY_FACTORIES.dayBroadcast();
 for(const elapsed of [0,1,3,7]){
  const task=taskAt(stage,spot,map,elapsed);updateWorkScene(view.root,task,false,999+elapsed);view.root.updateMatrixWorld(true);
  for(const [index,contact]of [[3,task.contact],[4,{...task.leftTarget,y:task.contact.y}]]){
   const fader=view.root.getObjectByName('MixFader:'+index),top=fader.localToWorld(new T.Vector3(0,.0115,0));
   assert.ok(top.distanceTo(new T.Vector3(contact.x,contact.y,contact.z))<1e-8,'actual cap follows its hand contact');
  }
 }
 const prior=view.root.getObjectByName('MixFader:3').position.z;updateWorkScene(view.root,null,true,1000);assert.notEqual(view.root.getObjectByName('MixFader:3').position.z,prior);release(view.root);
});
test('洗手位置在真实水槽范围内，且双手都在水槽上方',()=>{
 const map=DAY_PLACES.dayService,spot=map.spots.find(s=>s.id==='wash'),stage=activityPhase({map:'dayService',spot:'wash'},null,null,{preview:true}),task=taskAt(stage,spot,map,3),view=DAY_FACTORIES.dayService();view.root.updateMatrixWorld(true);
 const ray=new T.Raycaster(new T.Vector3(task.contact.x,task.contact.y+.02,task.contact.z),new T.Vector3(0,-1,0));ray.far=.04;assert.ok(ray.intersectObject(view.root.getObjectByName('wash-counter'),true).some(h=>Math.abs(h.point.y-task.contact.y)<.003));assert.ok(task.leftTarget&&task.leftTarget.x>task.target.x);release(view.root);
});
