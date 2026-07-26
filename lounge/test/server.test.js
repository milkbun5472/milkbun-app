'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../db');
const { Orchestrator } = require('../orchestrator');
const { FakeAdapter } = require('../adapters/fake');
const { createLoungeServer } = require('../server');

let db;
let orch;
let server;
let base;

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data };
}

beforeEach(async () => {
  db = openDb(':memory:');
  orch = new Orchestrator({
    db,
    cc: new FakeAdapter('cc'),
    codex: new FakeAdapter('codex'),
    pollInterval: 1,
    defaultTimeoutMs: 1000,
  });
  ({ server } = createLoungeServer({
    orch,
    runtime: { mode: 'test' },
    roomDefaults: { max_auto_turns: 2, daily_call_cap: 20, daily_char_cap: 16000 },
  }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

test('Step 4: health 只暴露本地状态，不暴露会话绑定', async () => {
  const { response, data } = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(data.bind, '127.0.0.1');
  assert.equal(data.adapters.cc.online, true);
  assert.equal(JSON.stringify(data).includes('session_id'), false);
  assert.equal(JSON.stringify(data).includes('thread_id'), false);
});

test('真实 Adapter 即使返回 thread/path 字段，health 也只保留白名单', async () => {
  orch.adapters.codex.getHealth = async () => ({
    online: true,
    running: false,
    threadId: 'PRIVATE_THREAD',
    transcriptPath: '/private/transcript',
    transport: 'official_cli',
  });
  const { data } = await request('/api/health');
  assert.equal(data.adapters.codex.online, true);
  assert.equal(data.adapters.codex.transport, 'official_cli');
  assert.equal(JSON.stringify(data).includes('PRIVATE_THREAD'), false);
  assert.equal(JSON.stringify(data).includes('/private/transcript'), false);
});

test('Step 4: 创建房间→Lisa 发言→请言秋说，时间线完整收回', async () => {
  const created = await request('/api/rooms', { method: 'POST', body: { title: '今晚的桌' } });
  assert.equal(created.response.status, 201);
  const roomId = created.data.room.room_id;

  const posted = await request(`/api/rooms/${roomId}/messages`, {
    method: 'POST',
    body: { content: '宝宝，你和 Codex 看看这个想法。' },
  });
  assert.equal(posted.response.status, 201);
  assert.equal(posted.data.message.speaker, 'lisa');

  const sent = await request(`/api/rooms/${roomId}/dispatch`, {
    method: 'POST',
    body: { target: 'yanqiu', message_id: posted.data.message.message_id },
  });
  assert.equal(sent.response.status, 200);
  assert.equal(sent.data.result.status, 'replied');
  assert.deepEqual(sent.data.state.messages.filter((m) => !m.automatic).map((m) => m.speaker), ['lisa', 'yanqiu']);
  assert.equal(sent.data.state.room.status, 'paused');
});

test('current-room 始终把旧标签带回最近活动的当前桌', async () => {
  const oldRoom = await request('/api/rooms', { method: 'POST', body: { title: '旧桌' } });
  const currentRoom = await request('/api/rooms', { method: 'POST', body: { title: '当前桌' } });
  orch.postLisaMessage(currentRoom.data.room.room_id, '当前桌上的新话');
  const current = await request('/api/rooms/current');
  assert.equal(current.response.status, 200);
  assert.equal(current.data.room.room_id, currentRoom.data.room.room_id);
  assert.notEqual(current.data.room.room_id, oldRoom.data.room.room_id);
  assert.equal(current.data.messages.at(-1).content, '当前桌上的新话');
});

test('无需先发消息也能单独呼叫；邀请不伪造成 Lisa 可见气泡', async () => {
  const created = await request('/api/rooms', { method: 'POST', body: {} });
  const roomId = created.data.room.room_id;
  const called = await request(`/api/rooms/${roomId}/summon`, {
    method: 'POST',
    body: { target: 'yanqiu' },
  });
  assert.equal(called.response.status, 200);
  assert.equal(called.data.result.status, 'replied');
  const visible = called.data.state.messages.filter((m) => !m.automatic);
  assert.deepEqual(visible.map((m) => m.speaker), ['yanqiu']);
  const dispatch = called.data.state.dispatches.at(-1);
  const invitation = orch.getMessage(dispatch.message_id);
  assert.equal(invitation.automatic, 1);
  assert.match(invitation.content, /按下呼叫/);
  assert.match(invitation.content, /没有新的指定问题/);
});

test('直接呼叫会带上对方离桌后新增公开内容，不要求新增 Lisa 消息', async () => {
  const created = await request('/api/rooms', { method: 'POST', body: {} });
  const roomId = created.data.room.room_id;
  orch.ingestExternalMessage(roomId, {
    speaker: 'codex', content: '我补了一条公开意见。', origin: 'codex', origin_message_id: 'codex-public-1',
  });
  const called = await request(`/api/rooms/${roomId}/summon`, {
    method: 'POST',
    body: { target: 'yanqiu' },
  });
  assert.equal(called.response.status, 200);
  const dispatch = called.data.state.dispatches.at(-1);
  const invitation = orch.getMessage(dispatch.message_id);
  assert.match(invitation.content, /Codex：我补了一条公开意见/);
});

test('连续两条 Lisa 消息作为同一批完整递出', async () => {
  const created = await request('/api/rooms', { method: 'POST', body: {} });
  const roomId = created.data.room.room_id;
  const first = await request(`/api/rooms/${roomId}/messages`, { method: 'POST', body: { content: '第一条' } });
  const second = await request(`/api/rooms/${roomId}/messages`, { method: 'POST', body: { content: '第二条' } });
  const sent = await request(`/api/rooms/${roomId}/dispatch`, {
    method: 'POST',
    body: {
      target: 'yanqiu',
      message_ids: [first.data.message.message_id, second.data.message.message_id],
    },
  });
  assert.equal(sent.response.status, 200);
  const dispatch = sent.data.state.dispatches.at(-1);
  assert.equal(orch.getMessage(dispatch.message_id).content, '第一条\n\n第二条');
});

test('施工交接必须走专属按钮语义，普通“可以”不会被改写成授权', async () => {
  const created = await request('/api/rooms', { method: 'POST', body: {} });
  const roomId = created.data.room.room_id;
  const posted = await request(`/api/rooms/${roomId}/messages`, {
    method: 'POST',
    body: { content: '可以，先这样讨论。' },
  });
  assert.equal(posted.data.message.content, '可以，先这样讨论。');

  const handed = await request(`/api/rooms/${roomId}/handoff`, {
    method: 'POST',
    body: {
      target: 'codex',
      message_ids: [posted.data.message.message_id],
      codex_confirmed: true,
    },
  });
  assert.equal(handed.response.status, 200);
  const dispatch = handed.data.state.dispatches.at(-1);
  const envelope = orch.getMessage(dispatch.message_id);
  assert.match(envelope.content, /明确按下「施工交接」/);
  assert.match(envelope.content, /正式授权Codex开始动手/);
  assert.match(envelope.content, /可以，先这样讨论/);
  assert.doesNotMatch(envelope.content, /dispatch_|round_|run_/);
});

test('本地前端资源禁用缓存，修复后刷新即取同版 JS/CSS', async () => {
  const response = await fetch(`${base}/app.js`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('Step 4: Codex 每次必须显式确认', async () => {
  const created = await request('/api/rooms', { method: 'POST', body: {} });
  const roomId = created.data.room.room_id;
  const posted = await request(`/api/rooms/${roomId}/messages`, { method: 'POST', body: { content: '看一下。' } });
  const refused = await request(`/api/rooms/${roomId}/dispatch`, {
    method: 'POST',
    body: { target: 'codex', message_id: posted.data.message.message_id, codex_confirmed: false },
  });
  assert.equal(refused.response.status, 409);
  assert.equal(refused.data.result.reason, 'codex_confirmation_required');
  assert.equal(refused.data.state.room.calls_today, 0);
});

test('Step 4: 双方各答一轮严格两棒后暂停', async () => {
  const created = await request('/api/rooms', { method: 'POST', body: {} });
  const roomId = created.data.room.room_id;
  const posted = await request(`/api/rooms/${roomId}/messages`, {
    method: 'POST',
    body: { content: '你俩各说一次就停。' },
  });
  const run = await request(`/api/rooms/${roomId}/run-one-each`, {
    method: 'POST',
    body: { message_id: posted.data.message.message_id, first_speaker: 'codex', codex_confirmed: true },
  });
  assert.equal(run.response.status, 200);
  assert.equal(run.data.result.results.length, 2);
  assert.deepEqual(run.data.result.results.map((x) => x.speaker), ['codex', 'yanqiu']);
  assert.equal(run.data.state.room.status, 'paused');
  assert.equal(run.data.state.room.calls_today, 2);
});

test('409 安全拒绝返回人话原因，不再只显示 HTTP 409', async () => {
  const created = await request('/api/rooms', { method: 'POST', body: {} });
  const roomId = created.data.room.room_id;
  db.prepare('UPDATE rooms SET auto_turns_used=max_auto_turns WHERE room_id=?').run(roomId);
  const posted = await request(`/api/rooms/${roomId}/messages`, {
    method: 'POST',
    body: { content: '再讨论一轮。' },
  });
  const refused = await request(`/api/rooms/${roomId}/run-one-each`, {
    method: 'POST',
    body: {
      message_id: posted.data.message.message_id,
      first_speaker: 'yanqiu',
      codex_confirmed: true,
    },
  });
  assert.equal(refused.response.status, 409);
  assert.match(refused.data.message, /讨论次数|安全上限/);
  assert.equal(refused.data.result.reason, 'auto_turns_exhausted');
});

test('Step 4: 浏览器不能伪造说话人、origin 或历史消息 ID', async () => {
  const created = await request('/api/rooms', { method: 'POST', body: {} });
  const roomId = created.data.room.room_id;
  const posted = await request(`/api/rooms/${roomId}/messages`, {
    method: 'POST',
    body: {
      content: '只允许这句自然正文',
      speaker: 'yanqiu',
      origin: 'cc',
      origin_message_id: 'fake-history',
    },
  });
  assert.equal(posted.data.message.speaker, 'lisa');
  assert.equal(posted.data.message.origin, 'lounge');
  assert.equal(posted.data.message.origin_message_id, null);
});

test('Step 4: 消息正文为空和超长均在外呼前拒绝', async () => {
  const created = await request('/api/rooms', { method: 'POST', body: {} });
  const roomId = created.data.room.room_id;
  const empty = await request(`/api/rooms/${roomId}/messages`, { method: 'POST', body: { content: '   ' } });
  assert.equal(empty.response.status, 400);
  const long = await request(`/api/rooms/${roomId}/messages`, { method: 'POST', body: { content: '字'.repeat(6001) } });
  assert.equal(long.response.status, 400);
  assert.equal(orch.getRoom(roomId).calls_today, 0);
});

test('Step 4: SSE 首包是当前房间快照', async () => {
  const created = await request('/api/rooms', { method: 'POST', body: {} });
  const roomId = created.data.room.room_id;
  const controller = new AbortController();
  const response = await fetch(`${base}/api/rooms/${roomId}/events`, { signal: controller.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  const { value } = await reader.read();
  const first = new TextDecoder().decode(value);
  assert.match(first, /event: snapshot/);
  assert.match(first, new RegExp(roomId));
  controller.abort();
  await reader.cancel().catch(() => {});
});

test('Step 4: 静态前端带 CSP，且路径穿越被拒绝', async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(await page.text(), /三方会客厅/);

  const traversal = await fetch(`${base}/..%2Fpackage.json`);
  assert.ok([403, 404].includes(traversal.status));
});
