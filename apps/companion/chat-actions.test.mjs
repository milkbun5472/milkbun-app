import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHAT_ACTIONS,DUR,MOODS} from './motion.mjs';
import {emotionPose} from '../fairy-garden/emotion-pose.mjs';
test('六套聊天动作起止归零，动作不同且不会随机进入待机',()=>{
 const signatures=[];
 for(const [name,duration] of Object.entries(CHAT_ACTIONS)){
  assert.equal(DUR['emotion-'+name],duration);
  assert.ok(Object.values(MOODS).every(m=>!m.acts.includes('emotion-'+name)));
  for(const p of [0,1])assert.ok(Object.values(emotionPose(name,p)).flat().every(v=>Math.abs(v)<1e-8),name);
  for(let j=0;j<=100;j++)assert.ok(Object.values(emotionPose(name,j/100)).flat().every(v=>Number.isFinite(v)&&Math.abs(v)<3),name);
  signatures.push(JSON.stringify([.2,.4,.6,.8].map(p=>emotionPose(name,p))));
 }
 assert.equal(new Set(signatures).size,6);
});
test('飞吻先停在嘴前再送出，偷笑与侧耳各有稳定的头部相对目标',()=>{
 const early=emotionPose('kiss',.3),late=emotionPose('kiss',.7);
 assert.ok(late.headPoint[2]-early.headPoint[2]>.8);
 for(const name of ['kiss','giggle','listen']){
  const q=emotionPose(name,.4);assert.equal(q.headHold,1);assert.ok(q.rightElbow<-1);
  const [x,y,z]=q.headPoint;assert.ok((x/.95)**2+(y/.85)**2+(z/.8)**2>1.8,name);
 }
 assert.notDeepEqual(emotionPose('giggle',.4).headPoint,emotionPose('listen',.4).headPoint);
});
