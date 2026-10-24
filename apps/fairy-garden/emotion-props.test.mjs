import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('./vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{makeEmotionProps}=await import('./emotion-props.mjs');
test('小花握点跟随真实手部世界坐标，旋转、缩放与收回均一致',()=>{
 for(const scale of [.8,1,1.25])for(const yaw of [0,.8,-1.4]){
  const root=new T.Group(),model=new T.Group(),hand=new T.Object3D();root.add(model);model.add(hand);root.rotation.y=yaw;root.scale.setScalar(scale);model.rotation.set(.08,.15,-.04);
  const props=makeEmotionProps(model,()=>hand.getWorldPosition(new T.Vector3()));
  assert.equal(model.getObjectByName('CompanionFlower'),undefined);props.update({flower:1});const flower=model.getObjectByName('CompanionFlower');props.update(null);
  assert.equal(flower.visible,false);
  for(let i=0;i<20;i++){
   hand.position.set(.15+.03*Math.sin(i/3),.6+i*.005,.18+i*.012);props.update({flower:.5+i/40});root.updateWorldMatrix(true,true);
   assert.ok(flower.visible);const grip=model.getObjectByName('FlowerGrip');assert.ok(grip.getWorldPosition(new T.Vector3()).distanceTo(hand.getWorldPosition(new T.Vector3()))<1e-8);
  }
  props.update(null);assert.equal(flower.visible,false);props.update({flower:0});assert.equal(flower.visible,false);
  const petals=[];flower.traverse(o=>{if(o.name==='FlowerPetal')petals.push(o);});assert.equal(petals.length,5);assert.ok(flower.getObjectByName('FlowerStem'));
 }
});

test('礼盒双侧握点同时跟手，纸牌实际绘制中文，换动作就收回',()=>{
 for(const scale of [.8,1,1.25])for(const yaw of [0,.8,-1.4]){
  const root=new T.Group(),model=new T.Group();root.add(model);root.rotation.y=yaw;root.scale.setScalar(scale);model.rotation.set(.08,.15,-.04);
  const hands={left:new T.Object3D(),right:new T.Object3D()};Object.values(hands).forEach(h=>model.add(h));
  const text=[],ctx={fillRect(){},strokeRect(){},fillText(t){text.push(t);}},canvas={getContext:()=>ctx};
  const props=makeEmotionProps(model,side=>hands[side].getWorldPosition(new T.Vector3()),{makeCanvas:()=>canvas});
  assert.equal(model.getObjectByName('CompanionGift'),undefined);assert.equal(model.getObjectByName('CompanionSign'),undefined);
  for(let i=0;i<20;i++){
   hands.left.position.set(-.11,.6+i*.005,.2+i*.01);hands.right.position.set(.1+.01*Math.sin(i),.62+i*.005,.21+i*.01);
   props.update({gift:.3+i/30});root.updateWorldMatrix(true,true);
   for(const [side,name] of [['left','GiftGripLeft'],['right','GiftGripRight']])assert.ok(model.getObjectByName(name).getWorldPosition(new T.Vector3()).distanceTo(hands[side].getWorldPosition(new T.Vector3()))<1e-8);
  }
  props.update({sign:1,signSway:.08});assert.equal(model.getObjectByName('CompanionGift').visible,false);
  const sign=model.getObjectByName('CompanionSign');assert.equal(sign.visible,true);assert.deepEqual(text,['想你']);assert.ok(sign.getObjectByName('SignPaper').material.map?.isCanvasTexture);
  assert.ok(sign.getObjectByName('SignGrip').getWorldPosition(new T.Vector3()).distanceTo(hands.right.getWorldPosition(new T.Vector3()))<1e-8);
  props.update(null);assert.equal(sign.visible,false);assert.equal(model.getObjectByName('CompanionGift').visible,false);
 }
});
