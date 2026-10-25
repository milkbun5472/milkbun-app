import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeInteractions,afterInteraction} from './interactions.mjs';
import {emotionPose} from '../fairy-garden/emotion-pose.mjs';
import {DUR} from './motion.mjs';
const head={kind:'head'},left={kind:'hand',side:'left'},right={kind:'hand',side:'right'};
test('举手后要接同一只手；过早、过晚、另一只手都不算击掌，也不重置邀请',()=>{
 const m=makeInteractions(),offer=m.touch(left,null,0,'happy');assert.equal(offer.kind,'emotion-five-left');
 for(const [target,t] of [[left,.2],[right,2],[left,4.6]])assert.equal(m.touch(target,offer,t,'happy'),offer);
 const hit=m.touch(left,offer,2,'happy');assert.equal(hit.kind,'emotion-clap-left');assert.equal(afterInteraction(hit,4),null);
 assert.equal(afterInteraction(offer,5).kind,'emotion-peek','没有接到，放下后看回来');
 assert.equal(m.touch(left,offer,2,'irritated').kind,'emotion-irritated','心情变了，不强迫击掌');
});
test('连续摸头会从抬眼到靠近；继续摸不每次弹回起点；间隔和切角色重置',()=>{
 const m=makeInteractions();let a=m.touch(head,null,1,'happy');assert.equal(a.kind,'emotion-headlook');
 a=m.touch(head,a,2,'happy');assert.equal(a.kind,'emotion-headpat');
 a=m.touch(head,a,3,'happy');assert.equal(a.kind,'emotion-headnest');
 const continued=m.touch(head,a,4,'happy');assert.equal(continued.start,3);
 a=m.touch(head,continued,20,'happy');assert.equal(a.kind,'emotion-headlook');m.reset();assert.equal(m.touch(head,a,21,'happy').kind,'emotion-headlook');
 m.breakHead();assert.equal(m.touch(head,null,21.5,'happy').kind,'emotion-headlook');
 m.touch(right,null,22,'happy');assert.equal(m.touch(head,null,23,'happy').kind,'emotion-headlook');
});
test('不耐烦时先躲再转身，低落时先安静回应再轻靠，实际心情不被修改',()=>{
 const m=makeInteractions();assert.equal(m.touch(head,null,1,'irritated').kind,'emotion-dodge-left');assert.equal(m.touch(head,null,2,'irritated').kind,'emotion-irritated');m.reset();
 assert.equal(m.touch(head,null,3,'sad').kind,'emotion-sad');assert.equal(m.touch(head,null,4,'sad').kind,'emotion-headpat');assert.equal(m.touch(head,null,5,'sad').kind,'emotion-headnest');
});
test('放下先落地、理衣服，再按心情回应；20秒内再拎会抱起胳膊，超时重新整理',()=>{
 const m=makeInteractions();let a=m.drop(1,'irritated');assert.equal(a.kind,'land');a=afterInteraction(a,2);assert.equal(a.kind,'emotion-tidy');a=afterInteraction(a,6);assert.equal(a.kind,'emotion-irritated');assert.equal(afterInteraction(a,12),null);
 a=m.drop(14,'happy');assert.equal(afterInteraction(a,15).kind,'emotion-crossarms');a=m.drop(40,'happy');assert.equal(afterInteraction(a,41).kind,'emotion-tidy');
 m.reset();assert.equal(afterInteraction(m.drop(41,'happy'),42).kind,'emotion-tidy');
});
test('新姿势无额外手指或道具，端点回正、肢体幅度有限',()=>{
 for(const name of ['headlook','headnest','tidy']){
  assert.ok(DUR['emotion-'+name]>0);
  for(const p of [0,1])for(const v of Object.values(emotionPose(name,p)).flat())assert.ok(Math.abs(v)<1e-8,name+' endpoint');
  for(let p=0;p<=1;p+=.01){const q=emotionPose(name,p);for(const v of Object.values(q).flat())assert.ok(Number.isFinite(v)&&Math.abs(v)<2,name);for(const k of ['thumb','peace','pinch','poke','phone'])assert.equal(q[k],undefined);assert.ok(Math.abs(q.tilt)<.15);}
 }
});
