const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const engine = fs.readFileSync(__dirname + '/../js/engine.js', 'utf8');
const app = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');
const decl = engine.match(/^const SCHEDULE_CONTEXT_RULE = .*;$/m)[0];
test('日程规则为共享背景，不再强制带到台词中', () => {
  const rule = new Function(decl + ' return SCHEDULE_CONTEXT_RULE;')();
  assert.match(rule, /不是本轮必须谈论的内容/);
  assert.match(rule, /当前话题与你自己的表达意愿/);
  assert.doesNotMatch(app, /聊天\/互动里要自然带出来|别当没看见、也别播报腔/);
  assert.doesNotMatch(engine, /先接住那句人，再说忙/);
  assert.match(engine, /ctx\.memberSched\[c\.id\].*SCHEDULE_CONTEXT_RULE/);
  assert.match(app, /sbSeg:.*SCHEDULE_CONTEXT_RULE/);
});
test('真实公共行程块保留数据和工程师/空值闸', () => {
  const start = engine.indexOf('  if (!ctx.notRoleplay && ctx.schedNow');
  const end = engine.indexOf('\n', start);
  const run = new Function('ctx', 'char', decl + '\nconst parts=[];\n' + engine.slice(start, end) + '\nreturn parts;');
  const out = run({schedNow:'日程哨兵'}, {name:'甲'});
  assert.equal(out.length, 1);
  assert.ok(out[0].endsWith('\n日程哨兵'));
  assert.match(out[0], /不是本轮必须谈论的内容/);
  assert.deepEqual(run({schedNow:'日程哨兵',notRoleplay:true}, {name:'甲'}), []);
  assert.deepEqual(run({schedNow:''}, {name:'甲'}), []);
});
