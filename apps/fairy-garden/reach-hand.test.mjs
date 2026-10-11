import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('./vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{reachHand}=await import('./reach-hand.mjs');
function arm(side='right'){
 const root=new T.Group(),visual=new T.Group();visual.name='TravelerVisual';root.add(visual);
 const upper=new T.Bone(),lower=new T.Bone(),hand=new T.Object3D();upper.name=side+'Arm';upper.position.set(side==='right'?.165:-.165,.655,0);lower.position.y=.144;hand.position.y=.133;lower.userData.reachRest=new T.Quaternion();visual.add(upper);upper.add(lower);lower.add(hand);return {root,upper,lower,hand};
}
test('近身、托腮和桌面接触保留单轴肘关节与连续弯曲平面，转身与缩放也对准',()=>{
 for(const side of ['left','right'])for(const yaw of [0,1.7,-2.8])for(const scale of [.85,1,1.25]){
  const a=arm(side);a.root.rotation.y=yaw;a.root.scale.setScalar(scale);let previous;
  for(let i=0;i<100;i++){
   const local=new T.Vector3((side==='right'?1:-1)*(.11+.02*Math.sin(i/20)),.74+.01*Math.cos(i/20),.16),target=a.root.localToWorld(local);
   reachHand(a.root,a.upper,a.lower,a.hand,target);
   assert.ok(a.hand.getWorldPosition(new T.Vector3()).distanceTo(target)<.0001);
   const rest=a.lower.quaternion;assert.ok(Math.abs(rest.y)<1e-8&&Math.abs(rest.z)<1e-8,'elbow must not twist');
   const e=a.root.worldToLocal(a.lower.getWorldPosition(new T.Vector3()));assert.ok(e.y<.70,'elbow flips above shoulder');
   if(previous)assert.ok(e.distanceTo(previous)<.01,'elbow plane flips between nearby contacts');previous=e;
  }
 }
});
test('过近的接触不把前臂折回上臂，远处接触不拉长两段手臂',()=>{
 const a=arm(),shoulder=a.upper.getWorldPosition(new T.Vector3());
 for(const target of [shoulder.clone().add(new T.Vector3(.001,0,0)),new T.Vector3(2,1,3)]){
  reachHand(a.root,a.upper,a.lower,a.hand,target);
  const elbow=a.lower.getWorldPosition(new T.Vector3()),hand=a.hand.getWorldPosition(new T.Vector3());
  assert.ok(Math.abs(shoulder.distanceTo(elbow)-.144)<1e-6);assert.ok(Math.abs(hand.distanceTo(elbow)-.133)<1e-6);
  assert.ok(shoulder.clone().sub(elbow).angleTo(hand.clone().sub(elbow))>=Math.PI*.25-1e-5);
 }
});
