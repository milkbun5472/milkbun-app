const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const app=fs.readFileSync(__dirname+'/../js/app.js','utf8'),ph=fs.readFileSync(__dirname+'/../js/phone.js','utf8');
test('你俩之间真花过的钱：从她的流水按这个人挑，查手机每个 app 和钱包档案都带上',()=>{
  assert.match(app,/const moneyWithHerLine = char =>/);
  assert.match(app,/e\.ref && e\.ref\.charId === char\.id/);
  assert.match(app,/instruction: moneyWithHerLine\(char\)/);
  const i=ph.indexOf('const PHONE_MONEY_KEYS');const fn=new Function(ph.slice(i,ph.indexOf('\n}\n',i)+2)+'\nreturn phoneMoneyBlock;')();
  assert.equal(fn('notes',{withHer:'X'}),'X');
  assert.match(fn('shopping',{balance:100,withHer:'Y'}),/Y$/);
});
test('面具上写了她的生日：平时也知道是哪天，不只是前七天',()=>{
  assert.match(app,/的生日是 " \+ myBdayFor\(char\.id\) \+ "，你知道/);
});
