const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const src = fs.readFileSync(require('node:path').join(__dirname, '../js/theater.js'), 'utf8');

test('搭台共用人物规则，不带演出视角；五条创作路径都接入', () => {
  const body = src.slice(src.indexOf('  const settingStyle ='), src.indexOf('  const useState ='));
  const style = new Function('CB', 'ANTI_CLICHE', 'CHARCARD_RULE', body + '\nreturn settingStyle();')(() => '边界', '公共文风', '人物机制');
  for (const phrase of ['边界', '公共文风', '人物机制', '可观察', '不统一写成掌控局面的强者']) assert.ok(style.includes(phrase));
  assert.equal((src.match(/const sys = settingStyle\(\)/g) || []).length, 5);
  assert.doesNotMatch(body, /OFFLINE_NARRATIVE_RUNTIME|buildBundle|loadJSON/);
  for (const phrase of ['那股聪明劲', '原本的聪明、魅力', '基调决定味道,不决定重量', '张力再拧深一档']) assert.ok(!src.includes(phrase));
});

test('缺项补写实际请求继承文风，只补缺字段，完整时不调用', async () => {
  const body = src.slice(src.indexOf('    const completeSetting ='), src.indexOf('    // ---- 生成:if 线设定'));
  const calls = [];
  const complete = new Function('settingStyle', 'callAI', 'props', 'parseSettingPayload', body + '\nreturn completeSetting;')(
    () => '共享文风\n', async (...args) => { calls.push(args); return '{"opening":"新开场"}'; },
    { active: {} }, JSON.parse);
  const partial = { goal: '角色答应一项安排' };
  assert.deepEqual(await complete(partial, JSON.stringify(partial), ['goal'], ''), partial);
  assert.equal(calls.length, 0);
  const result = await complete(partial, JSON.stringify(partial), ['goal', 'opening'], '轻松');
  assert.equal(result.goal, partial.goal);
  assert.equal(result.opening, '新开场');
  assert.match(calls[0][1], /共享文风[\s\S]*轻松[\s\S]*已经写好的部分/);
  assert.deepEqual(calls[0][2], [{ role: 'user', content: '补齐缺项。' }]);
  assert.equal(calls[0][3].maxTokens, 65535);
});
