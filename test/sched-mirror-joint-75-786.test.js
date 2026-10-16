const test=require('node:test'),assert=require('node:assert');
const {mirrorJoint}=require('../js/schedule-clock.js');
const peer=[{seq:1,time:"17:00",end:"18:30",title:"发送终版成图"},{seq:2,time:"18:30",end:"20:15",title:"做晚餐"},{seq:3,time:"20:15",end:"23:00",title:"沙发放空"}];
const row={time:"19:30",end:"21:00",title:"与Lisa、顾朝一起吃外带寿喜烧",location:"公寓客厅矮桌"};
test('A 排了和 B 一起的事，B 那天补上同一段，撞上的让开',()=>{
  const out=mirrorJoint(peer,row,"顾暮","顾朝");
  const j=out.find(q=>q.title==="与Lisa、顾暮一起吃外带寿喜烧");
  assert.ok(j);assert.equal(j.time,"19:30");assert.equal(j.location,"公寓客厅矮桌");
  assert.equal(out.find(q=>q.title==="做晚餐").end,"19:30");
  assert.equal(out.find(q=>q.title==="沙发放空").time,"21:00");
  for(let i=1;i<out.length;i++)assert.ok(out[i-1].end<=out[i].time);
});
test('B 已经有一段点到 A 且时间搭得上，就不动',()=>{
  assert.equal(mirrorJoint([{time:"19:00",end:"21:00",title:"和顾暮吃饭"}],row,"顾暮","顾朝"),null);
});
test('app 两条排日程的路都接了 schedMirrorPeers',()=>{
  const s=require('fs').readFileSync(__dirname+'/../js/app.js','utf8');
  assert.equal((s.match(/schedMirrorPeers\(char, /g)||[]).length,2);
});
