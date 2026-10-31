import {BASIN_USE} from './bathroom-layout.mjs?v=fg-bf2a8f69e3079bf5';
import * as T from 'three';
// Shared by both people. Effects live only while their real fixture is in use.
export function createBathroomVisual(avatar){
 const root=new T.Group();root.name='BathroomActivity';avatar.root.add(root);
 const waterMat=new T.MeshBasicMaterial({color:'#b9e1e5',transparent:true,opacity:.5,depthWrite:false}),foamMat=new T.MeshStandardMaterial({color:'#fff8e9',transparent:true,opacity:.74,roughness:1,depthWrite:false});
 const jet=new T.Mesh(new T.CylinderGeometry(.012,.012,1,7),waterMat);jet.name='BasinRunningWater';root.add(jet);
 const shower=new T.Group();shower.name='RunningShower';root.add(shower);
 for(let i=0;i<7;i++){const o=new T.Mesh(new T.CylinderGeometry(.008,.008,1,6),waterMat);o.position.set(Math.sin(i*2.4)*.13,1.48,Math.cos(i*2.4)*.13);o.scale.y=1.82;shower.add(o);}
 const curtain=new T.Group();curtain.name='ClosedShowerCurtain';root.add(curtain);
 const cloth=new T.MeshStandardMaterial({color:'#e9e3d4',roughness:1,side:T.DoubleSide});
 for(let i=0;i<12;i++){const o=new T.Mesh(new T.BoxGeometry(1/12,2.32,.035),cloth);o.position.set((i+.5)/12-.5,1.39,0);curtain.add(o);}
 const side=new T.Mesh(new T.BoxGeometry(.035,2.32,1),cloth);side.name='ShowerPrivacySide';root.add(side);
 const foam=new T.Group();foam.name='BathroomBubbles';root.add(foam);
 for(let i=0;i<8;i++){const o=new T.Mesh(new T.SphereGeometry(.048,10,7),foamMat);o.position.set(Math.sin(i*2.4)*.1,.95+Math.floor(i/3)*.065,Math.cos(i*2.4)*.07);foam.add(o);}
 function hide(){root.visible=false;}
 function update(plan,elapsed,moving){
  hide();if(!plan?.personal||moving||elapsed>=plan.duration||Math.hypot(avatar.root.position.x-plan.at.x,avatar.root.position.z-plan.at.z)>.22)return false;
  const f=plan.fixture;
  if(plan.kind==='toilet'){
   avatar.root.position.x=plan.seat.x;avatar.root.position.z=plan.seat.z;avatar.root.rotation.y=plan.heading;
   avatar.root.userData.chore={kind:plan.kind,piece:plan.piece,elapsed,seated:true,seat:plan.seat,leg:avatar.root.getObjectByName('leftLeg')?.rotation.x,knee:avatar.root.getObjectByName('leftKnee')?.rotation.x};return true;
  }
  root.visible=true;const washing=plan.kind==='wash-hands';jet.visible=washing;shower.visible=!washing;curtain.visible=side.visible=!washing;foam.visible=true;
  if(washing){
   const q=new T.Vector3(plan.target.x,plan.target.y,plan.target.z),h=plan.heading,right=new T.Vector3(Math.cos(h),0,-Math.sin(h));
   avatar.contactPose({right:q.clone().addScaledVector(right,.055+Math.sin(elapsed*4)*.012),left:q.clone().addScaledVector(right,-.055),lean:.07});
  }
  avatar.root.updateMatrixWorld(true);root.position.copy(avatar.root.worldToLocal(new T.Vector3(f.x,0,f.z)));root.quaternion.copy(avatar.root.getWorldQuaternion(new T.Quaternion()).invert().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),f.heading||0)));root.updateMatrixWorld(true);
  jet.position.set(0,(BASIN_USE.tapY+.96)/2,BASIN_USE.z);jet.scale.y=BASIN_USE.tapY-.96;
  curtain.position.set(0,0,f.d/2-.08);curtain.scale.x=f.w-.05;for(let i=0;i<curtain.children.length;i++)curtain.children[i].position.z=Math.sin(i*1.8)*.026;
  side.position.set(-f.w/2+.025,1.39,0);side.scale.z=f.d-.14;
  foam.position.set(0,washing?0:.55,washing?BASIN_USE.z:0);foam.scale.setScalar(washing?.9:2.2);
  foam.children.forEach((o,i)=>{o.scale.setScalar(.72+.25*Math.sin(elapsed*3+i));});
  let contact=null,leftContact=null;if(washing){const q=new T.Vector3(plan.target.x,plan.target.y,plan.target.z),right=new T.Vector3(Math.cos(plan.heading),0,-Math.sin(plan.heading));contact=avatar.root.getObjectByName('Right_hand')?.getWorldPosition(new T.Vector3()).distanceTo(q.clone().addScaledVector(right,.055+Math.sin(elapsed*4)*.012));leftContact=avatar.root.getObjectByName('Left_hand')?.getWorldPosition(new T.Vector3()).distanceTo(q.clone().addScaledVector(right,-.055));}
  avatar.root.userData.chore={kind:plan.kind,piece:plan.piece,elapsed,target:plan.target,contact,leftContact,hands:{right:avatar.root.getObjectByName('Right_hand')?.getWorldPosition(new T.Vector3()).toArray(),left:avatar.root.getObjectByName('Left_hand')?.getWorldPosition(new T.Vector3()).toArray()},water:true,curtain:!washing};return true;
 }
 hide();return {update,hide};
}
