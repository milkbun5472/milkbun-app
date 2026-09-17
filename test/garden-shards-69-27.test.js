// 井里刨出来的不再是矿，是【关于这个人的碎片】（她 2026-09-16 定的方向）。
// 游戏内部的规则钉在 apps/fairy-garden/depths.test.mjs；这一份钉提示词与调用那一侧。
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
    extractJSON: r => { try { return JSON.parse(String(r).replace(/```(?:json)?/gi, '').trim()); } catch (e) { return null; } },
    callAI, narrativeCore: () => '共同文风', CONDESCENDING_TONE_BAN: '', REGISTER_FOLLOWS_SCENE: '',
    STOCK_REPLY_BAN: '', OVERREACH_BAN: '', ECHO_QUESTION_BAN: '', userName: p => (p && p.name) || '用户',
    loadJSON: () => null, saveJSON: () => true, useTheme: () => ({}) };
  ctx.window = ctx;
  vm.runInNewContext(host, ctx);
  return ctx.FairyGardenService;
}
const args = extra => Object.assign({ active: {}, character: { name: '甲', persona: '甲的人设' }, profile: { name: '我' }, world: { day: 3 }, depth: 4 }, extra);

test('一次下潜一枪，出一批碎片', async () => {
  let calls = 0, sys = '';
  const svc = service(async (p, s) => { calls++; sys = s; return JSON.stringify(Array.from({ length: 6 }, (_, i) => ({ kind: 'dream', text: '第' + i + '片' }))); });
  const out = await svc.shards(args());
  assert.equal(calls, 1, '一片一枪就把成本放大了六倍');
  assert.equal(out.length, 6);
  assert.match(sys, /【星井】/);
  assert.match(sys, /第 4 层/);
});

test('深度只决定完整度，不决定情感重量——她点名不要那种梯子', async () => {
  let sys = '';
  const svc = service(async (p, s) => { sys = s; return '[{"kind":"sense","text":"一点铁锈味。"}]'; });
  await svc.shards(args());
  assert.match(sys, /越深的只是【越完整、越奇怪】，不是越深情、越惨、越隐秘/);
  assert.match(sys, /浅处也可以挖到很珍贵的东西/);
});

test('能捞的只许从真东西里长，想象的要看得出是想象', async () => {
  let sys = '';
  const svc = service(async (p, s) => { sys = s; return '[{"kind":"memory","text":"伞。"}]'; });
  await svc.shards(args());
  assert.match(sys, /memory \/ link \/ world 这三类【只能从上面真给到你的东西里长】/);
  assert.match(sys, /绝不许编一段你们其实没发生过的共同经历/);
  assert.match(sys, /dream \/ ahead \/ unsaid 是你脑子里的东西/);
});

test('模型给的一律核对：种类不认识的、空的全丢', async () => {
  const svc = service(async () => '[{"kind":"memory","text":"好"},{"kind":"胡编的","text":"混进来"},{"kind":"dream","text":"   "}]');
  const out = await svc.shards(args());
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'memory');
  const bad = service(async () => '不是 JSON');
  await assert.rejects(() => bad.shards(args()), /没读懂井里的东西/);
});

test('补池子是静悄悄的：失败不拦着她继续挖', () => {
  const fn = game.slice(game.indexOf('async function fillPool()'), game.indexOf('function gather(kind)'));
  assert.match(fn, /if\(digging\|\|!host\|\|!host\.dig\)return false/, '没有宿主（试玩）就别打这一枪');
  assert.match(fn, /catch\(e\)\{say\(/);
  // 池子空了照旧给一块没纹路的石头（takeShard 那头），不让她空手
  assert.match(rd('apps/fairy-garden/world.mjs'), /一块没有纹路的石头/);
  // 下潜/再往下才补，而且只在快空的时候
  assert.match(game, /\(kind==='dive'\|\|kind==='deeper'\)&&host&&host\.dig&&veinLow\(data\)\)fillPool\(\)/);
});

test('碎片盒和花册是两格底线 tab，不是一排药丸', () => {
  assert.match(host, /\[\["notes", "花册",/);
  assert.match(host, /borderBottom: "2px solid " \+ \(bookTab === k \? G\.deep : "transparent"\)/);
  assert.match(host, /越深的只是越完整、越奇怪，不是越沉重/);
});
