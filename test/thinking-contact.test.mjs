import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../apps/fairy-garden/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{reachHand}=await import('../apps/fairy-garden/reach-hand.mjs');
const {emotionPose}=await import('../apps/fairy-garden/emotion-pose.mjs');

test('thinking contact opens and raises the elbow while preserving both arm lengths and the target',()=>{
 const pose=emotionPose('chin',.5);
 assert.ok(pose.chinHold>.99);
 for(const side of [-1,1])for(const yaw of [0,1.7])for(const scale of [.85,1,1.25]){
  const root=new T.Group(),visual=new T.Group();visual.name='TravelerVisual';root.add(visual);root.rotation.y=yaw;root.scale.setScalar(scale);
  const upper=new T.Bone(),lower=new T.Bone(),hand=new T.Object3D();upper.name=(side<0?'left':'right')+'Arm';upper.position.set(side*.11,.65,-.011);lower.position.y=.155;hand.position.y=.143;lower.userData.reachRest=new T.Quaternion();visual.add(upper);upper.add(lower);lower.add(hand);
  let previous;
  for(let i=0;i<60;i++){
   const target=root.localToWorld(new T.Vector3(side*(.10+.002*Math.sin(i/10)),.755,.16));
   reachHand(root,upper,lower,hand,target,16,{elbowPole:pose.elbowPole});
   const S=upper.getWorldPosition(new T.Vector3()),E=lower.getWorldPosition(new T.Vector3()),H=hand.getWorldPosition(new T.Vector3());
   assert.ok(H.distanceTo(target)<1e-6);assert.ok(Math.abs(S.distanceTo(E)-.155*scale)<1e-6);assert.ok(Math.abs(E.distanceTo(H)-.143*scale)<1e-6);
   const local=root.worldToLocal(E);assert.ok(local.y>.65,'the elbow lifts instead of leaving a vertical forearm');
   if(previous)assert.ok(local.distanceTo(previous)<.005);previous=local;
   assert.ok(Math.abs(lower.quaternion.y)<1e-9&&Math.abs(lower.quaternion.z)<1e-9);
  }
 }
});
