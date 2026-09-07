const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const bag = new Map();
global.localStorage = {
  getItem: k => bag.get(k) || null,
  setItem: (k, v) => bag.set(k, String(v))
};
global.ChatContextFilter = require('../js/chat-context-filter.js');
const Rooms = require('../js/chat-rooms.js');
const app = fs.readFileSync('js/app.js', 'utf8');
const components = fs.readFileSync('js/components.js', 'utf8');
// 对齐 pushUser/sendRich 的写入格式：role/content/ts；旧跨端行可能没有 id。
const rows = () => [
  { id: 'u1', role: 'user', content: '我还没决定', ts: 10 },
  { id: 'a1', role: 'assistant', content: '我等你', ts: 20, turnId: 'turn1', thought: '隐藏状态' },
  { id: 'a2', role: 'assistant', content: '后来的结局', ts: 20 },
  { role: 'user', content: '未来的秘密', ts: 30 }
];
test.beforeEach(() => bag.clear());

test('按选中位置截断，包含该句且不带同时间戳的后文，不修改原聊天', () => {
  const original = rows(), before = JSON.stringify(original);
  const draft = Rooms.prepareFork('p1', Rooms.get('p1', 'main'), original, 1);
  assert.deepEqual(draft.messages.map(m => m.content), ['我还没决定', '我等你']);
  assert.equal(JSON.stringify(original), before);
  assert.notEqual(draft.messages[1].id, original[1].id);
  assert.equal(draft.messages[1].turnId, undefined);
  assert.equal(draft.messages[1].thought, undefined);
  assert.equal(draft.room.fork.seedCount, 2);
  assert.equal(Rooms.list('p1').length, 1, '打开或取消草稿不创建房间');
});

test('从侧房再分岔保留限定设定，不把后来摘要和当前状态倒灌', () => {
  const source = Rooms.create('p1', '旧支线', 'everyday');
  source.scenario = '另一段处境'; source.selfDigest = '分岔之后才发生的秘密';
  const draft = Rooms.prepareFork('p1', source, rows(), 1);
  assert.equal(draft.room.scenario, source.scenario);
  assert.equal(draft.room.selfDigest, '');
  assert.equal(draft.room.selfSummedCount, 0);
  assert.equal(draft.room.syncMode, 'frozen');
  assert.ok(Object.values(draft.room.cognition).every(v => !v));
  assert.equal(draft.room.writeback.memoryCandidate, false);
  assert.equal(draft.room.writeback.mainSummary, false);
  assert.equal(Rooms.canWrite(draft.room, 'state'), false);
  const ctx = Rooms.gateCtx({ chars: ['核心人设'], memory: '未来记忆', moodLabel: '未来心情', coupleStatus: '后来恋爱了', unexpected: '未知的新数据' }, draft.room);
  assert.deepEqual(ctx.chars, ['核心人设']);
  assert.equal(ctx.memory, ''); assert.equal(ctx.coupleStatus, '');
  assert.equal(ctx.moodLabel, ''); assert.equal(ctx.unexpected, '');
  const prompt = Rooms.prompt(draft.room, rows());
  assert.match(prompt, /分岔起点/);
  assert.doesNotMatch(prompt, /后来的结局|未来的秘密|分岔之后才发生的秘密/);
  assert.match(Rooms.doorLine(draft.room), /接着分岔前留下的聊天/);
});

test('撤回、待生成、系统行不复制；卡片留下文字，不能带原房邀请动作', () => {
  const msgs = [
    { role: 'user', content: '撤回原文', recalled: true },
    { role: 'assistant', content: '未完成', pending: true },
    { role: 'system', content: '系统秘密' },
    { role: 'assistant', kind: 'study', content: '一起学', sessionId: 'old', roomId: 'main', ts: 12 },
    { role: 'user', kind: 'photo', desc: '窗外的雨', imageRef: 'vault1', ts: 13 }
  ];
  const draft = Rooms.prepareFork('p1', Rooms.get('p1', 'main'), msgs, 4);
  assert.deepEqual(draft.messages.map(m => m.content), ['一起学', '窗外的雨']);
  assert.equal(draft.messages[0].sessionId, undefined);
  assert.equal(draft.messages[0].kind, undefined);
  assert.equal(Rooms.prepareFork('p1', Rooms.get('p1', 'main'), msgs, 0), null);
  assert.equal(Rooms.prepareFork('p2', Rooms.get('p1', 'main'), msgs, 4), null);
  assert.equal(Rooms.prepareFork('p1', Rooms.get('p1', 'main'), msgs, 99), null);
  assert.equal(Rooms.prepareFork('p1', Rooms.get('p1', 'main'), msgs, -1), null);
});

test('确认历史持久化后才开放房门，重开仍能装回；不触碰原线或另一角色', async () => {
  bag.set('x_chat:p1', JSON.stringify(rows()));
  const draft = Rooms.prepareFork('p1', Rooms.get('p1', 'main'), rows(), 1);
  const saved = await Rooms.commitFork(draft, async (k, v) => {
    assert.equal(Rooms.list('p1').length, 1);
    bag.set(k, JSON.stringify(v)); return true;
  });
  assert.ok(saved);
  const hydrated = Rooms.hydrateChats([{ id: 'p1' }], (k, fallback) => bag.has(k) ? JSON.parse(bag.get(k)) : fallback);
  assert.deepEqual(hydrated[saved.key], draft.messages);
  assert.deepEqual(hydrated.p1, rows());
  assert.equal(Rooms.list('p2').length, 1);
  assert.equal(await Rooms.commitFork(draft, async () => { throw Error('不得再次写历史'); }), null);
});

test('持久化失败保持草稿可重试；房间元数据失败不宣称创建成功', async () => {
  const draft = Rooms.prepareFork('p1', Rooms.get('p1', 'main'), rows(), 1);
  assert.equal(await Rooms.commitFork(draft, async () => false), null);
  assert.equal(await Rooms.commitFork(draft, async () => { throw Error('quota'); }), null);
  assert.equal(Rooms.list('p1').length, 1);
  const write = localStorage.setItem;
  localStorage.setItem = () => { throw Error('quota'); };
  assert.equal(await Rooms.commitFork(draft, async () => true), null);
  localStorage.setItem = write;
  assert.ok(await Rooms.commitFork(draft, async (k,v) => { bag.set(k, JSON.stringify(v)); return true; }));
});

test('房门取最近两句真实原话，忽略撤回并能跟随编辑/删除变化', () => {
  const msgs = rows();
  msgs.push({ role: 'assistant', content: '不要显示', recalled: true });
  assert.deepEqual(Rooms.resumeLines(msgs).map(r => r.text), ['后来的结局', '未来的秘密']);
  msgs[3].content = '已经编辑';
  assert.equal(Rooms.resumeLines(msgs)[1].text, '已经编辑');
  assert.deepEqual(Rooms.resumeLines([]), []);
  assert.deepEqual(Rooms.resumeLines(msgs.slice(0, 1)), [{ role: 'user', text: '我还没决定' }]);
});

test('单聊入口到持久化和房间切换接通；分岔页复用顶底栏、取消保留聊天组件', () => {
  assert.match(app, /const stored = await commitJSONDurable\(key, rows\)/);
  assert.match(app, /return stored.durable && stored.live/);
  assert.match(app, /Kit.prepareFork\(activeChar.id, sourceRoom, msgs, idx\)/);
  assert.match(app, /setActiveRoomId\(result.room.id\)/);
  assert.match(app, /key: activeChar.id \+ "::" \+ activeRoomId/);
  assert.match(app, /onClose: \(\) => setRoomFork\(null\)/);
  assert.match(components, /menuItemsForKind\(messages\[menu\], canSpeakMsg\(messages\[menu\]\), !!window.ChatRooms\)/);
  const page = components.slice(components.indexOf('function RoomForkPage('), components.indexOf('window.RoomForkPage'));
  assert.match(page, /h\(Head, \{ zh: "从这里分一间房"/);
  assert.match(page, /flex-1 min-h-0 overflow-y-auto/);
  assert.match(page, /paddingBottom: COMPOSER_PAD_BOTTOM/);
  assert.doesNotMatch(page, /h\(Sheet/);
  assert.match(page, /saving.current = true/);
  assert.match(components, /maxHeight: "calc\(100% - 32px\)", overflowY: "auto"/);
  assert.match(components, /const resumeFor = r => h\(RoomResume/);
  assert.match(components, /resumeFor\(draft\)/);
  // 桩格式钉到真正消息写入方。
  assert.match(components, /sendRich\(\{ role: "user", kind: "photo", desc: v, photoMode: "describe", content:/);
  assert.match(app, /saveJSON\("x_chat:" \+ id, n\)/);
});


test('旁白保留叙事身份；上下文排除标记和失败消息不会在分岔时复活', () => {
  const messages = [
    { role: 'user', content: '秘密', contextExcluded: true },
    { role: 'assistant', content: '（发送失败：网络断开）' },
    { role: 'narration', content: '雨停了', ts: 10 },
    { role: 'user', content: '继续', ts: 11 }
  ];
  const draft = Rooms.prepareFork('p1', Rooms.get('p1', 'main'), messages, 3);
  assert.deepEqual(draft.messages.map(m => m.content), ['雨停了', '继续']);
  assert.equal(draft.messages[0].role, 'narration');
  assert.equal(Rooms.resumeLines(draft.messages)[0].role, 'narration');
});

test('分岔房不进入仍读取主线的通话与跨房活动，原房行为不变', () => {
  const room = Rooms.prepareFork('p1', Rooms.get('p1', 'main'), rows(), 1).room;
  const parsed = { word: ['接着说'], call: 'voice', block: true, toGroup: '别的房', listenInvite: {}, songSwitch: '下一首' };
  const out = Rooms.gateForkActions(parsed, room);
  assert.deepEqual(out.word, parsed.word);
  for (const key of ['call', 'block', 'toGroup', 'listenInvite', 'songSwitch']) assert.equal(out[key], null);
  assert.equal(parsed.block, true);
  assert.equal(Rooms.gateForkActions(parsed, Rooms.get('p1', 'main')), parsed);
  assert.equal(Rooms.supportsCalls(room), false);
  assert.equal(Rooms.supportsCalls(Rooms.get('p1', 'main')), true);
  assert.match(app, /parsed = window.ChatRooms.gateForkActions\(parsed, room\)/);
  assert.match(components, /window.ChatRooms.supportsCalls\(room\)/);
});

test('公共隔离闸保留线下本房边界，未登记背景默认拦住', () => {
  const room = Rooms.create('p1', '隔离', 'isolated');
  const ctx = Rooms.gateCtx({ roomPrompt: '本房自己的设定', newlyAdded: '主线新背景' }, room);
  assert.equal(ctx.roomPrompt, '本房自己的设定');
  assert.equal(ctx.newlyAdded, '');
});
