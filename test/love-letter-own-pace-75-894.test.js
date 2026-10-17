const test=require('node:test'),assert=require('node:assert');
const s=require('fs').readFileSync(__dirname+'/../js/app.js','utf8');
test('申请信：给来往天数这件事实、说清她不会先开口，不挂好感分',()=>{
  const i=s.indexOf('openCaps.push("loveLetter")'),seg=s.slice(i,i+1600);
  assert.match(seg,/_llDays/);
  assert.match(seg,/她不会先开口提/);
  assert.doesNotMatch(seg,/affinity|affOf|favor/i);
  assert.doesNotMatch(seg,/这不是每轮都该有的东西/);
});
test('不替他列性格样板',()=>{const i=s.indexOf('openCaps.push("loveLetter")');assert.doesNotMatch(s.slice(i,i+1600),/直的会|别扭的会|胆小的会/);});
