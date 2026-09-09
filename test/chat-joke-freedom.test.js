const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const engine = fs.readFileSync('js/engine.js', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

test('线上公共规则不再规定玩笑必须升级，保留自然聊天与历史连续性', () => {
  const source = engine.match(/const ONLINE_CHAT_RULE_V2 = (`[\s\S]*?`);/);
  assert.ok(source);
  const rule = new Function('ECHO_QUESTION_BAN', 'return ' + source[1])('');
  assert.doesNotMatch(rule, /越推越离谱|玩笑的燃料|只要接，就往里走|进入这个前提、往上加砖/);
  assert.match(rule, /轻微跑题/);
  assert.match(rule, /接不住就不接/);
  assert.match(rule, /保持当前关系阶段与历史连续性/);
  assert.match(app, /const _onlineRuntime =[\s\S]*?ONLINE_CHAT_RULE_V2/);
});
