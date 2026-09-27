import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MOODS,DUR,moodBase,accent,EXTRA_ACTIONS,chooseAction} from './motion.mjs';
test('all ten moods rest on the ground and use valid occasional actions',()=>{
 assert.equal(Object.keys(MOODS).length,10);
 for(const [face,m] of Object.entries(MOODS)){
  assert.ok(m.every>=8);
  for(const k of m.acts)assert.ok(DUR[k]>0);
  for(let t=0;t<120;t+=.1){const b=moodBase(face,t);assert.equal(b.y,0);assert.ok(Math.abs(b.tilt)<=.05);assert.ok(Math.abs(b.yaw)<.2);}
 }
});
test('accents settle at both ends without a jump or sharp velocity change',()=>{
 for(const k of ['hop','jolt','nod','sigh','stomp','turn','shy','land']){
  for(const p of [0,1])for(const v of Object.values(accent(k,p)))assert.ok(Math.abs(v)<1e-10,k);
  for(const p of [.0001,.9999])for(const v of Object.values(accent(k,p)))assert.ok(Math.abs(v)<.00001,k);
  for(let p=0;p<=1;p+=.001)for(const v of Object.values(accent(k,p)))assert.ok(Number.isFinite(v)&&Math.abs(v)<=.23,k);
 }
});

import {emotionPose} from '../fairy-garden/emotion-pose.mjs';
test('each expression has its own articulated action with neutral endpoints',()=>{
 const poses=[];
 for(const face of Object.keys(MOODS)){
  assert.ok(MOODS[face].acts.includes('emotion-'+face));
  poses.push(JSON.stringify(emotionPose(face,.4)));
  for(const p of [0,1])for(const v of Object.values(emotionPose(face,p)).flat())assert.ok(Math.abs(v)<1e-8);
  for(let p=0;p<1;p+=.01)for(const v of Object.values(emotionPose(face,p)).flat())assert.ok(Number.isFinite(v)&&Math.abs(v)<3);
 }
 assert.equal(new Set(poses).size,10);
});

test('new actions have a visible pose, settle cleanly and are reachable in matching moods',()=>{
 const signatures=[];
 for(const [name,a] of Object.entries(EXTRA_ACTIONS)){
  assert.ok(a.moods.length);assert.equal(DUR['emotion-'+name],a.duration);
  for(const mood of a.moods)assert.ok(MOODS[mood].acts.includes('emotion-'+name));
  for(const p of [0,1])assert.ok(Object.values(emotionPose(name,p)).flat().every(v=>Math.abs(v)<1e-8));
  const poses=[.2,.4,.6,.8].map(p=>emotionPose(name,p));signatures.push(JSON.stringify(poses));
  assert.ok(poses.some(q=>Math.max(...q.left.map(Math.abs),...q.right.map(Math.abs))>.7),name);
 }
 assert.equal(new Set(signatures).size,5);
});
test('repeated selections change the action, including duplicate entries and fallback moods',()=>{
 for(const m of Object.values(MOODS)){
  let last;for(let i=0;i<20;i++){const k=chooseAction(m.acts,last,()=>.5);assert.ok(m.acts.includes(k));assert.notEqual(k,last);last=k;}
 }
 assert.equal(chooseAction(['tea','tea'],'tea',()=>0),'tea');
});
