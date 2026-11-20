import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../apps/fairy-garden/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three');
const {handStyle,makeEmotionHands}=await import('../apps/fairy-garden/emotion-hands.mjs');
const {phoneTapTarget,phoneSurfaceTarget,makeEmotionProps,phoneHoldTarget,PHONE_PALM_PAD,PHONE_SCREEN_TAP}=await import('../apps/fairy-garden/emotion-props.mjs');

test('phone keeps both native palms visible and does not create a replacement hand',()=>{
 const model=new T.Group(),hands=makeEmotionHands(model,()=>new T.Vector3());
 for(const amount of [0,.05,.5,1]){
  const pose={phone:amount,phoneTap:1};
  for(const side of ['left','right'])assert.equal(handStyle(pose,side),null);
  hands.update(pose);assert.equal(model.getObjectByName('GesturePalm'),undefined);
 }
 hands.update({poke:1});const point=model.getObjectByName('CompanionHand-right-point');assert.equal(point.visible,true);hands.update({phone:1});assert.equal(point.visible,false);
 assert.equal(handStyle({poke:1},'right'),'point');
 assert.equal(handStyle({thumb:1},'right'),'thumb');
 assert.equal(handStyle({pinch:1},'right'),'pinch');
 assert.equal(handStyle({peace:1},'right'),'peace');
 assert.equal(handStyle({selfie:1},'left'),'peace');
});

test('native phone pad and visible phone use the same transformed grip and tap clearance',()=>{
 for(const scale of [.8,1,1.25])for(const yaw of [-1.2,0,.9])for(const amount of [.2,1])for(const tap of [0,1]){
  const root=new T.Group(),model=new T.Group();root.add(model);root.scale.setScalar(scale);root.rotation.set(.08,yaw,-.12);model.position.set(.3,.2,-.1);model.rotation.set(.1,-.2,.05);root.updateMatrixWorld(true);
  const left=model.localToWorld(new T.Vector3(-.1,.65,.2));
  const props=makeEmotionProps(model,()=>left.clone(),{makeCanvas:()=>null});props.update({phone:amount});root.updateMatrixWorld(true);
  const phone=model.getObjectByName('CompanionPhone');
  const screen=model.getObjectByName('PhoneScreen'),contact=screen.localToWorld(new T.Vector3(...PHONE_SCREEN_TAP).add(new T.Vector3(0,0,.01)));
  const retreat=new T.Vector3(0,0,.018*(1-tap)*amount).applyQuaternion(phone.quaternion);
  const grip=phoneTapTarget(model,left,tap,amount,1.1);
  const actual=model.localToWorld(model.worldToLocal(grip.clone()).add(new T.Vector3(...PHONE_PALM_PAD).multiplyScalar(1.1)));
  const expected=model.localToWorld(model.worldToLocal(contact.clone()).add(retreat));
  assert.ok(actual.distanceTo(expected)<1e-12);
  const surface=screen.localToWorld(new T.Vector3(...PHONE_SCREEN_TAP));
  const expectedSurface=model.localToWorld(model.worldToLocal(surface).add(retreat));
  assert.ok(phoneSurfaceTarget(model,left,tap,amount).distanceTo(expectedSurface)<1e-12);
 }
});

const {createHandSurfaceQuery}=await import('../apps/fairy-garden/avatar-motion/hand-surface-query.mjs');
test('hand surface query uses current geometry and world transform, without picking the other hand',()=>{
 const g=new T.BufferGeometry(),positions=[-.1,.4,0,.1,.4,0,0,.3,0, -.1,.4,.02,.1,.4,.02,0,.3,.02];
 g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('skinRightForearmInfluence',new T.Float32BufferAttribute([1,1,1,0,0,0],1));g.setAttribute('skinLeftForearmInfluence',new T.Float32BufferAttribute([0,0,0,1,1,1],1));g.setIndex([0,1,2,3,4,5]);
 const body=new T.Mesh(g),root=new T.Group();root.add(body);root.position.set(1,.2,-.3);root.rotation.y=.8;root.scale.set(1.2,.8,1.4);
 let shift=0;const query=createHandSurfaceQuery(body,positions,(i,p)=>p.fromBufferAttribute(g.attributes.position,i).add(new T.Vector3(0,0,shift)));
 for(shift of [0,.03]){
  root.updateMatrixWorld(true);const target=body.localToWorld(new T.Vector3(0,.36,.08+shift));
  for(const [side,z]of [['right',0],['left',.02]]){const expected=body.localToWorld(new T.Vector3(0,.36,z+shift));assert.ok(query(side,target).distanceTo(expected)<1e-8);}
 }
});

test('phone is held upright with its screen facing the doll and preserves the selfie grip',()=>{
 const model=new T.Group(),left=new T.Vector3(-.05,.5,.2),right=new T.Vector3(.08,.58,.22),props=makeEmotionProps(model,side=>(side==='left'?left:right).clone(),{makeCanvas:()=>null});
 for(const pose of [{phone:1},{selfie:1},{phone:.4},{phone:1}]){
  props.update(pose);model.updateMatrixWorld(true);const phone=model.getObjectByName('CompanionPhone'),screen=phone.getObjectByName('PhoneScreen');
  assert.ok(phone.getObjectByName('PhoneGrip').getWorldPosition(new T.Vector3()).distanceTo(pose.selfie?right:left)<1e-12);
  if(pose.selfie){assert.ok(Math.abs(phone.rotation.x+.2)<1e-12);continue;}
  const center=screen.getWorldPosition(new T.Vector3()),normal=new T.Vector3(0,0,1).transformDirection(screen.matrixWorld),head=new T.Vector3(0,.85,0);
  assert.ok(normal.dot(head.sub(center).normalize())>.5,'screen must face the doll, not the viewer');
  assert.ok(new T.Vector3(0,1,0).transformDirection(screen.matrixWorld).y>.9,'phone stays upright');
  assert.ok(Math.abs(PHONE_SCREEN_TAP[0])<screen.geometry.parameters.width/2&&Math.abs(PHONE_SCREEN_TAP[1])<screen.geometry.parameters.height/2);
 }
});

test('phone hold stays within both real arm reaches under scene transforms',()=>{
 for(const scale of [.75,1,1.3])for(const yaw of [-1.2,0,1.8]){
  const root=new T.Group(),model=new T.Group();root.add(model);root.scale.setScalar(scale);root.rotation.set(.15,yaw,-.08);root.position.set(2,.4,-1);root.updateMatrixWorld(true);
  const left=new T.Vector3(-.11,.65,-.011),right=new T.Vector3(.11,.65,-.011),elbow=new T.Vector3(-.19,.52,-.005),hand=new T.Vector3(-.269,.4,0),reach=left.distanceTo(elbow)+elbow.distanceTo(hand);
  const world=p=>model.localToWorld(p.clone()),hold=phoneHoldTarget(model,world(left),world(right),world(elbow),world(hand)),tap=phoneTapTarget(model,hold,1);
  const L=model.worldToLocal(hold.clone()),R=model.worldToLocal(tap.clone());
  assert.ok(L.distanceTo(left)<reach*.92&&R.distanceTo(right)<reach*.92,'both elbows retain bend room');
  assert.ok(L.x<0&&L.z>.12&&L.y<left.y&&L.y>.45,'hold is below the shoulders in front of the chest');
 }
});
