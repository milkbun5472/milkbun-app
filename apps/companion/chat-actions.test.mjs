import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHAT_ACTIONS,DUR,MOODS} from './motion.mjs';
import {emotionPose} from '../fairy-garden/emotion-pose.mjs';
test('全部聊天专属动作起止归零，动作不同且不会随机进入待机',()=>{
 const signatures=[];
 for(const [name,duration] of Object.entries(CHAT_ACTIONS)){
  assert.equal(DUR['emotion-'+name],duration);
  assert.ok(Object.values(MOODS).every(m=>!m.acts.includes('emotion-'+name)));
  for(const p of [0,1])assert.ok(Object.values(emotionPose(name,p)).flat().every(v=>Math.abs(v)<1e-8),name);
  for(let j=0;j<=100;j++)assert.ok(Object.values(emotionPose(name,j/100)).flat().every(v=>Number.isFinite(v)&&Math.abs(v)<3),name);
  signatures.push(JSON.stringify([.2,.4,.6,.8].map(p=>emotionPose(name,p))));
 }
 assert.equal(new Set(signatures).size,Object.keys(CHAT_ACTIONS).length);
});
test('新双手动作各自定位，后脑与眼前揉动分开，小花只在递出期间出现',()=>{
 for(const name of ['cheeks','plead','crossarms']){
  const q=emotionPose(name,.4);assert.equal(q.headHold,1);assert.equal(q.leftHeadHold,1);
  assert.ok(q.rightElbow<-1&&q.leftElbow<-1);assert.ok(q.headPoint&&q.leftHeadPoint);
 }
 const face=emotionPose('cheeks',.4);assert.ok(face.leftHeadPoint[0]<0&&face.headPoint[0]>0);
 const cross=emotionPose('crossarms',.4);assert.ok(cross.leftHeadPoint[0]>0&&cross.headPoint[0]<0);
 assert.ok(emotionPose('scratch',.4).headPoint[2]<0);assert.ok(emotionPose('rubeyes',.4).headPoint[2]>1);
 assert.equal(emotionPose('flower',0).flower,0);assert.equal(emotionPose('flower',1).flower,0);assert.ok(emotionPose('flower',.5).flower>.99);
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

test('余下六种动作有各自的接触位置与节奏，遮眼后会揭开，道具会收回',()=>{
 for(const name of ['hips','selfhug','peekaboo','gift']){
  const q=emotionPose(name,.3);assert.equal(q.headHold,1);assert.equal(q.leftHeadHold,1);
 }
 const hips=emotionPose('hips',.4);assert.ok(hips.headPoint[1]<-2&&hips.leftHeadPoint[0]<0&&hips.headPoint[0]>0);
 const hug=emotionPose('selfhug',.4);assert.ok(hug.leftHeadPoint[0]>0&&hug.headPoint[0]<0);
 assert.ok(emotionPose('selfhug',.35).roll*emotionPose('selfhug',.6).roll<0);
 const hide=emotionPose('peekaboo',.3),reveal=emotionPose('peekaboo',.7);assert.ok(reveal.headPoint[0]-hide.headPoint[0]>1);assert.ok(hide.headPoint[2]>1.3);
 assert.ok(emotionPose('sneeze',.26).tilt<0);assert.ok(emotionPose('sneeze',.4).tilt>.14);assert.equal(emotionPose('sneeze',.65).tilt,0);
 for(const name of ['gift','sign']){assert.equal(emotionPose(name,0)[name],0);assert.equal(emotionPose(name,1)[name],0);assert.equal(emotionPose(name,.5)[name],1);}
 assert.ok(emotionPose('gift',.6).headPoint[2]>emotionPose('gift',.18).headPoint[2]+1);
});
