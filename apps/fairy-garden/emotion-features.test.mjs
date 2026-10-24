import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('./vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{makeEmotionHands}=await import('./emotion-hands.mjs'),{makeEmotionFeatures,transientEmotionFace}=await import('./emotion-features.mjs'),{settleEmotionGround,emotionCameraFrame}=await import('./emotion-ground.mjs');
test('手势使用连续圆手套，随握点和肤色变化，比心保留原手并出现爱心',()=>{
 for(const yaw of [0,1.3,-2])for(const scale of [.8,1,1.2]){
  const root=new T.Group(),model=new T.Group();root.add(model);root.rotation.y=yaw;root.scale.setScalar(scale);
  const hands={left:new T.Object3D(),right:new T.Object3D()};for(const [side,hand]of Object.entries(hands)){model.add(hand);hand.position.set(side==='left'?-.08:.08,.65,.2);}
  const props=makeEmotionHands(model,side=>hands[side].getWorldPosition(new T.Vector3()));
  for(const kind of ['thumb','poke','pinch','phone']){
   props.update({[kind]:1,pinchTap:.5},{skin:'#c09a7d'});const groups=[];model.traverseVisible(o=>{if(o.name.startsWith('CompanionHand-'))groups.push(o);});assert.equal(groups.length,1);
   const group=groups[0],palm=group.getObjectByName('GesturePalm');assert.ok(group.getWorldPosition(new T.Vector3()).distanceTo(hands.right.getWorldPosition(new T.Vector3()))<1e-8);
   assert.equal(palm.material.color.getHexString(),'c09a7d');palm.geometry.computeBoundingBox();const size=palm.geometry.boundingBox.getSize(new T.Vector3());assert.ok(size.z>.06,'rounded depth');assert.ok(size.x>.075,'mitten palm');assert.ok(size.y<.15,'short silhouette');
   group.traverse(o=>assert.notEqual(o.geometry?.type,'TubeGeometry'));
   if(kind==='pinch'){assert.equal(palm.morphTargetInfluences[0],.75);assert.ok(palm.geometry.morphAttributes.position[0].array.some(v=>v<-.01));}
  }
  props.update({heart:1});assert.ok(model.getObjectByName('CompanionHeart').visible);model.traverse(o=>{if(o.name.startsWith('CompanionHand-'))assert.equal(o.visible,false);});
  props.update(null);assert.equal(model.getObjectByName('CompanionHeart').visible,false);model.traverse(o=>{if(o.name.startsWith('CompanionHand-'))assert.equal(o.visible,false);});
 }
});
test('眨眼只临时借用单眼表情，舌头与眼泪跟头部表面，结束全部归位',()=>{
 assert.equal(transientEmotionFace({wink:1}),'relax');assert.equal(transientEmotionFace({cry:1}),'sad');assert.equal(transientEmotionFace({tongue:1}),'happy');assert.equal(transientEmotionFace(null),null);
 const model=new T.Group(),head=new T.Group(),body=new T.Mesh(new T.SphereGeometry(1,24,16));head.name='HeadAnchor';body.name='DollBody';model.add(head,body);model.updateMatrixWorld(true);
 const features=makeEmotionFeatures(model);features.update({tongue:1});const tongue=head.getObjectByName('CompanionTongue');assert.ok(tongue.visible);assert.ok(tongue.position.z>.4);
 features.update({cry:1,tearPhase:.3});assert.equal(tongue.visible,false);const tears=head.getObjectByName('CompanionTears');assert.equal(tears.children.length,4);assert.ok(tears.children.every(o=>o.position.toArray().every(Number.isFinite)));
 features.update(null);assert.equal(tears.visible,false);assert.equal(tongue.visible,false);
});
test('前后躺按可见外轮廓落地并在两个水平轴居中，转身缩放也不会沉入地面',()=>{
 for(const yaw of [0,1.2,-2])for(const scale of [.8,1,1.25]){
  const root=new T.Group(),model=new T.Group(),body=new T.Mesh(new T.BoxGeometry(.3,1.2,.3));body.position.y=.6;model.add(body);root.add(model);root.rotation.y=yaw;root.scale.setScalar(scale);model.quaternion.setFromEuler(new T.Euler(1.35,-.32,0,'YXZ'));
  settleEmotionGround(root,model,1);const box=new T.Box3().setFromObject(body,true);assert.ok(Math.abs(box.min.y)<1e-8);const center=root.worldToLocal(box.getCenter(new T.Vector3()));assert.ok(Math.abs(center.x)<1e-8&&Math.abs(center.z)<1e-8);
  settleEmotionGround(root,model,0);assert.equal(root.userData.emotionGround,null);
 }
});

test('低姿态镜头连续下移中心并从上方看脸，站姿恢复原取景',()=>{
 const start=emotionCameraFrame(.615,3.3),end=emotionCameraFrame(.615,3.3,1),mid=emotionCameraFrame(.615,3.3,.5);
 assert.deepEqual(start,{position:[0,.665,3.3],target:[0,.615,0]});assert.equal(end.position[2],start.position[2]);assert.ok(end.position[1]>start.position[1]+.9);assert.ok(end.target[1]<start.target[1]-.29);
 assert.ok(Math.abs(mid.position[1]-(start.position[1]+end.position[1])/2)<1e-8);assert.deepEqual(emotionCameraFrame(.615,3.3,0),start);
});

test('打断持物动作再躺下时，道具旧位置不参与身体落地',()=>{
 const root=new T.Group(),model=new T.Group();root.add(model);const body=new T.Mesh(new T.BoxGeometry(.3,.4,1));body.position.y=.2;model.add(body);
 const phone=new T.Group();phone.name='CompanionPhone';const screen=new T.Mesh(new T.BoxGeometry(.1,.1,.1));screen.position.y=-2;phone.add(screen);model.add(phone);
 settleEmotionGround(root,model,1);assert.ok(Math.abs(root.position.y)<1e-8);assert.ok(Math.abs(root.userData.emotionGround.bottom)<1e-8);
});
