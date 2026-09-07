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
    members, people: members, characters: members, phones: {}, groupId: 'g', profile: {},
    gs: { memoryInterop: true }, gcInterop: true, gPersonaCap: 6000, gCallCap: 6000, NPC_PERSONA_CAP: 900,
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
    crossChannelSaid: id => id + '跨群消息', listenRef: { current: { playlists: [{ charId: 'a', songs: [{ title: '甲的歌' }] }] } },
    window: { HeartKit: { personaText: x => x }, MoodLabel: { settle: label => ({ label, note: '' }) } },
  };
  env.ctx = { npcOwnerName: { npc: '甲' } };
  const maps = { memberGrown: ['甲成长', '乙成长'], memberAMood: ['a底色', 'b底色'], memberSleep: ['a睡眠\n第二行', 'b睡眠\n第二行'], memberHome: ['甲城', '乙城'], memberCarry: ['甲随身物', '乙随身物'], memberCoupleArchive: ['a私有档案', 'b私有档案'] };
  for (const [key, values] of Object.entries(maps)) env.ctx[key] = { a: values[0], b: values[1] };
  return env;
}
const evaluate = (code, env, result) => new Function('env', 'with (env) { ' + code + '\nreturn ' + result + '; }')(env);
const collector = cut(app, '  const groupBackgroundFor =', '  const ctxForGroupOffline =');
const now = cut(app, '  const groupNowSegs =', '  // 这位成员最近和用户的单聊');
const formatter = cut(engine, 'function groupBackgroundSegments(', 'function groupPersonaText(');
function wire(env) {
  env.groupBackgroundSegments = evaluate(formatter, env, 'groupBackgroundSegments');
  env.groupBackgroundFor = evaluate(collector, env, 'groupBackgroundFor');
  env.groupNowSegs = evaluate(now, env, 'groupNowSegs');
  return env;
}
const sections = {
  online: cut(app, '      const memberDesc = members.map(c => {', '      // B（v50.80）'),
  call: cut(app, '        const memberDesc = people.map(c => {', '        // 实时私聊窗口'),
  offline: cut(engine, '  const memberDesc = members.map(c => {\n    const bg =', '  // 群里每人最多一段'),
};
module.exports = { app, engine, cut, fixture, evaluate, wire, sections };
