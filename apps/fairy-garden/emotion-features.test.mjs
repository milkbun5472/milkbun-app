import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('./vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{makeEmotionHands}=await import('./emotion-hands.mjs'),{makeEmotionFeatures,transientEmotionFace}=await import('./emotion-features.mjs'),{settleEmotionGround}=await import('./emotion-ground.mjs');
test('手势有真实指形，握点随转身缩放和肤色，结束隐藏全部替换手',()=>{
 for(const yaw of [0,1.3,-2])for(const scale of [.8,1,1.2]){
  const root=new T.Group(),model=new T.Group();root.add(model);root.rotation.y=yaw;root.scale.setScalar(scale);
  const hands={left:new T.Object3D(),right:new T.Object3D()};for(const [side,hand] of Object.entries(hands)){model.add(hand);hand.position.set(side==='left'?-.08:.08,.65,.2);}
  const props=makeEmotionHands(model,side=>hands[side].getWorldPosition(new T.Vector3()));assert.equal(model.children.filter(o=>o.name.startsWith('CompanionHand')).length,0);
  for(const [kind,part] of [['heart','HeartIndex'],['thumb','RaisedThumb'],['poke','PointIndex'],['pinch','PinchIndex'],['phone','PointIndex']]){
   props.update({[kind]:1,pinchTap:.5},{skin:'#c09a7d'});const groups=[];model.traverseVisible(o=>{if(o.name.startsWith('CompanionHand-'))groups.push(o);});assert.equal(groups.length,kind==='heart'?2:1);
   for(const group of groups){const side=group.name.includes('-left-')?'left':'right';assert.ok(group.getWorldPosition(new T.Vector3()).distanceTo(hands[side].getWorldPosition(new T.Vector3()))<1e-8);assert.ok(group.getObjectByName(part));assert.equal(group.getObjectByName('GesturePalm').material.color.getHexString(),'c09a7d');}
  }
  props.update(null);model.traverse(o=>{if(o.name.startsWith('CompanionHand-'))assert.equal(o.visible,false);});
 }
});
test('眨眼只临时借用单眼表情，舌头与眼泪跟头部表面，结束全部归位',()=>{
 assert.equal(transientEmotionFace({wink:1}),'relax');assert.equal(transientEmotionFace({cry:1}),'sad');assert.equal(transientEmotionFace({tongue:1}),'happy');assert.equal(transientEmotionFace(null),null);
 const model=new T.Group(),head=new T.Group(),body=new T.Mesh(new T.SphereGeometry(1,24,16));head.name='HeadAnchor';body.name='DollBody';model.add(head,body);model.updateMatrixWorld(true);
 const features=makeEmotionFeatures(model);features.update({tongue:1});const tongue=head.getObjectByName('CompanionTongue');assert.ok(tongue.visible);assert.ok(tongue.position.z>.4);
 features.update({cry:1,tearPhase:.3});assert.equal(tongue.visible,false);const tears=head.getObjectByName('CompanionTears');assert.equal(tears.children.length,4);assert.ok(tears.children.every(o=>o.position.toArray().every(Number.isFinite)));
 features.update(null);assert.equal(tears.visible,false);assert.equal(tongue.visible,false);
});
test('横躺按可见外轮廓落地并居中，转身缩放也不会沉入地面',()=>{
 for(const yaw of [0,1.2,-2])for(const scale of [.8,1,1.25]){
  const root=new T.Group(),model=new T.Group(),body=new T.Mesh(new T.BoxGeometry(.3,1.2,.3));body.position.y=.6;model.add(body);root.add(model);root.rotation.y=yaw;root.scale.setScalar(scale);model.rotation.z=-1.42;
  settleEmotionGround(root,model,1);const box=new T.Box3().setFromObject(body,true);assert.ok(Math.abs(box.min.y)<1e-8);assert.ok(Math.abs(root.worldToLocal(box.getCenter(new T.Vector3())).x)<1e-8);
  settleEmotionGround(root,model,0);assert.equal(root.userData.emotionGround,null);
 }
});
