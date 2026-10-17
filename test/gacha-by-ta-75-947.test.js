const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const app=fs.readFileSync(__dirname+'/../js/app.js','utf8'),sc=fs.readFileSync(__dirname+'/../js/screens.js','utf8');
test('抽卡能让TA扳拉杆：TA自己那条运气线、券进她的券夹、盖「TA 抽的」',()=>{
  assert.match(app,/const gachaPull = \(char, n, byTa\) =>/);
  assert.match(app,/const luckKey = byTa \? char\.id \+ "\|ta" : char\.id;/);
  assert.match(app,/\.\.\.\(byTa \? \{ byTa: true \} : \{\}\)/);
  assert.match(sc,/onPull\(partner, n, byTa\)/);
  assert.match(sc,/card\.byTa \? "TA 抽的 · "/);
});
