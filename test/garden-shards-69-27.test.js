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

test('能捞的只许从真东西里长；话要他自己说，不许矿洞替他宣布', async () => {
  let sys = '';
  const svc = service(async (p, s) => { sys = s; return '[{"kind":"echo","text":"伞。"}]'; });
  await svc.shards(args());
  assert.match(sys, /echo【只能从上面真给到你的经历里长】/);
  assert.match(sys, /绝不许编一段你们其实没发生过的事/);
  // v69.32 收紧的一条（codex 提的）：东西是挖出来的，话是他说的
  assert.match(sys, /东西是挖出来的，话是你自己说的/);
  assert.match(sys, /不许在碎片上替自己宣布「我当时差点说…」/);
  assert.match(sys, /kind 只能取：echo｜dream｜sense｜relic/);
});

test('模型给的一律核对：种类不认识的、空的全丢', async () => {
  const svc = service(async () => '[{"kind":"echo","text":"好"},{"kind":"胡编的","text":"混进来"},{"kind":"dream","text":"   "}]');
  const out = await svc.shards(args());
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'echo');
  const bad = service(async () => '不是 JSON');
  await assert.rejects(() => bad.shards(args()), /没读懂井里的东西/);
});

test('补池子是静悄悄的：失败不拦着她继续挖', () => {
  const fn = game.slice(game.indexOf('async function fillPool()'), game.indexOf('function gather(kind)'));
  assert.match(fn, /if\(digging\|\|!host\|\|!host\.dig\)return false/, '没有宿主（试玩）就别打这一枪');
  assert.match(fn, /catch\(e\)\{say\(/);
  // 池子空了照旧给一块没纹路的石头（takeShard 那头），不让她空手
  assert.match(rd('apps/fairy-garden/world.mjs'), /它静静躺在掌心/);
  // 下潜/再往下才补，而且只在快空的时候
  assert.match(game, /\(kind==='dive'\|\|kind==='deeper'\)&&host&&host\.dig&&veinLow\(data\)\)fillPool\(\)/);
});

// v69.41 改成册子边上的索引签：底线 tab 也是「基础款」的一种
// （施工规则/tabs-not-plain-pills.md：一行字加一条下划线，只靠填色区分选中）。
test('花册那几格长成册子的索引签，不是一排药丸、也不是一条下划线', () => {
  assert.match(host, /\[\["notes", "花册",/);
  assert.doesNotMatch(host, /borderBottom: "2px solid " \+ \(bookTab === k \? G\.deep : "transparent"\)/,
    '下划线那版已经换掉了');
  assert.match(host, /borderRadius: "11px 11px 0 0"/, '上圆下方，贴着页边');
  // 选中态不只靠颜色：高度、纸色、底下那条缝三样一起变（色弱和阳光下只剩形状可依）
  assert.match(host, /padding: on \? "12px 0 13px" : "8px 0 9px"/);
  assert.match(host, /borderBottom: on \? "1px solid " \+ G\.paper/);
  assert.match(host, /越深的只是越完整、越奇怪，不是越沉重/);
});

// v69.32：锅那条链【一枪都不打】——这是庭院的成本地板。
// 判据（她定的）：一样东西要么能读、要么能摆、要么能用、要么会引出下一件事。
test('炼金整条链不许出现模型调用', () => {
  const world = rd('apps/fairy-garden/world.mjs');
  const craft = world.slice(world.indexOf('// ── 锅：把碎片做成'), world.indexOf('// ── 星井（下潜）'));
  assert.doesNotMatch(craft, /callAI|host\.|await /, '炼金那一段一旦开始调模型，成本地板就没了');
  assert.match(craft, /一枪都不打/);
  // 弹层也只在本地算：挑碎片、挑做法、出东西
  assert.match(game, /function openCraft\(\)/);
  assert.doesNotMatch(game.slice(game.indexOf('function openCraft()'), game.indexOf("function openMuseum()")), /host\.|callAI/);
});

test('雨铃响不响是代码说的，不是模型生成的', () => {
  assert.match(game, /function bellLine\(\)\{return bellRings\(data\)\?/);
  assert.match(game, /这一句是代码说的，不是模型生成的/);
});

// ── 公告栏（v69.35）：也是一枪都不打 ────────────────────────────────────
test('委托整条链不许出现模型调用', () => {
  const world = rd('apps/fairy-garden/world.mjs');
  const quest = world.slice(world.indexOf('// ── 公告栏：接委托'), world.indexOf('// ── 锅：把碎片做成'));
  assert.doesNotMatch(quest, /callAI|host\.|await /, '委托一旦开始调模型，成本地板就没了');
  assert.match(quest, /这一版也【一枪都不打】/);
  const dialog = game.slice(game.indexOf('function questLine(q)'), game.indexOf("$('board').onclick"));
  assert.doesNotMatch(dialog, /host\.|callAI/);
});

test('季节改的是「这个世界更容易发生什么」，不是委托皮肤', () => {
  const world = rd('apps/fairy-garden/world.mjs');
  assert.match(world, /const SEASON_QUESTS = \[/);
  // 四季各一张权重表，而且各不相同
  const tables = world.slice(world.indexOf('const SEASON_QUESTS'), world.indexOf('export const QUEST_SLOTS'));
  const rows = tables.match(/\{ [^}]*\}/g) || [];
  assert.equal(rows.length, 4, '四季没配齐');
  assert.equal(new Set(rows).size, 4, '有两季的权重表一模一样');
});

test('做完要留下能看见的后果，不是一句谢谢', () => {
  const world = rd('apps/fairy-garden/world.mjs');
  assert.match(world, /keeps: 'pathLamp'/);
  assert.match(world, /export const lampOn = s =>/);
  assert.match(world, /export const lampShelter = s =>/);
  // 灯的位置只写在 rules 那一份，渲染那头照它找（别再编第二套坐标）
  assert.match(rd("apps/fairy-garden/rules.js"), /pathLamp:\{x:1\.6,z:3\.4\}/);
  assert.match(game, /function lampLine\(\)/);
});
