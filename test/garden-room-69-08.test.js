// 她 2026-09-16：「专门做一间房只给庭院的，能选进哪一档存档，在庭院的东西包括进度聊天
// 啥的也能同步进来，然后要接主聊天的话也调下设置就行，然后主房想知道的时候就开房间
// 记忆互通或者总结出去」。
// ⚠️落法是【不新造机制】：房间那套 cognition/writeback 本来就长着这几排开关，
//   庭院以前只是没接上去。这份钉的就是「接上了，而且没有第二套」。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const app = rd('js/app.js'), garden = rd('js/fairy-garden.js'), comp = rd('js/components.js');

global.window = {};
require('../js/chat-rooms.js');
const Kit = window.ChatRooms;

test('庭院是房间的一个 preset，默认什么都不带、只留自己的记录', () => {
  const p = Kit.PRESETS.garden;
  assert.ok(p, '没有庭院预设');
  assert.equal(p.garden, true);
  Object.values(p.cognition).forEach(v => assert.equal(v, false, '默认不该带主线进去'));
  assert.equal(p.writeback.roomHistory, true, '说过的话总得留在这间房');
  ['memoryCandidate', 'sharedState', 'mainSummary'].forEach(k => assert.equal(!!p.writeback[k], false, k + ' 默认该是关的'));
});

test('garden 标记能存住——不然进门认不出这是庭院房', () => {
  const r = Kit.normalize({ id: 'r1', garden: true }, 'c1');
  assert.equal(r.garden, true);
  assert.equal(Kit.normalize({ id: 'r2' }, 'c1').garden, false);
  // create() 走的是 normalize(展开预设)，这里照它那一步验（node 里没有 localStorage 存不下）
  const made = Kit.normalize({ id: 'r3', preset: 'garden', ...JSON.parse(JSON.stringify(Kit.PRESETS.garden)) }, 'c1');
  assert.equal(made.garden, true, '按预设建出来的庭院房丢了标记');
  assert.equal(made.writeback.roomHistory, true);
});

test('一间房一个存档：存档键跟着房走', () => {
  assert.match(app, /storeKey: "x_fairyGarden::" \+ key/);
  assert.match(app, /const key = window\.ChatRooms\.chatKey\(activeChar\.id, activeRoomId\)/);
  // 【一局庭院】里所有读写都得认这把钥匙，漏一处就会去动公共那一档。
  // ⚠️只看 GardenSession：v69.21 起外面那层选择页会读 KEY 一次，那是为了把
  //   老的那一档认回名册（只记一笔、不搬内容），不是在动这一局的存档。
  const session = garden.slice(garden.indexOf('function GardenSession(props)'), garden.indexOf('const WORLDS = ['));
  assert.doesNotMatch(session, /loadJSON\(KEY,/, '还有地方直接读公共存档');
  assert.doesNotMatch(session, /write\(\{ \.\.\.d/, '还有地方直接写公共存档');
});

test('进门带什么走这间房的认知闸，不另写一份底子', () => {
  // buildBundle＋roomPromptFor 就是全库公用的那一份；庭院不许自己再手写一遍
  assert.match(app, /mainline: \(\(\) => \{ try \{ return buildBundle\(roomContextFor\(activeChar, key, room, \{ chat: true \}\)\) \+ roomPromptFor\(activeChar\.id, room\)/);
  const fn = garden.slice(garden.indexOf('function roleContext('), garden.indexOf('async function generateSeason'));
  const roleContext = new Function('userName', fn + ';return roleContext;')(p => (p && p.name) || '用户');
  const withMain = roleContext({ name: '甲', persona: '甲的人设' }, { name: '我' }, '【主线底子】记得你们的事');
  assert.match(withMain, /【主线底子】/);
  assert.doesNotMatch(withMain, /【完整角色人设】/, '给了底子还把人设再拼一遍＝同一层两处');
  // 没给底子（首页试玩）行为一个字不变
  const solo = roleContext({ name: '甲', persona: '甲的人设' }, { name: '我' }, '');
  assert.match(solo, /【完整角色人设】\n甲的人设/);
  assert.match(solo, /【对方的设定】/);
  // 两条路都得先说清「你就是谁」
  [withMain, solo].forEach(x => assert.match(x, /你就是「甲」/));
});

test('说过的话只有一份：落定的交给房间，存档里只留在途的', () => {
  const send = garden.slice(garden.indexOf('async function send(retry)'), garden.indexOf('const buttonStyle'));
  // ⚠️回调里读 recordRef：从小世界那条路进来时 props.record 是空的（她 2026-09-18 撞到
  //   「undefined is not an object … record.onTurn」），两条路都得拿到同一份。
  assert.match(send, /recordRef\.current\.onTurn\(\{ text: text, reply: result\.reply, parts: result\.parts \}\)/);
  assert.match(send, /\.filter\(m => m\.request !== request\)/, '交给房间之后没把在途那条撤掉＝存了两份');
  // 顺序不能反：先给房间，再撤在途的
  assert.ok(send.indexOf('record.onTurn') < send.indexOf('m.request !== request'), '中间那一瞬这句话谁都没有');
  // 父页那头写进的是这间房的聊天记录本身
  assert.match(app, /onTurn: turn => pChat\(key, p => \[\.\.\.p,/);
  // 一条一个气泡：房间里记下的条数跟他真说了几条一致（她 2026-09-17 报庭院回一大段）
  assert.match(app, /\(turn\.parts && turn\.parts\.length \? turn\.parts : \[turn\.reply\]\)/);
});

test('庭院房的同行者就是这间房的角色，不给换', () => {
  assert.match(app, /lockPartnerId: activeChar\.id/);
  assert.match(garden, /props\.toast\("这间庭院房就是和 TA 的/, '没有新开房的能力时，还是那句话');
  assert.match(garden, /if \(id && props\.onNewGardenRoom\) \{ setPick\(false\); props\.onNewGardenRoom\(id\); return; \}/,
    '挑了手机里的一位＝给 TA 开一间庭院房，不是把这一档换个人顶上');
  assert.doesNotMatch(garden, /id && props\.lockPartnerId && props\.onNewGardenRoom/,
    '挂着 lockPartnerId 的话，从首页那个入口挑人就一间房都不会有');
  assert.match(garden, /在原地换人会让这一档的过去接到别人身上/);
  assert.match(garden, /if \(\(!props\.lockPartnerId \|\| props\.onNewGardenRoom\) && \(pick \|\| \(!char && !solo\)\)\)/);
  // 挑了人一律去开一间新房（一间房＝一个庭院存档），所以哪一边都不是「换」
  assert.match(garden, /\}, "另开一间"\) : null/);
  assert.doesNotMatch(garden, /"换同行者"/);
});

test('建房那一页能选到庭院，房间列表认得出它', () => {
  assert.match(comp, /\["garden", "微光庭院"/);
  assert.match(comp, /\["garden", "庭院"\]/);
  assert.match(comp, /r\.garden\n?\s*\? \{ label: "微光庭院"/);
});
