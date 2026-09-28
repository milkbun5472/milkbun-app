import {test} from 'node:test';
import assert from 'node:assert/strict';
import {targetAt,highFiveHit} from './touch-targets.mjs';
import {emotionPose} from '../fairy-garden/emotion-pose.mjs';
test('touches follow supplied screen targets; a raised hand takes priority over the face',()=>{
 const targets=[{kind:'face',x:100,y:80,rx:30,ry:20},{kind:'hand',side:'left',x:75,y:80,radius:12}];
 assert.equal(targetAt(75,80,targets).kind,'hand');assert.equal(targetAt(105,80,targets).side,'right');
 assert.equal(targetAt(10,10,targets),null);targets[0].visible=false;assert.equal(targetAt(105,80,targets),null);
 targets[1].x=200;assert.equal(targetAt(75,80,targets),null);assert.equal(targetAt(200,80,targets).kind,'hand');
});
test('high five requires the same offered hand during its held phase',()=>{
 const a={kind:'emotion-five-left',start:10};
 assert.equal(highFiveHit(a,'left',11.5,4.8),true);
 for(const [side,t] of [['right',11.5],['left',10.2],['left',14.6]])assert.equal(highFiveHit(a,side,t,4.8),false);
 assert.equal(highFiveHit({kind:'emotion-show',start:10},'left',11.5,6),false);
});
test('reactive poses settle, and a completed high five starts at the offered hand pose',()=>{
 for(const name of ['show','five-left','five-right','clap-left','clap-right','dodge-left','dodge-right']){
  for(const v of Object.values(emotionPose(name,1)).flat())assert.ok(Math.abs(v)<1e-8);
  for(let p=0;p<=1;p+=.01)assert.ok(Object.values(emotionPose(name,p)).flat().every(Number.isFinite));
 }
 for(const side of ['left','right'])assert.deepEqual(emotionPose('clap-'+side,0)[side],emotionPose('five-'+side,.5)[side]);
});
