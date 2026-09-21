const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { app, engine, cut, fixture, evaluate, wire, sections } = require('./_group-background-fixture.cjs');

// 从重构前真实三条 memberDesc 运行取得，不根据重构后的拼接倒推期望。
// ⚠️v68.84 online/call 两张换了新的：配角那一行从「这是 X 身边的人，只在群里出场」
//   改成走公共的 npcRosterLine（在场的谁跟 TA 有边也一并说出来）。
//   换哈希的同时下面加了一条专门盯配角那一行的断言——光换数字等于把守门的拆了。
//   ⚠️主角色那两段【一个字都没动】，那才是这三张哈希真正在守的东西。
const beforeHashes = {
  online: 'a06e34e6b10cd41c8d6d7a8cb6461b3151b3a49091eb2602757398c971f7c654',
  call: '7ba5534f78d18b5a940cf569e7d3099eb08abe2a3bc9a60f77fdfebd84ec20c8',
  offline: '074b43e33d9720371b2e4e9e6cf68bf51cd1a5eb25a8f05e8a734a2ee92eeb77',
};
for (const surface of Object.keys(beforeHashes)) test(surface + '：成员背景输出与重构前逐字一致', () => {
  const env = wire(fixture());
  if (surface === 'offline') env.userName = '读者';
  const text = evaluate(sections[surface], env, 'memberDesc');
  // 本轮只替换日程表达规则，其余成员背景仍与原快照逐字对照。
  const comparable = text.split(env.SCHEDULE_CONTEXT_RULE).join('自然渗进语气和状态，别报行程表');
  assert.equal(createHash('sha256').update(comparable).digest('hex'), beforeHashes[surface]);
  const a = text.slice(text.indexOf('【甲】'), text.indexOf('【乙】'));
  const b = text.slice(text.indexOf('【乙】'), text.indexOf('【配角】'));
  assert.match(a, /只有 甲 本人知道/);
  assert.match(b, /只有 乙 本人知道/);
  assert.ok(!a.includes('b私有档案') && !b.includes('a私有档案'));
  assert.doesNotMatch(text.slice(text.indexOf('【配角】')), /底色|睡眠|私有档案|成长|随身物/);
  // v68.84：配角那一行现在由 npcRosterLine 写。没有别的边时，说的仍然只有户口那一句。
  const npcSeg = text.slice(text.indexOf('【配角】'));
  assert.match(npcSeg, /〔这是 甲 身边的人；只在群里出场〕/);
  assert.doesNotMatch(npcSeg, /也认得|也认识/, '没有边的时候不许凭空说 TA 认得谁');
});

test('配角同时认得在场的别人时，那一行要说出来（她 2026-09-15：「万一 npc 跟 ab 都认识呢」）', () => {
  const env = wire(fixture());
  env.rels['npc->b'] = { label: '旧同学' };
  const text = evaluate(sections.online, env, 'memberDesc');
  const npcSeg = text.slice(text.indexOf('【配角】'));
  assert.match(npcSeg, /这是 甲 身边的人；在场的这几位 TA 也认得：乙（旧同学）；只在群里出场/,
    '不说的话，模型只知道 TA 是甲的人，跟乙说话时还是当陌生人');
  // 户口那一位不重复数进去
  assert.doesNotMatch(npcSeg, /也认得：甲/);
});

test('⚠️配角认识用户，不等于知道用户的私事', () => {
  const env = wire(fixture());
  env.characters = env.members = env.people = env.members.map(c =>
    c.npc ? { ...c, knowsUser: true, knowsUserNote: '一块儿打过两年球' } : c);
  const text = evaluate(sections.online, env, 'memberDesc');
  const npcSeg = text.slice(text.indexOf('【配角】'));
  assert.match(npcSeg, /TA 也认识 读者 本人：一块儿打过两年球/);
  // 共友认识她、又同时认识甲和乙，就是一条现成的泄漏通道——围栏必须贴着这句一起发
  assert.match(npcSeg, /她跟在场每一位各自是什么关系，TA 一概不知道/);
  assert.match(npcSeg, /除非那位自己在群里说了出来/);
});

test('他给她起的称呼落在【那位成员自己那一段】里，别人看不到（v68.43）', () => {
  const env = wire(fixture());
  env.nickLineFor = (id, u) => id === 'a' ? ('你私下管 ' + u + ' 叫「小笨蛋」') : '';
  const text = evaluate(sections.online, env, 'memberDesc');
  const a = text.slice(text.indexOf('【甲】'), text.indexOf('【乙】'));
  const b = text.slice(text.indexOf('【乙】'), text.indexOf('【配角】'));
  assert.match(a, /小笨蛋/, '甲那一段里没有他给她起的称呼');
  assert.ok(!b.includes('小笨蛋'), '乙也看到了——隐私围栏漏了');
  // 跟情侣状态同一道围栏：这一段只有本人知道
  assert.ok(a.indexOf('只有 甲 本人知道') < a.indexOf('小笨蛋'), '称呼没落在围栏里面');
});

test('共享背景排除 NPC；空字段不产生空壳段落', () => {
  const env = wire(fixture());
  env.aMoodTextOf = () => { throw Error('NPC 不得访问角色背景'); };
  assert.deepEqual(env.groupBackgroundFor(env.members[2]), {});
  // v72.06：配角有了那四样（心情／想法／穿着／动作），所以这儿不再是空对象——
  // 但也【只有这两格】：好感、年龄、情侣、行程、背景六层一个都不许长出来。
  assert.deepEqual(Object.keys(env.groupNowSegs(env.members[2])).sort(), ["live", "mdSeg"]);
  for (const c of [env.members[0], env.members[2]]) {
    const segs = env.groupBackgroundSegments(c, {}, '读者');
    assert.ok(Object.values(segs).every(s => s === ''));
  }
});

test('群线下六张成员表来自同一读取，跟线上/通话的字段一致', () => {
  const env = wire(fixture());
  Object.assign(env, {
    group: { memberIds: ['a', 'b', 'npc'] }, groupMembers: () => env.members,
    groupOfflineMemSplit: () => ({}), rels: [], PERSONA_EVOLVE_IDS: [], wishRef: { current: [] },
    // v68.65：群线下也开始读「她今天身上带着什么」（四处一样喂）
    inventoryRef: { current: [] },
    // v68.81：旁观群她不在场，这一条整个不给——判据两路共用
    groupSpectating: () => false
  });
  const prefix = cut(app, '  const ctxForGroupOffline =', '    // 印象卡读一律给');
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

// v72.06（她 2026-09-20：「就心情想法穿着动作这四样放 npc 状态卡」）——
// 她报的是「角色和他的好兄弟们互动差点意思」：配角原来连「此刻」都没有，
// 只能对着屏幕上最后几句话反应。
test('配角那四样拼进三处成员表，别的层一个都不许跟着来', () => {
  const env = wire(fixture());
  env.moods.npc = { label: '配角心情', ts: 3 };
  env.statesRef.current.npc = { wearing: '配角衣', action: '配角动作', thought: '配角心声' };
  env.ctx.npcRoster = { npc: env.npcGroupLine(env.members[2], env.members.map(x => x.id)) };
  for (const surface of ['online', 'call', 'offline']) {
    const text = evaluate(sections[surface], env, 'memberDesc');
    const npcSeg = text.slice(text.indexOf('【配角】'));
    assert.match(npcSeg, /〔此刻心情〕配角心情/, surface + '：配角没有心情');
    assert.match(npcSeg, /穿着=配角衣/, surface + '：配角没有穿着');
    assert.match(npcSeg, /上一动作=配角动作/, surface + '：配角没有动作');
    assert.match(npcSeg, /上一条心声=配角心声/, surface + '：配角没有上一条心声');
    // 这几层照旧不给配角（她 2026-08-25 拍的板，v72.06 没动）
    assert.doesNotMatch(npcSeg, /好感|年龄|行程|底色|睡眠|私有档案|成长|随身物/, surface + '：多喂了不该给配角的层');
  }
});

// 上一条心声原来【只写不读】：提示词里写着「和这个成员上一条心声不一样」，
// 而模型从来没见过上一条（她 2026-09-20 点头补上）。主角色这一头也要有。
test('主角色也看得见自己上一条心声', () => {
  const env = wire(fixture());
  env.statesRef.current.a = { wearing: '甲衣', action: '甲动作', thought: '甲的上一条心声' };
  const text = evaluate(sections.online, env, 'memberDesc');
  const a = text.slice(text.indexOf('【甲】'), text.indexOf('【乙】'));
  assert.match(a, /上一条心声=甲的上一条心声/);
});
