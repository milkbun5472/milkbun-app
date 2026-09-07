const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { app, engine, cut, fixture, evaluate, wire, sections } = require('./_group-background-fixture.cjs');

// 从重构前真实三条 memberDesc 运行取得，不根据重构后的拼接倒推期望。
const beforeHashes = {
  online: 'e655e2d51ac1ec8bfae2f102ff133aeea03e386f610d5146540da6ec7aefc859',
  call: '1b8cb3b0cb57eaa44f0cf322309552a9656e00ee5afcf36f4ac4e2ab46552411',
  offline: '97df0976a95233a1ef6222e90267c4b0b4f4243431d87a7d87460c683738d03c',
};
for (const surface of Object.keys(beforeHashes)) test(surface + '：成员背景输出与重构前逐字一致', () => {
  const env = wire(fixture());
  if (surface === 'offline') env.userName = '读者';
  const text = evaluate(sections[surface], env, 'memberDesc');
  assert.equal(createHash('sha256').update(text).digest('hex'), beforeHashes[surface]);
  const a = text.slice(text.indexOf('【甲】'), text.indexOf('【乙】'));
  const b = text.slice(text.indexOf('【乙】'), text.indexOf('【配角】'));
  assert.match(a, /只有 甲 本人知道/);
  assert.match(b, /只有 乙 本人知道/);
  assert.ok(!a.includes('b私有档案') && !b.includes('a私有档案'));
  assert.doesNotMatch(text.slice(text.indexOf('【配角】')), /底色|睡眠|私有档案|成长|随身物/);
});

test('共享背景排除 NPC；空字段不产生空壳段落', () => {
  const env = wire(fixture());
  env.aMoodTextOf = () => { throw Error('NPC 不得访问角色背景'); };
  assert.deepEqual(env.groupBackgroundFor(env.members[2]), {});
  assert.deepEqual(env.groupNowSegs(env.members[2]), {});
  for (const c of [env.members[0], env.members[2]]) {
    const segs = env.groupBackgroundSegments(c, {}, '读者');
    assert.ok(Object.values(segs).every(s => s === ''));
  }
});

test('群线下六张成员表来自同一读取，跟线上/通话的字段一致', () => {
  const env = wire(fixture());
  Object.assign(env, {
    group: { memberIds: ['a', 'b', 'npc'] }, groupMembers: () => env.members,
    groupOfflineMemSplit: () => ({}), rels: [], PERSONA_EVOLVE_IDS: [], wishRef: { current: [] }
  });
  const prefix = cut(app, '  const ctxForGroupOffline =', '    // 印象卡跟长期记忆同一档');
  const ctx = evaluate(prefix + '\n});\n};', env, 'ctxForGroupOffline(group)');
  const fields = { memberGrown: 'grown', memberAMood: 'aMood', memberSleep: 'sleep', memberHome: 'home', memberCarry: 'carry', memberCoupleArchive: 'archive' };
  for (const [map, field] of Object.entries(fields)) {
    for (const c of env.members.slice(0, 2)) assert.equal(ctx[map][c.id], env.groupBackgroundFor(c)[field]);
    assert.equal(ctx[map].npc, undefined);
    assert.ok(sections.offline.includes('ctx.' + map + '[c.id]'), map + ' 写了却没读');
  }
});

test('背景格式只在公共段定义，保留闭群即时状态开关', () => {
  const env = wire(fixture());
  const open = env.groupNowSegs(env.members[0], { interop: true });
  const closed = env.groupNowSegs(env.members[0], { interop: false });
  assert.ok(open.live.includes('甲衣'));
  assert.equal(closed.live, '');
  for (const field of ['grownSeg', 'aSeg', 'zSeg', 'hcSeg', 'cySeg', 'caSeg']) assert.equal(closed[field], open[field]);
  assert.equal((app.match(/const grownSeg =|const aSeg = aMoodTextOf|const zSeg = sleepToneOf|const hcSeg =/g) || []).length, 0);
  assert.equal((engine.match(/function groupBackgroundSegments\(/g) || []).length, 1);
});
