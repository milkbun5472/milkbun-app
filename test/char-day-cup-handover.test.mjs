import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../apps/fairy-garden/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three');
const {MAPS}=await import('../apps/fairy-garden/world.mjs');
const {buildSpace}=await import('../apps/fairy-garden/day/spaces.mjs');
const {createTogether}=await import('../apps/fairy-garden/day/together.mjs');
function actor(){
 const root=new T.Group();
 for(const [name,x,y]of [['body',0,.3],['leftArm',-.16,.65],['rightArm',.16,.65],['Left_hand',-.16,.3],['Right_hand',.16,.3],['HeadAnchor',0,.95]]){
  const p=new T.Group();p.name=name;p.position.set(x,y,0);root.add(p);
 }
 return {root,animate(_time,p){root.position.y=p.height;},contactPose(p){for(const [side,name]of [['left','Left_hand'],['right','Right_hand']])if(p[side])root.getObjectByName(name).position.copy(root.worldToLocal(p[side].clone()));}};
}
test('递水按发起人交出杯子，接稳后收手，暂停恢复保留交接方向，结束藏杯',()=>{
 MAPS.dayHome=buildSpace('dayHome');
 for(const initiator of ['a','b']){
  const a=actor(),b=actor(),ctl=createTogether({a,b,map:()=>MAPS.dayHome,from:()=>({a:{x:0,z:3.3},b:{x:0,z:4.8}})});let time=0;
  assert.ok(ctl.start('cup',{initiator}).ok);
  for(let n=0;n<3000&&ctl.inspect()?.phase!=='active';n++)ctl.tick(.025,time+=.025);
  assert.equal(ctl.inspect()?.phase,'active');ctl.tick(.025,time+=.025);
  const cup=a.root.getObjectByName('TogetherCup'),giver=initiator==='a'?'ta':'me',receiver=giver==='ta'?'me':'ta';
  assert.equal(cup.userData.holder,giver);assert.equal(ctl.inspect().contact.giver,giver);
  for(let n=0;n<230;n++)ctl.tick(.025,time+=.025);
  assert.equal(cup.userData.holder,receiver);assert.equal(ctl.inspect().contact.release,1);
  const saved=ctl.pauseState();ctl.stop();assert.equal(cup.visible,false);assert.ok(ctl.restore(saved));ctl.tick(.025,time+=.025);
  assert.equal(cup.userData.holder,receiver);assert.equal(ctl.inspect().contact.giver,giver);assert.equal(cup.visible,true);
  ctl.dispose();assert.equal(cup.visible,false);assert.equal(ctl.inspect(),null);
 }
});
