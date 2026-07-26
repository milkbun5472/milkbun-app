'use strict';
// 三方会客厅 · Step 2 CC Adapter 离线测试（node:test）
// 全程 spy sender（绝不调用 send_message）+ 临时 fixture transcript（绝不碰真会话）。
// 验的是将来活测要用的真实读取/可见闸/精确匹配分类/可恢复投递态逻辑。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { CCAdapter } = require('../adapters/cc');
const { openDb } = require('../db');
const { Orchestrator } = require('../orchestrator');
const { FakeAdapter } = require('../adapters/fake');
const { fakeClock } = require('../clock');

const TS0 = new Date(0).toISOString();
const rid = () => crypto.randomUUID();

// ---- JSONL 事件构造 ----
const uCross = (text, ts = TS0) => ({ type: 'user', timestamp: ts, message: { role: 'user', content: `<cross-session-message from="local_SENDER" name="测试发送端" encoded="1">\n${text}` } });
const uHuman = (text, ts = TS0) => ({ type: 'user', timestamp: ts, message: { role: 'user', content: text } });
const uTool = (ts = TS0) => ({ type: 'user', timestamp: ts, message: { role: 'user', content: [{ type: 'tool_result', content: '' }] } });
const aText = (text, ts = TS0, promptId = null) => ({ type: 'assistant', uuid: rid(), promptId, timestamp: ts, message: { role: 'assistant', content: [{ type: 'text', text }] } });
const aThink = (ts = TS0) => ({ type: 'assistant', uuid: rid(), timestamp: ts, message: { role: 'assistant', content: [{ type: 'thinking', thinking: '…' }] } });
const aTool = (ts = TS0) => ({ type: 'assistant', uuid: rid(), timestamp: ts, message: { role: 'assistant', content: [{ type: 'tool_use', name: 'x', input: {} }] } });
const aSide = (text, ts = TS0) => ({ type: 'assistant', isSidechain: true, uuid: rid(), timestamp: ts, message: { role: 'assistant', content: [{ type: 'text', text }] } });

function tmpFile(tag = 'cc') { return path.join(os.tmpdir(), `${tag}_${process.pid}_${crypto.randomUUID()}`); }
function writeJ(f, objs) { fs.writeFileSync(f, objs.map((o) => JSON.stringify(o)).join('\n') + '\n'); }
function appendJ(f, objs) { fs.appendFileSync(f, objs.map((o) => JSON.stringify(o)).join('\n') + '\n'); }
function cleanup(...files) { for (const f of files) for (const suf of ['', '-wal', '-shm']) { try { fs.unlinkSync(f + suf); } catch {} } }

// 纯分类单元测试：显式 ephemeral（不需持久化）
function mkAdapter(file, { now = 5000, silenceMs = 1500 } = {}) {
  const clock = fakeClock(now);
  const sent = [];
  const adapter = new CCAdapter({
    sender: async (sessionId, text) => { sent.push({ sessionId, text }); },  // 绝不真实投递
    resolve: () => ({ transcriptPath: file }),
    clock, silenceMs, ephemeral: true,
  });
  return { adapter, sent, clock };
}

test('构造：未传 db 且未声明 ephemeral → 立即报错', () => {
  assert.throws(
    () => new CCAdapter({ sender: async () => {}, resolve: () => ({ transcriptPath: 'x' }) }),
    /同一个 db|ephemeral/,
  );
  // 显式 ephemeral 允许
  assert.doesNotThrow(() => new CCAdapter({ sender: async () => {}, resolve: () => ({}), ephemeral: true }));
});

// deliver 本次正文 → 手动往 fixture 追加"投递后"内容。
// prependOurs=true 时自动补一条与本次正文匹配的跨会话行(模拟 send_message 落地)。
async function deliverThen(adapter, file, after, { content = '测试正文', session = 'local_TARGET', prependOurs = true } = {}) {
  const dispatch_id = `dispatch_${rid()}`;
  await adapter.deliver({ dispatch_id, cc_session_id: session, content });
  const lines = prependOurs ? [uCross(content), ...(after || [])] : (after || []);
  if (lines.length) appendJ(file, lines);
  return dispatch_id;
}

async function withFixture(pre, fn) {
  const f = tmpFile('cc_fixture') + '.jsonl';
  writeJ(f, pre.length ? pre : [{ type: 'system', timestamp: TS0 }]);
  try { return await fn(f); } finally { cleanup(f); }
}

test('deliver：调 spy sender 一次、记录投前游标；不触真实投递', async () => {
  await withFixture([uHuman('历史消息')], async (f) => {
    const { adapter, sent } = mkAdapter(f);
    const preSize = fs.statSync(f).size;
    const id = await deliverThen(adapter, f, [], { content: '在吗' });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].text, '在吗');
    assert.equal(adapter._st.get(id).cursor, preSize);
  });
});

test('poll replied（静默收 turn）：可见正文取回，thinking/工具排除', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 5000 });
    const id = await deliverThen(adapter, f, [aThink(), aTool(), aText('宝宝，收到了')], { content: '在吗' });
    const r = await adapter.poll(id);
    assert.equal(r.state, 'replied');
    assert.equal(r.reply.content, '宝宝，收到了');
    assert.equal(r.reply.bubbles, 1);
  });
});

test('poll replied（边界收 turn）：助手回完后出现真人下一轮 → 收本轮', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 0 });
    const id = await deliverThen(adapter, f, [aText('回复了'), uHuman('下一句')], { content: '在吗' });
    const r = await adapter.poll(id);
    assert.equal(r.state, 'replied');
    assert.equal(r.reply.content, '回复了');
  });
});

test('poll 多气泡收齐：多段 assistant text → 一个包，bubbles 计数', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f);
    const id = await deliverThen(adapter, f, [aText('第一段'), aText('第二段'), aText('第三段')], { content: '在吗' });
    const r = await adapter.poll(id);
    assert.equal(r.state, 'replied');
    assert.equal(r.reply.bubbles, 3);
    assert.equal(r.reply.content, '第一段\n\n第二段\n\n第三段');
  });
});

test('poll empty：整轮只有 thinking/工具、到真正边界仍无正文 → empty（§6）', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 5000 });
    // 助手为我们工作(thinking/工具)后，出现真正的下一轮边界，整轮无可见正文 → empty
    const id = await deliverThen(adapter, f, [aThink(), aTool(), uHuman('宝宝下一句')], { content: '在吗' });
    assert.equal((await adapter.poll(id)).state, 'empty');
  });
});

test('poll 工具循环中(无边界无正文)→ pending，绝不半路误判 empty（活测回归）', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 999999 });   // 即使静默很久
    // 复刻宝宝克活测：thinking + 多轮 tool_use/tool_result，尚未吐正文，且无轮次边界
    const id = await deliverThen(adapter, f, [aThink(), aTool(), uTool(), aTool(), uTool(), aTool(), uTool()], { content: '在吗' });
    assert.equal((await adapter.poll(id)).state, 'pending');  // 必须继续等，不能 empty
  });
});

test('poll intrusion：助手还没答就被真人插队 → intrusion（不猜绑, §2bis）', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f);
    const id = await deliverThen(adapter, f, [uHuman('我先插一句')], { content: '在吗' });
    assert.equal((await adapter.poll(id)).state, 'intrusion');
  });
});

test('poll pending：还在冒泡、未静默未到边界', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 1000, silenceMs: 1500 });
    const id = await deliverThen(adapter, f, [aText('半句…')], { content: '在吗' });
    assert.equal((await adapter.poll(id)).state, 'pending');
  });
});

test('poll 子 agent(sidechain) 排除：只取主回复', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 5000 });
    const id = await deliverThen(adapter, f, [aSide('子agent的话'), aText('主回复')], { content: '在吗' });
    const r = await adapter.poll(id);
    assert.equal(r.state, 'replied');
    assert.equal(r.reply.content, '主回复');
  });
});

test('poll 工具回执不算边界：工具环后仍能收到回复', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 5000 });
    const id = await deliverThen(adapter, f, [aTool(), uTool(), aText('用完工具后的回复')], { content: '在吗' });
    const r = await adapter.poll(id);
    assert.equal(r.state, 'replied');
    assert.equal(r.reply.content, '用完工具后的回复');
  });
});

test('poll 我们的消息还没落地 → pending', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f);
    const id = await deliverThen(adapter, f, [aText('这是别人的对话')], { content: '在吗', prependOurs: false });
    assert.equal((await adapter.poll(id)).state, 'pending');
  });
});

test('poll 未知 dispatch_id → pending', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f);
    assert.equal((await adapter.poll('dispatch_unknown')).state, 'pending');
  });
});

// ---------------- 缺口①：精确匹配"跨会话 + 本次自然正文" ----------------
test('并发-a：别的窗口 cross-session 先落、我们后落 → intrusion，不绑别人回复', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 5000 });
    const dispatch_id = `dispatch_${rid()}`;
    await adapter.deliver({ dispatch_id, cc_session_id: 'local_TARGET', content: '我们的正文' });
    // 别人的先落(内容不同)+别人的回复，然后才是我们的
    appendJ(f, [uCross('别的窗口的正文'), aText('这是给别人的回复'), uCross('我们的正文'), aText('我们的回复')]);
    const r = await adapter.poll(dispatch_id);
    assert.equal(r.state, 'intrusion');            // 不因为"任意跨会话"就绑成别人的
  });
});

test('并发-b：我们投递后、回复前被别的窗口 cross-session 插队 → intrusion', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 5000 });
    const id = await deliverThen(adapter, f, [uCross('别的窗口插一句'), aText('给别人的回复')], { content: '我们的正文' });
    const r = await adapter.poll(id);
    assert.equal(r.state, 'intrusion');
    assert.ok(!r.reply);                            // 绝不绑定别人的回复
  });
});

test('并发-d：子串误吞防护——我们=“在吗”，别人=“宝宝你在吗” → intrusion，不误绑', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 5000 });
    const dispatch_id = `dispatch_${rid()}`;
    await adapter.deliver({ dispatch_id, cc_session_id: 'local_TARGET', content: '在吗' });
    // 别人的正文包含"在吗"作子串；裸 includes 会误判为我们的 → 完整匹配必须判 foreign
    appendJ(f, [uCross('宝宝你在吗'), aText('这是给别人的回复')]);
    const r = await adapter.poll(dispatch_id);
    assert.equal(r.state, 'intrusion');
    assert.ok(!r.reply);
  });
});

test('并发-c：我们的回复正常收到后，别的窗口再来不影响本轮绑定', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 5000 });
    const id = await deliverThen(adapter, f, [aText('我们的正确回复'), uCross('别人后来的消息')], { content: '我们的正文' });
    const r = await adapter.poll(id);
    assert.equal(r.state, 'replied');
    assert.equal(r.reply.content, '我们的正确回复');
  });
});

// ---------------- 缺口②：可恢复投递态 + 真·关库重开 recover ----------------
test('真·关库重开：新 adapter/Orchestrator recover → replied，sender 仍只调 1 次', async () => {
  const dbFile = tmpFile('cc_db') + '.db';
  const tf = tmpFile('cc_tx') + '.jsonl';
  writeJ(tf, [{ type: 'system', timestamp: TS0 }]);
  let senderCalls = 0;
  const mkSender = () => async (sessionId, text) => { senderCalls++; appendJ(tf, [uCross(text), aText('宝宝，收到了')]); };
  try {
    // ---- 进程一：投递(送达)后崩溃，未收回复 ----
    const db1 = openDb(dbFile);
    const cc1 = new CCAdapter({ sender: mkSender(), resolve: () => ({ transcriptPath: tf }), clock: fakeClock(0), db: db1 });
    const orch1 = new Orchestrator({ db: db1, cc: cc1, codex: new FakeAdapter('codex'), clock: fakeClock(0) });
    const room = orch1.createRoom({ cc_session_id: 'local_TARGET' });
    const msg = orch1.postLisaMessage(room.room_id, '在吗宝宝');
    const b = await orch1._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: msg.message_id });
    assert.equal(orch1.getDispatch(b.dispatch_id).status, 'delivered');
    assert.equal(senderCalls, 1);
    db1.close();                                    // 崩溃：旧实例全销毁

    // ---- 进程二：全新 adapter + Orchestrator，同一 DB + transcript ----
    const db2 = openDb(dbFile);
    const cc2 = new CCAdapter({ sender: mkSender(), resolve: () => ({ transcriptPath: tf }), clock: fakeClock(5000), db: db2 });
    const orch2 = new Orchestrator({ db: db2, cc: cc2, codex: new FakeAdapter('codex'), clock: fakeClock(5000) });
    const summary = await orch2.recover();          // 从 DB 重建 adapter 态 → 只读 transcript
    assert.equal(summary.collected, 1);
    assert.equal(orch2.getDispatch(b.dispatch_id).status, 'replied');
    const bound = orch2.listMessages(room.room_id).find((m) => m.speaker === 'yanqiu');
    assert.equal(bound.content, '宝宝，收到了');
    assert.equal(senderCalls, 1);                   // 关键：绝不重投
    db2.close();
  } finally { cleanup(dbFile, tf); }
});

test('集成：Orchestrator + 真实 CCAdapter（sender 追加回复）→ 状态机收敛 replied', async () => {
  const tf = tmpFile('cc_tx') + '.jsonl';
  writeJ(tf, [{ type: 'system', timestamp: TS0 }]);
  try {
    const clock = fakeClock(0);
    const sent = [];
    const db = openDb(':memory:');                 // 集成测试：Orchestrator 与 CCAdapter 共用同一 db
    const cc = new CCAdapter({
      sender: async (sessionId, text) => { sent.push({ sessionId, text }); appendJ(tf, [uCross(text), aText('宝宝，收到了')]); },
      resolve: () => ({ transcriptPath: tf }), clock, silenceMs: 1500, db,
    });
    const orch = new Orchestrator({ db, cc, codex: new FakeAdapter('codex'), clock, pollInterval: 500, defaultTimeoutMs: 60000 });
    const room = orch.createRoom({ cc_session_id: 'local_TARGET' });
    const msg = orch.postLisaMessage(room.room_id, '在吗宝宝');
    const res = await orch.dispatch({ room_id: room.room_id, target: 'yanqiu', message_id: msg.message_id });
    assert.equal(res.status, 'replied');
    assert.equal(sent.length, 1);
    assert.equal(orch.listMessages(room.room_id).find((m) => m.speaker === 'yanqiu').content, '宝宝，收到了');
    assert.equal(orch.getRoom(room.room_id).status, 'paused');
  } finally { cleanup(tf); }
});
