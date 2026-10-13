import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{DAY_PLACES}=await import('./places/index.mjs'),{DAY_FACTORIES}=await import('./places/factories.mjs'),{activityPhase,taskAt}=await import('./workflow.mjs'),{updateWorkScene}=await import('./work-scene.mjs');
const release=root=>root.traverse(o=>{o.geometry?.dispose();[].concat(o.material||[]).forEach(m=>m.dispose());});
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
