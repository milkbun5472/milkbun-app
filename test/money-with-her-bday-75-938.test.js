const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const app=fs.readFileSync(__dirname+'/../js/app.js','utf8'),ph=(fs.readFileSync(__dirname+'/../js/phone.js','utf8') + "\n" + fs.readFileSync(__dirname+'/../js/phone-ui.js','utf8'));
test('你俩之间真花过的钱：一格 moneyWithHer 走 buildBundle，聊天、查手机、钱包档案都吃到；方向写死',()=>{
  const eng=fs.readFileSync(__dirname+'/../js/engine.js','utf8');
  assert.match(app,/moneyWithHer: \(typeof moneyWithHerLine === "function" \? moneyWithHerLine\(char\) : ""\)/);
  assert.match(app,/e\.ref && e\.ref\.charId === char\.id/);
  assert.match(app,/出的钱 " \+ amt \+ "（从她那儿出去，给你或者花在你身上）"/);
  assert.match(eng,/if \(ctx\.moneyWithHer && ctx\.moneyWithHer\.trim\(\)\) parts\.push/);
});
test('面具上写了她的生日：平时也知道是哪天，不只是前七天',()=>{
  assert.match(app,/的生日是 " \+ myBdayFor\(char\.id\) \+ "，你知道/);
});
