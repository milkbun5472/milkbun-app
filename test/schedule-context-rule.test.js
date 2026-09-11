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

test('日程是他一个人的，翻到「睡觉」也不会把她挪到他身边', () => {
  // 她 2026-09-11：「上一秒他还觉得自己在和我打字，下一秒日程变成睡觉了，
  // 他就觉得我躺在他身边了」。
  const rule = new Function(decl + ' return SCHEDULE_CONTEXT_RULE;')();
  assert.match(rule, /\*\*日程写的全是你一个人的事\*\*/);
  assert.match(rule, /它一个字都没说对方在哪/);
  assert.match(rule, /只看上面的对话和【同处一室】那一层/);
  // ② 钟点切格 ≠ 这一刻跳过去
  assert.match(rule, /\*\*日程换一格，不等于这一刻就跳过去了\*\*/);
  assert.match(rule, /正说着话的人不会在两句之间就睡着、就出门/);
  assert.match(rule, /得你自己在对话里走这一趟/);
  // ⚠️两句都必须住在公共那一份里：单聊、群成员、聊天列表摘要吃的是同一段
  //   （施工规则/one-public-mechanism.md）。
  assert.equal((engine.match(/日程写的全是你一个人的事/g) || []).length, 1,
    '这句话被抄成了第二份');
  assert.doesNotMatch(app, /日程写的全是你一个人的事/);
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
