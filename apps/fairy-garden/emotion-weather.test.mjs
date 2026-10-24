import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('./vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{makeWeatherEffects}=await import('./emotion-weather.mjs'),{emotionPose}=await import('./emotion-pose.mjs'),{makeEmotionProps}=await import('./emotion-props.mjs'),{WEATHER_ACTIONS,DUR,MOODS}=await import('../companion/motion.mjs');
test('天气动作时长完整且不混进晴天随机待机；姿势完整收回',()=>{
 for(const [name,duration]of Object.entries(WEATHER_ACTIONS)){
  assert.equal(DUR['emotion-'+name],duration);assert.ok(Object.values(MOODS).every(m=>!m.acts.includes('emotion-'+name)));
  const end=emotionPose(name,1);for(const v of [...end.left,...end.right,end.tilt,end.roll,end.yaw,end.lift,end.headHold||0,end.leftHeadHold||0,end.weatherAmount||0,end.umbrella||0])assert.equal(Math.abs(v),0,name);
 }
});
test('雨雪哈气等只有动作期间分配及显示，跟随变换后的手、结束全部隐藏',()=>{
 const model=new T.Group(),head=new T.Group(),hand=new T.Object3D();head.name='HeadAnchor';head.scale.setScalar(.2);head.position.y=1;hand.position.set(-.25,.7,.3);model.add(head,hand);model.rotation.y=.7;model.scale.setScalar(1.2);
 const fx=makeWeatherEffects(model,()=>hand.getWorldPosition(new T.Vector3()));assert.equal(model.children.length,2);
 for(const name of Object.keys(WEATHER_ACTIONS)){for(const p of [.2,.4,.6,.8]){fx.update(emotionPose(name,p));model.updateMatrixWorld(true,true);model.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}fx.update(null);model.traverse(o=>{if(o.name.startsWith('CompanionWeather-'))assert.equal(o.visible,false);});}
 fx.update(emotionPose('catchsnow',.45));const snow=model.getObjectByName('CompanionWeather-snow'),before=snow.children[0].getWorldPosition(new T.Vector3());hand.position.x-=.2;fx.update(emotionPose('catchsnow',.45));model.updateMatrixWorld(true,true);assert.ok(snow.children[0].getWorldPosition(new T.Vector3()).distanceTo(before)>.2);
});
test('收伞合拢伞面仍握在手中，后续撑伞恢复整张伞面',()=>{
 const model=new T.Group(),hand=new T.Object3D();model.add(hand);hand.position.set(.25,.7,.25);const props=makeEmotionProps(model,()=>hand.getWorldPosition(new T.Vector3()));
 props.update(emotionPose('rainclose',.6));model.updateMatrixWorld(true,true);const umbrella=model.getObjectByName('CompanionUmbrella');assert.ok(umbrella.visible);assert.ok(umbrella.getObjectByName('UmbrellaCanopy').scale.x<.11);assert.ok(umbrella.getObjectByName('UmbrellaGrip').getWorldPosition(new T.Vector3()).distanceTo(hand.getWorldPosition(new T.Vector3()))<1e-8);
 props.update(emotionPose('catchrain',.5));assert.equal(umbrella.getObjectByName('UmbrellaCanopy').scale.x,1);props.update(null);assert.equal(umbrella.visible,false);
});
