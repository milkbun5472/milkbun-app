const test=require('node:test'),assert=require('node:assert');
const comp=require('fs').readFileSync(__dirname+'/../js/components.js','utf8');
test('异地：你这一列横跨TA两天，按带符号偏移摆、块记住来自TA哪一天，点开删改去那一天',()=>{
  const seg=comp.slice(comp.indexOf("const blocksOn = dk =>"),comp.indexOf("const dayHasAnything"));
  assert.match(seg,/const offs = tzShift > 0 \? \[0, 1\] : tzShift < 0 \? \[-1, 0\] : \[0\];/);
  assert.match(seg,/const base = dd \* 1440 - tzShift;/);
  assert.match(seg,/srcDk: cdk/);
  assert.doesNotMatch(seg,/toMyMin\(/,"不许再按 %1440 绕回同一列");
  assert.match(comp,/setDayEv\(\{ b, dk: b\.srcDk \|\| dk \}\)/);
  assert.match(comp,/dayEv\.b\.charFrom \? dayEv\.b\.charFrom/);
});
