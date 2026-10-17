const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const app=fs.readFileSync(__dirname+'/../js/app.js','utf8'),sc=fs.readFileSync(__dirname+'/../js/screens.js','utf8');
test('抽卡能让TA扳拉杆：TA自己那条运气线、券进她的券夹、盖「TA 抽的」',()=>{
  assert.match(app,/const gachaPull = \(char, n, byTa\) =>/);
  assert.match(app,/const luckKey = byTa \? char\.id \+ "\|ta" : char\.id;/);
  assert.match(app,/\.\.\.\(byTa \? \{ byTa: true \} : \{\}\)/);
  assert.match(sc,/onPull\(partner, n, byTa\)/);
  assert.match(sc,/card\.byTa \? "TA 抽的 · "/);
});
test('TA扳的手气偷偷好一点；单聊落一张小票、不当场开口',()=>{
  const g=fs.readFileSync(__dirname+'/../js/gacha.js','utf8'),cp=fs.readFileSync(__dirname+'/../js/components.js','utf8');
  assert.match(g,/const TA_RATE_SSR = 0\.08, TA_RATE_SR = 0\.48;/);
  assert.match(app,/lucky: !!byTa/);
  assert.match(app,/kind: "gachashare"/);
  assert.match(cp,/kind === "gachashare"\) return GachaShareCard/);
  const K=require('../js/gacha.js');
});
