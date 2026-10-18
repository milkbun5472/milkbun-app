const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const {quietActive}=require('../js/schedule-clock.js');
const at=(h,m)=>{const d=new Date(2026,9,17,h,m);return d;};
test('免打扰时段：跨零点、只管勾上的那一样',()=>{
  const q={on:true,from:"23:30",to:"08:00",noPro:true,noBg:false};
  assert.equal(quietActive(q,"pro",at(6,20)),true);
  assert.equal(quietActive(q,"pro",at(12,0)),false);
  assert.equal(quietActive(q,"bg",at(6,20)),false);
  assert.equal(quietActive({...q,on:false},"pro",at(6,20)),false);
});
test('后台不跑走 bgOff 那一道闸；主动消息在 replyNow 一处挡、只放行提醒',()=>{
  const s=fs.readFileSync(__dirname+'/../js/app.js','utf8');
  assert.match(s,/const bgOff = \(\) => loadJSON\("x_bgApi", null\) === "__off__" \|\| quietNow\("bg"\);/);
  assert.match(s,/!opts\.remind && quietNow\("pro"\)\) return false;/);
  assert.match((fs.readFileSync(__dirname+'/../js/screens.js','utf8') + "\n" + fs.readFileSync(__dirname+'/../js/screens-ui.js','utf8')),/h\(QuietHoursBox, \{ t: t, toast: toast \}\)/);
});
