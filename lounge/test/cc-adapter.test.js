'use strict';
// 三方会客厅 · Step 2 CC Adapter 离线测试（node:test）
// 全程 spy sender（绝不调用 send_message）+ 临时 fixture transcript（绝不碰真会话）。
// 验的是将来活测要用的真实读取/可见闸/分类逻辑。
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

function tmpFile() { return path.join(os.tmpdir(), `cc_fixture_${process.pid}_${crypto.randomUUID()}.jsonl`); }
function writeJ(f, objs) { fs.writeFileSync(f, objs.map((o) => JSON.stringify(o)).join('\n') + '\n'); }
function appendJ(f, objs) { fs.appendFileSync(f, objs.map((o) => JSON.stringify(o)).join('\n') + '\n'); }

// 造一个 adapter：注入 spy sender + resolve→fixture 文件；now 为固定虚拟时间
function mkAdapter(file, { now = 5000, silenceMs = 1500 } = {}) {
  const clock = fakeClock(now);
  const sent = [];
  const adapter = new CCAdapter({
    sender: async (sessionId, text) => { sent.push({ sessionId, text }); },  // 绝不真实投递
    resolve: () => ({ transcriptPath: file }),
    clock, silenceMs,
  });
  return { adapter, sent, clock };
}

// deliver 后手动往 fixture 追加"投递后"内容（模拟 send_message 落地 + 目标回复）
async function deliverThen(adapter, file, appendEvents, { content = '测试正文', session = 'local_TARGET' } = {}) {
  const dispatch_id = `dispatch_${rid()}`;
  await adapter.deliver({ dispatch_id, cc_session_id: session, content });
  if (appendEvents && appendEvents.length) appendJ(file, appendEvents);
  return dispatch_id;
}

async function withFixture(pre, fn) {
  const f = tmpFile();
  writeJ(f, pre.length ? pre : [{ type: 'system', timestamp: TS0 }]);
  try { return await fn(f); } finally { try { fs.unlinkSync(f); } catch {} }
}

test('deliver：调 spy sender 一次、记录投前游标；不触真实投递', async () => {
  await withFixture([uHuman('历史消息')], async (f) => {
    const { adapter, sent } = mkAdapter(f);
    const preSize = fs.statSync(f).size;
    const id = await deliverThen(adapter, f, [], { content: '在吗' });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].text, '在吗');
    assert.equal(adapter._st.get(id).cursor, preSize);   // 投前字节游标
  });
});

test('poll replied（静默收 turn）：可见正文取回，thinking/工具排除', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 5000 });
    const id = await deliverThen(adapter, f, [uCross('在吗'), aThink(), aTool(), aText('宝宝，收到了')]);
    const r = await adapter.poll(id);
    assert.equal(r.state, 'replied');
    assert.equal(r.reply.content, '宝宝，收到了');
    assert.equal(r.reply.bubbles, 1);
  });
});

test('poll replied（边界收 turn）：助手回完后出现真人下一轮 → 收本轮', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 0 });   // now=0 不静默，靠边界
    const id = await deliverThen(adapter, f, [uCross('在吗'), aText('回复了'), uHuman('下一句')]);
    const r = await adapter.poll(id);
    assert.equal(r.state, 'replied');
    assert.equal(r.reply.content, '回复了');
  });
});

test('poll 多气泡收齐：多段 assistant text → 一个包，bubbles 计数', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f);
    const id = await deliverThen(adapter, f, [uCross('在吗'), aText('第一段'), aText('第二段'), aText('第三段')]);
    const r = await adapter.poll(id);
    assert.equal(r.state, 'replied');
    assert.equal(r.reply.bubbles, 3);
    assert.equal(r.reply.content, '第一段\n\n第二段\n\n第三段');
  });
});

test('poll empty：只有 thinking/工具、无可见正文 → empty（不造假气泡, §6）', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 5000 });
    const id = await deliverThen(adapter, f, [uCross('在吗'), aThink(), aTool()]);
    const r = await adapter.poll(id);
    assert.equal(r.state, 'empty');
  });
});

test('poll intrusion：助手还没答就被真人插队 → intrusion（不猜绑, §2bis）', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f);
    const id = await deliverThen(adapter, f, [uCross('在吗'), uHuman('我先插一句')]);
    const r = await adapter.poll(id);
    assert.equal(r.state, 'intrusion');
  });
});

test('poll pending：还在冒泡、未静默未到边界', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 1000, silenceMs: 1500 }); // 1000-0<1500 未静默
    const id = await deliverThen(adapter, f, [uCross('在吗'), aText('半句…')]);
    const r = await adapter.poll(id);
    assert.equal(r.state, 'pending');
  });
});

test('poll 子 agent(sidechain) 排除：只取主回复', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 5000 });
    const id = await deliverThen(adapter, f, [uCross('在吗'), aSide('子agent的话'), aText('主回复')]);
    const r = await adapter.poll(id);
    assert.equal(r.state, 'replied');
    assert.equal(r.reply.content, '主回复');
  });
});

test('poll 工具回执不算边界：工具环后仍能收到回复', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f, { now: 5000 });
    const id = await deliverThen(adapter, f, [uCross('在吗'), aTool(), uTool(), aText('用完工具后的回复')]);
    const r = await adapter.poll(id);
    assert.equal(r.state, 'replied');
    assert.equal(r.reply.content, '用完工具后的回复');
  });
});

test('poll 我们的消息还没落地 → pending', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f);
    const id = await deliverThen(adapter, f, [aText('这是别人的对话')]); // 无 cross-session/ourText
    const r = await adapter.poll(id);
    assert.equal(r.state, 'pending');
  });
});

test('poll 未知 dispatch_id → pending（重启内存态丢失时交给 orchestrator 恢复）', async () => {
  await withFixture([uHuman('x')], async (f) => {
    const { adapter } = mkAdapter(f);
    const r = await adapter.poll('dispatch_unknown');
    assert.equal(r.state, 'pending');
  });
});

test('集成：Orchestrator + 真实 CCAdapter（spy sender 追加回复）→ 状态机收敛 replied', async () => {
  const f = tmpFile();
  writeJ(f, [{ type: 'system', timestamp: TS0 }]);
  try {
    const clock = fakeClock(0);
    const sent = [];
    // sender 被调 = 模拟 send_message 唤醒目标；这里顺手把"目标回复"写进 transcript（ts=0，靠静默收）
    const cc = new CCAdapter({
      sender: async (sessionId, text) => { sent.push({ sessionId, text }); appendJ(f, [uCross(text), aText('宝宝，收到了')]); },
      resolve: () => ({ transcriptPath: f }),
      clock, silenceMs: 1500,
    });
    const db = openDb(':memory:');
    const orch = new Orchestrator({ db, cc, codex: new FakeAdapter('codex'), clock, pollInterval: 500, defaultTimeoutMs: 60000 });
    const room = orch.createRoom({ cc_session_id: 'local_TARGET' });
    const msg = orch.postLisaMessage(room.room_id, '在吗宝宝');
    const res = await orch.dispatch({ room_id: room.room_id, target: 'yanqiu', message_id: msg.message_id });
    assert.equal(res.status, 'replied');
    assert.equal(sent.length, 1);                    // 只外呼一次
    const bound = orch.listMessages(room.room_id).find((m) => m.speaker === 'yanqiu');
    assert.equal(bound.content, '宝宝，收到了');       // 可见正文被绑回
    assert.equal(orch.getRoom(room.room_id).status, 'paused');
  } finally { try { fs.unlinkSync(f); } catch {} }
});
