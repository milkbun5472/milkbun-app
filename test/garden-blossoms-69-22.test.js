// 花笺那一枪（她 2026-09-16：「种花那条先做吧」）。游戏内部的规则钉在
// apps/fairy-garden/seeds.test.mjs；这一份钉【提示词与调用】那一侧。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const host = rd('js/fairy-garden.js');
const game = rd('apps/fairy-garden/game.mjs');

function service(callAI) {
  const ctx = { React: { createElement: () => null }, WeakMap, JSON, Error, Math, String, Array, Object, Number, Boolean, isFinite,
    // ⚠️桩照【真的那一份】写：engine 的 extractJSON 读不懂时返回 null，不抛
    //   （施工规则/stub-from-the-writer.md）。照 JSON.parse 写会把「读不懂」测成异常。
    extractJSON: r => { try { return JSON.parse(String(r).replace(/```(?:json)?/gi, '').trim()); } catch (e) { return null; } }, callAI, narrativeCore: () => '共同文风', CONDESCENDING_TONE_BAN: '公共规则',
    REGISTER_FOLLOWS_SCENE: '', STOCK_REPLY_BAN: '', OVERREACH_BAN: '', ECHO_QUESTION_BAN: '',
    userName: p => (p && p.name) || '用户', loadJSON: () => null, saveJSON: () => true, useTheme: () => ({}) };
  ctx.window = ctx;
  vm.runInNewContext(host, ctx);
  return ctx.FairyGardenService;
}

test('开几朵都只打一枪——这条是钱闸', async () => {
  let calls = 0, sys = '';
  const svc = service(async (p, s) => { calls++; sys = s; return '[{"id":"a","reply":"一"},{"id":"b","reply":"二"}]'; });
  const out = await svc.blossoms({ active: {}, character: { name: '甲', persona: '甲的人设' }, profile: { name: '我' },
    world: { day: 4 }, seeds: [{ id: 'a', kind: 'miss', ask: '想我吗' }, { id: 'b', kind: 'today', ask: '' }] });
  assert.equal(calls, 1, '一朵一枪就把这条设计的成本放大了几十倍');
  assert.deepEqual(out.map(x => String(x.id)), ['a', 'b']);
  // 料全在 system，user 只留一句触发（施工规则/prompt-send-shape.md）
  assert.match(sys, /【开好的花，每一株一句】/);
  assert.match(sys, /a〔想你〕想我吗/);
  assert.match(sys, /b〔今天〕（她没写字，只放了这个念头）/);
  assert.match(sys, /【完整角色人设】\n甲的人设/);
});

test('不许把没发生过的事说成真发生过', async () => {
  let sys = '';
  const svc = service(async (p, s) => { sys = s; return '[{"id":"a","reply":"嗯"}]'; });
  await svc.blossoms({ active: {}, character: { name: '甲' }, profile: {}, world: {}, seeds: [{ id: 'a', kind: 'miss', ask: 'x' }] });
  assert.match(sys, /不许把【你们之间没发生过的事】说成真发生过/);
  assert.match(sys, /想象和「如果」要让人看得出那是想象/);
});

test('模型给的东西一律核对：不是这一批的、空的，全丢掉', async () => {
  const svc = service(async () => '[{"id":"a","reply":"好"},{"id":"别人家的","reply":"混进来"},{"id":"b","reply":"  "}]');
  const out = await svc.blossoms({ active: {}, character: { name: '甲' }, profile: {}, world: {}, seeds: [{ id: 'a', kind: 'miss', ask: 'x' }, { id: 'b', kind: 'today', ask: '' }] });
  // ⚠️vm 里造的对象跟本地不是同一个 realm，deepEqual 会因为原型不同而失败——比内容
  assert.deepEqual(JSON.parse(JSON.stringify(out)), [{ id: 'a', reply: '好' }]);
  const bad = service(async () => '不是 JSON');
  await assert.rejects(() => bad.blossoms({ active: {}, character: { name: '甲' }, profile: {}, world: {}, seeds: [{ id: 'a', kind: 'miss', ask: 'x' }] }), /没读懂花笺/);
});

test('没配线路、地里没花都要说人话', async () => {
  const svc = service(async () => '[]');
  await assert.rejects(() => svc.blossoms({ active: null, seeds: [{ id: 'a', kind: 'miss' }] }), /先在设置里配置创作线路/);
  await assert.rejects(() => svc.blossoms({ active: {}, character: { name: '甲' }, profile: {}, world: {}, seeds: [] }), /地里没有开好的花/);
});

test('收花笺不走 perform，失败了花还在地里', () => {
  const fn = game.slice(game.indexOf("if(kind==='note')"), game.indexOf("if(kind==='dive'||kind==='ladder')"));
  assert.match(fn, /await host\.bloom\(/);
  assert.match(fn, /data=keepNotes\(data,out\)/);
  assert.match(fn, /catch\(e\)\{ui\(\);say\(e&&e\.message\|\|'这次没收上来，花还在地里。'\)/);
  // 试玩模式没有宿主＝没有 callAI，要说清楚而不是干等
  assert.match(fn, /试玩模式里花还开不了/);
});

test('maxTokens 不许低于 8000（施工规则/max-tokens-floor.md）', () => {
  const call = host.slice(host.indexOf('tag: "微光庭院花笺"') - 200, host.indexOf('tag: "微光庭院花笺"') + 40);
  const n = Number(call.match(/maxTokens: (\d+)/)[1]);
  assert.ok(n >= 8000, '花笺那一枪给的额度太小：' + n);
});
