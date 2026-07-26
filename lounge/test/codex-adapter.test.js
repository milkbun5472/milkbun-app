'use strict';
// Step 3 Codex Adapter 离线测试：fake runner + 临时 JSONL spool，绝不启动真实 Codex CLI。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { openDb } = require('../db');
const { fakeClock } = require('../clock');
const { FakeAdapter } = require('../adapters/fake');
const { CodexAdapter } = require('../adapters/codex');
const { classifyCodexJsonl } = require('../adapters/codex-jsonl');
const { Orchestrator } = require('../orchestrator');

const tmp = (tag) => path.join(os.tmpdir(), `${tag}_${process.pid}_${crypto.randomUUID()}`);
const cleanup = (...files) => {
  for (const f of files) for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(f + suffix); } catch {}
  }
};
const lines = (...events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
const started = (thread = 'thread_old') => ({ type: 'thread.started', thread_id: thread });
const turnStarted = (id = 'turn_1') => ({ type: 'turn.started', turn_id: id });
const item = (type, text = '') => ({ type: 'item.completed', item: { type, text } });
const completed = (usage = { input_tokens: 123, output_tokens: 7 }) => ({ type: 'turn.completed', turn_id: 'turn_1', usage });

function fakeRunner(writeEvents = null) {
  const calls = [];
  return {
    calls,
    exists: () => true,
    async start(args) {
      calls.push(args);
      fs.mkdirSync(path.dirname(args.spoolPath), { recursive: true });
      if (writeEvents) fs.writeFileSync(args.spoolPath, writeEvents(args), { mode: 0o600 });
      else fs.closeSync(fs.openSync(args.spoolPath, 'a', 0o600));
      return { pid: 4242 };
    },
  };
}

test('JSONL 可见闸：只取 completed turn 的最终 agent_message，过滤工具/commentary，并保留 usage', () => {
  const r = classifyCodexJsonl(lines(
    started(), turnStarted(),
    item('commentary', '不能进正文'),
    item('tool_call', '不能进正文'),
    item('agent_message', '第一段中间可见'),
    item('agent_message', '最终可见正文'),
    completed({ input_tokens: 900, output_tokens: 11 }),
  ), 'thread_old');
  assert.equal(r.state, 'replied');
  assert.equal(r.reply.content, '最终可见正文');
  assert.deepEqual(r.reply.usage, { input_tokens: 900, output_tokens: 11 });
});

test('JSONL 未 completed 一律 pending；completed 无可见正文为 empty；失败为 error', () => {
  assert.equal(classifyCodexJsonl(lines(started(), turnStarted(), item('agent_message', '还没封包')), 'thread_old').state, 'pending');
  assert.equal(classifyCodexJsonl(lines(started(), turnStarted(), item('tool_call'), completed()), 'thread_old').state, 'empty');
  assert.equal(classifyCodexJsonl(lines(started(), { type: 'turn.failed' }), 'thread_old').state, 'error');
  assert.equal(classifyCodexJsonl(lines(started(), { type: 'process.exited', exit_code: 1 }), 'thread_old').reason, 'process_failed');
  assert.equal(classifyCodexJsonl(lines(started(), { type: 'process.exited', exit_code: 0 }), 'thread_old').reason, 'process_exited_without_completion');
});

test('CLI 中途重连报错但最终完成 → 以完成封包为准，不误判 needs_attention', () => {
  const r = classifyCodexJsonl(lines(
    started(), turnStarted(),
    { type: 'error', message: 'Reconnecting... 2/5' },
    { type: 'error', message: 'Reconnecting... 3/5' },
    item('agent_message', '重连后完整生成的最终正文'),
    completed({ input_tokens: 321, output_tokens: 18 }),
    { type: 'process.exited', exit_code: 0 },
  ), 'thread_old');
  assert.equal(r.state, 'replied');
  assert.equal(r.reply.content, '重连后完整生成的最终正文');
});

test('CLI 正在重连且尚未完成 → 保持 pending，不能抢跑结案', () => {
  const r = classifyCodexJsonl(lines(
    started(), turnStarted(),
    { type: 'error', message: 'Reconnecting... 2/5' },
    { type: 'error', message: 'Reconnecting... 3/5' },
  ), 'thread_old');
  assert.equal(r.state, 'pending');
});

test('thread.started 不等于绑定旧任务 → intrusion，绝不接错任务', () => {
  const r = classifyCodexJsonl(lines(started('thread_new'), turnStarted(), item('agent_message', '错任务回复'), completed()), 'thread_old');
  assert.equal(r.state, 'intrusion');
  assert.equal(r.reason, 'thread_mismatch');
});

test('CodexAdapter 默认强制同一个 DB；ephemeral 仅测试显式放行', () => {
  const runner = fakeRunner();
  assert.throws(() => new CodexAdapter({ runner }), /同一个 db|ephemeral/);
  assert.doesNotThrow(() => new CodexAdapter({ runner, ephemeral: true }));
  const db = openDb(':memory:');
  assert.throws(() => new CodexAdapter({ runner, db }), /threadHealth|运行状态/);
});

test('额度闸在功能闸之前：未确认不建 dispatch、不扣 calls、不启动 runner', async () => {
  const db = openDb(':memory:');
  const runner = fakeRunner();
  const codex = new CodexAdapter({ db, runner, spoolDir: tmp('codex_spool'), threadHealth: async () => ({ exists: true, running: false }) });
  const orch = new Orchestrator({ db, cc: new FakeAdapter('cc'), codex, clock: fakeClock(0) });
  const room = orch.createRoom({ codex_thread_id: 'thread_old' });
  const msg = orch.postLisaMessage(room.room_id, '只是一句测试');
  const r = await orch.dispatch({ room_id: room.room_id, target: 'codex', message_id: msg.message_id });
  assert.deepEqual(r, { status: 'refused', reason: 'codex_confirmation_required' });
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dispatches').get().c, 0);
  assert.equal(orch.getRoom(room.room_id).calls_today, 0);
  assert.equal(runner.calls.length, 0);
});

test('目标任务 active/inProgress 时拒绝：不建 dispatch、不扣预算、不启动 CLI', async () => {
  const db = openDb(':memory:');
  const runner = fakeRunner();
  const codex = new CodexAdapter({ db, runner, spoolDir: tmp('codex_spool'), threadHealth: async () => ({ exists: true, running: true }) });
  const orch = new Orchestrator({ db, cc: new FakeAdapter('cc'), codex, clock: fakeClock(0) });
  const room = orch.createRoom({ codex_thread_id: 'thread_old' });
  const msg = orch.postLisaMessage(room.room_id, '别并发');
  const r = await orch.dispatch({ room_id: room.room_id, target: 'codex', message_id: msg.message_id, codex_confirmed: true });
  assert.equal(r.status, 'refused');
  assert.equal(r.reason, 'THREAD_BUSY');
  assert.equal(db.prepare('SELECT COUNT(*) c FROM dispatches').get().c, 0);
  assert.equal(orch.getRoom(room.room_id).calls_today, 0);
  assert.equal(runner.calls.length, 0);
});

test('确认后调用 fake runner 一次：复用指定 thread、自然正文、完成后落库 usage', async () => {
  const spoolDir = tmp('codex_spool');
  const db = openDb(':memory:');
  const runner = fakeRunner(() => lines(
    started('thread_old'), turnStarted('turn_77'),
    item('tool_call', '隐藏工具'),
    item('agent_message', 'Codex 的最终可见回复'),
    completed({ input_tokens: 456, cached_input_tokens: 400, output_tokens: 9 }),
  ));
  const clock = fakeClock(0);
  const codex = new CodexAdapter({ db, runner, spoolDir, threadHealth: async () => ({ exists: true, running: false }), clock });
  const orch = new Orchestrator({ db, cc: new FakeAdapter('cc'), codex, clock });
  const room = orch.createRoom({ codex_thread_id: 'thread_old' });
  const msg = orch.postLisaMessage(room.room_id, 'Lisa：宝宝看看这一句');
  const r = await orch.dispatch({
    room_id: room.room_id, target: 'codex', message_id: msg.message_id, codex_confirmed: true,
  });
  assert.equal(r.status, 'replied');
  assert.equal(runner.calls.length, 1);
  assert.equal(runner.calls[0].threadId, 'thread_old');
  assert.equal(runner.calls[0].prompt, 'Lisa：宝宝看看这一句');
  assert.equal(orch.listMessages(room.room_id).find((m) => m.speaker === 'codex').content, 'Codex 的最终可见回复');
  const usage = db.prepare('SELECT * FROM adapter_usage WHERE dispatch_id=?').get(r.dispatch_id);
  assert.deepEqual(JSON.parse(usage.usage_json), { input_tokens: 456, cached_input_tokens: 400, output_tokens: 9 });
  cleanup(spoolDir);
});

test('真·关库重开：CLI 已完成后新 Adapter recover 只采集，runner 仍只启动一次', async () => {
  const dbFile = tmp('codex_db') + '.db';
  const spoolDir = tmp('codex_spool');
  let starts = 0;
  const runner = fakeRunner((args) => {
    starts++;
    return lines(started(args.threadId), turnStarted('turn_recover'));
  });
  try {
    const db1 = openDb(dbFile);
    const clock1 = fakeClock(0);
    const codex1 = new CodexAdapter({ db: db1, runner, spoolDir, threadHealth: async () => ({ exists: true, running: false }), clock: clock1 });
    const orch1 = new Orchestrator({ db: db1, cc: new FakeAdapter('cc'), codex: codex1, clock: clock1 });
    const room = orch1.createRoom({ codex_thread_id: 'thread_old' });
    const msg = orch1.postLisaMessage(room.room_id, '恢复测试');
    const b = await orch1._beginDispatch({
      room_id: room.room_id, target: 'codex', message_id: msg.message_id, codex_confirmed: true,
    });
    const state = db1.prepare('SELECT * FROM codex_dispatch_state WHERE dispatch_id=?').get(b.dispatch_id);
    fs.appendFileSync(state.spool_path, lines(item('agent_message', '崩溃前已经答完'), completed({ input_tokens: 10, output_tokens: 2 })));
    db1.close();

    const db2 = openDb(dbFile);
    const codex2 = new CodexAdapter({ db: db2, runner, spoolDir, threadHealth: async () => ({ exists: true, running: false }), clock: fakeClock(5000) });
    const orch2 = new Orchestrator({ db: db2, cc: new FakeAdapter('cc'), codex: codex2, clock: fakeClock(5000) });
    const summary = await orch2.recover();
    assert.equal(summary.collected, 1);
    assert.equal(orch2.getDispatch(b.dispatch_id).status, 'replied');
    assert.equal(orch2.listMessages(room.room_id).find((m) => m.speaker === 'codex').content, '崩溃前已经答完');
    assert.equal(starts, 1);
    db2.close();
  } finally {
    cleanup(dbFile);
    try { fs.rmSync(spoolDir, { recursive: true, force: true }); } catch {}
  }
});

test('幂等重查已完成 dispatch 不需要再次确认，也不再次 preflight/启动 runner', async () => {
  const spoolDir = tmp('codex_spool');
  const db = openDb(':memory:');
  let healthCalls = 0;
  const runner = fakeRunner(() => lines(started(), turnStarted(), item('agent_message', '一次就够'), completed()));
  const codex = new CodexAdapter({
    db, runner, spoolDir,
    threadHealth: async () => { healthCalls++; return { exists: true, running: false }; },
    clock: fakeClock(0),
  });
  const orch = new Orchestrator({ db, cc: new FakeAdapter('cc'), codex, clock: fakeClock(0) });
  const room = orch.createRoom({ codex_thread_id: 'thread_old' });
  const msg = orch.postLisaMessage(room.room_id, '幂等');
  const first = await orch.dispatch({ room_id: room.room_id, target: 'codex', message_id: msg.message_id, codex_confirmed: true });
  const second = await orch.dispatch({ room_id: room.room_id, target: 'codex', message_id: msg.message_id });
  assert.equal(first.status, 'replied');
  assert.equal(second.idempotent, true);
  assert.equal(runner.calls.length, 1);
  assert.equal(healthCalls, 2); // 首次 preflight + deliver 二次竞态检查；幂等重查不再调用
  try { fs.rmSync(spoolDir, { recursive: true, force: true }); } catch {}
});
