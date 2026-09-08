const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wearing = require('../js/wearing-refresh.js');
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

test('用户、第三人、引述和提问不强制角色换装', () => {
  for (const latestUserText of ['好困', '我刚起床', '我准备去洗澡', '室友去跑步了', '他说你该睡觉了', '你洗澡了吗', '你别出门', '你换件衣服吧']) {
    const gate = wearing.evaluate({scheduleKey:'same', acknowledgedKey:'same', hasWearing:true, latestUserText});
    assert.equal(gate.required, false, latestUserText);
  }
});

test('日程与状态恢复检查仍保留，不靠用户文本', () => {
  const base = {scheduleKey:'same', acknowledgedKey:'same', hasWearing:true};
  assert.equal(wearing.evaluate({...base, scheduleKey:'next'}).scheduleChanged, true);
  for (const change of [{scheduleKey:'next'}, {hasWearing:false}, {pending:true}]) {
    assert.equal(wearing.evaluate({...base, ...change}).required, true);
  }
  assert.equal(wearing.evaluate({...base, scheduleKey:''}).required, false);
  assert.notEqual(wearing.scheduleKey({title:'工作'}, 'today'), wearing.scheduleKey({title:'休息'}, 'today'));
});

test('实际单聊调用不再把用户动作交给穿着门控，角色换装协议仍在', () => {
  const start = app.indexOf('const _wearRefreshGate =');
  const gate = app.slice(start, app.indexOf('const _missingStateFields', start));
  assert.doesNotMatch(gate, /latestUserText/);
  assert.match(gate, /roomClockOn && !_s.engineerEyes/);
  assert.match(app, /若你在 word 里明确决定/);
  assert.match(app, /本轮 wearing 必须同时填写/);
});

test('时间间隔提示保留时间门控，不虚构共同经历或强制报备', () => {
  const start = app.indexOf('const gapHint =');
  const end = app.indexOf(': "";', start) + 5;
  const declaration = app.slice(start, end);
  const render = new Function('roomClockOn', 'gapMs', 'gapHrs', declaration + '; return gapHint;');
  assert.equal(render(false, 10800001, 3), '');
  assert.equal(render(true, 1000, 0), '');
  const hint = render(true, 10800001, 3);
  assert.match(hint, /3 小时/);
  assert.match(hint, /未确认的共同活动保持未确认/);
  assert.match(hint, /不必交代这段时间的行程/);
  assert.doesNotMatch(hint, /就当你俩已经|火锅|实验室/);
});
