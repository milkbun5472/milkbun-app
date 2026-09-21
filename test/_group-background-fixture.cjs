// 服务返回值用哨兵区分成员；底层存档字段另由 carry/couple/home 专项测试钉写入方。
const fs = require('node:fs');
const app = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');
const engine = fs.readFileSync(__dirname + '/../js/engine.js', 'utf8');
const cut = (src, start, end) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)));
function fixture() {
  const members = [
    { id: 'a', name: '甲', persona: '甲的人设', home: { city: '甲城' } },
    { id: 'b', name: '乙', persona: '乙的人设', home: { city: '乙城' } },
    { id: 'npc', name: '配角', persona: '配角人设', npc: true, ownerId: 'a' }
  ];
  const env = {
    SCHEDULE_CONTEXT_RULE: new Function(engine.match(/^const SCHEDULE_CONTEXT_RULE = .*;$/m)[0] + ' return SCHEDULE_CONTEXT_RULE;')(),
    members, people: members, characters: members, phones: {}, groupId: 'g', profile: {},
    gs: { memoryInterop: true }, gcInterop: true, gPersonaCap: 6000, gCallCap: 6000, NPC_PERSONA_CAP: 3000,
    userName: () => '读者', groupPersonaText: (p, cap) => p.slice(0, cap),
    statesRef: { current: { a: { wearing: '甲衣', action: '甲动作' }, b: { wearing: '乙衣' } } },
    moods: { a: { label: '甲心情', ts: 1 }, b: { label: '乙心情', ts: 2 } },
    freshLiveStateValue: (s, k) => s[k] || '',
    affOf: id => id === 'a' ? 71 : 32, ageLineFor: c => c.id + '年龄',
    coupleLineFor: id => id + '关系', schedBriefFor: c => c.id + '行程', timeAwareFor: () => true,
    desiresRef: { current: { a: '甲成长', b: '乙成长' } },
    carryRef: { current: { a: '甲随身物', b: '乙随身物' } }, carryPinsRef: { current: {} },
    carryContextText: (items, pins, opts) => { if (opts.cap !== 260) throw Error('随身物预算改变'); return items || ''; },
    aMoodTextOf: id => id + '底色', sleepToneOf: c => c.id + '睡眠\n第二行',
    coupleArchiveFor: id => id + '私有档案', coupleArchiveBlock: (a, u) => a + ' / ' + u,
    // v68.43：称呼跟情侣状态同一档，落在【那位成员自己那一段】里（app.js 的 nickLineFor）。
    // ⚠️默认给空串：绝大多数角色没有称呼，所以【没有称呼时那一段要跟以前一字不差】——
    //   那正是下面那张金牌哈希在守的东西。要试有称呼的那一路，在用例里自己覆盖它。
    nickLineFor: () => '',
    // v68.70：拉黑／刚解除跟情侣状态、称呼同一档，落在【那位成员自己那一段】里
    blockLineFor: () => '',
    crossChannelSaid: id => id + '跨群消息', listenRef: { current: { playlists: [{ charId: 'a', songs: [{ title: '甲的歌' }] }] } },
    window: { HeartKit: { personaText: x => x }, MoodLabel: { settle: label => ({ label, note: '' }) } },
  };
  // v68.84：配角那一行搬成公共的 npcRosterLine（在场的谁跟 TA 有边也要说出来）。
  // 这儿接【真的那一份】而不是打桩：它现在决定配角在三处成员表里长什么样，打桩就等于没测。
  env.rels = {};
  env.npcRosterLine = new Function('characters', 'rels', 'userName', 'profile',
    cut(app, '  const npcRosterLine =', '  const npcsOf =') + ' return npcRosterLine;'
  )(members, env.rels, () => '读者', {});
  // v68.84：群线下那一行也改由 app 算好递过来（ctx.npcRoster）；npcOwnerName 只剩兜底
  env.ctx = { npcOwnerName: { npc: '甲' }, npcRoster: { npc: env.npcRosterLine(members[2], members.map(x => x.id)) } };
  const maps = { memberGrown: ['甲成长', '乙成长'], memberAMood: ['a底色', 'b底色'], memberSleep: ['a睡眠\n第二行', 'b睡眠\n第二行'], memberHome: ['甲城', '乙城'], memberCarry: ['甲随身物', '乙随身物'], memberCoupleArchive: ['a私有档案', 'b私有档案'] };
  for (const [key, values] of Object.entries(maps)) env.ctx[key] = { a: values[0], b: values[1] };
  return env;
}
const evaluate = (code, env, result) => new Function('env', 'with (env) { ' + code + '\nreturn ' + result + '; }')(env);
const collector = cut(app, '  const groupBackgroundFor =', '  const ctxForGroupOffline =');
const now = cut(app, '  const groupNowSegs =', '  // 这位成员最近和用户的单聊');
const formatter = cut(engine, 'function groupBackgroundSegments(', 'function groupPersonaText(');
function wire(env) {
  // v70.61 起钱都过 moneyText（一人一个币种，js/money.js）。桩按【没设过币种】那一档来，
  // 也就是人民币原样——这些用例验的不是钱怎么写，是那几段有没有拼进去。
  if (!env.moneyText) env.moneyText = (n, id) => "¥" + n;
  env.liveStateContext = evaluate(cut(app, "  const liveStateContext =", "  // 心声历史："), env, "liveStateContext");
  env.wishRef = {current:[]};
  env.wishFor = evaluate(cut(app, "  const wishFor =", "  const onMeFor ="), env, "wishFor");
  env.wishLine = evaluate(cut(engine, "function wishLine(", "function onMeLine("), env, "wishLine");
  env.memberPrivateContextFor = evaluate(cut(app, "  const memberPrivateContextFor =", "  // ---- 通话 / 视频"), env, "memberPrivateContextFor");
  env.gazeFor = evaluate(cut(app, "  const gazeFor =", "  const onMeFor ="), env, "gazeFor");
  env.inventoryRef = {current:[]}; env.ON_ME_CAP = 2;
  env.onMeFor = evaluate(cut(app, "  const onMeFor =", "  const ctxFor ="), env, "onMeFor");
  env.relationshipLineFor = evaluate(cut(app, '  const relationshipLineFor =', '  const blockChatKey ='), env, 'relationshipLineFor');
  env.groupBackgroundSegments = evaluate(formatter, env, 'groupBackgroundSegments');
  env.groupBackgroundFor = evaluate(collector, env, 'groupBackgroundFor');
  env.groupNowSegs = evaluate(now, env, 'groupNowSegs');
  // v72.06：配角那一整段（户口 + 心情／想法／穿着／动作）由公共的 npcGroupLine 拼，
  // 三条群路和群线下共用。跟 npcRosterLine 一样接【真的那一份】，打桩就等于没测。
  env.npcGroupLine = evaluate(cut(app, '  const npcGroupLine =', '  const npcsOf ='), env, 'npcGroupLine');
  env.ctx.npcRoster = { npc: env.npcGroupLine(env.members[2], env.members.map(x => x.id)) };
  return env;
}
const sections = {
  online: cut(app, '      const memberDesc = members.map(c => {', '      // B（v50.80）'),
  call: cut(app, '        const memberDesc = people.map(c => {', '        // 实时私聊窗口'),
  offline: cut(engine, '  const memberDesc = members.map(c => {\n    const bg =', '  // 群里每人最多一段'),
};
module.exports = { app, engine, cut, fixture, evaluate, wire, sections };
