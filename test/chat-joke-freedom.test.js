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
  // v72.46 删掉「接不住就不接」（她 2026-09-22：「都删了吧」）——它是这一段里唯一
  // 一个【退场动作】，而这一段其余部分讲的是放松、黏、话多。人设淡的角色手上没别的
  // 抓手时，抓走的就是它（同 v71.98 那个「三」成了默认气泡数）。
  // 这一段要守的意思还在：不必每条都聪明、不必接得漂亮。
  assert.match(rule, /也不必每条都聪明/);
  assert.match(rule, /不需要每条都有信息、有梗、接得漂亮或推进什么/);
  assert.doesNotMatch(rule, /接不住就不接/, "又把那个退场动作写回来了");
  assert.match(rule, /保持当前关系阶段与历史连续性/);
  assert.match(app, /const _onlineRuntime =[\s\S]*?ONLINE_CHAT_RULE_V2/);
});
