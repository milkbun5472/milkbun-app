'use strict';
// 三方会客厅 · Step 1 验收测试（node:test，零依赖）
// 覆盖施工图 §12 第1步 + §13 必测：
//  1 重复投递不重复  2 双方各答两棒必停  3 预算用尽自动禁用  4 暂停后不启动下一棒
//  5 运行中重启不擅自重发  6 已有回复只补采集  7 插队进入 needs_attention
//  附: 单飞锁 / 立即暂停 / 超时不自动重投 / budget 分级
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../db');
const { Orchestrator } = require('../orchestrator');
const { FakeAdapter } = require('../adapters/fake');
const { fakeClock } = require('../clock');
const { budgetState } = require('../budget');

function build({ hooks = {}, max_auto_turns = 2, daily_char_cap = 0 } = {}) {
  const db = openDb(':memory:');
  const cc = new FakeAdapter('cc');
  const codex = new FakeAdapter('codex');
  const orch = new Orchestrator({ db, cc, codex, clock: fakeClock(), hooks, pollInterval: 500, defaultTimeoutMs: 60000 });
  const room = orch.createRoom({ max_auto_turns, daily_char_cap });
  return { db, cc, codex, orch, room };
}

test('1) 重复投递不重复：同(message_id,target)投3次，目标只收1次', async () => {
  const { cc, orch, room } = build();
  const src = orch.postLisaMessage(room.room_id, '宝宝你好');
  const r1 = await orch.dispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  const r2 = await orch.dispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  const r3 = await orch.dispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  assert.equal(r1.status, 'replied');
  assert.ok(r2.idempotent && r3.idempotent);
  assert.equal(cc.targetDeliverCount(src.message_id, 'yanqiu'), 1); // 关键：只投一次
});

test('2) 双方各答一轮：严格2棒后强制暂停，第3棒不自启动', async () => {
  const { orch, room } = build({ max_auto_turns: 2 });
  const results = await orch.runOneEach({ room_id: room.room_id, first_speaker: 'yanqiu' });
  assert.equal(results.length, 2);
  assert.deepEqual(results.map((r) => r.speaker), ['yanqiu', 'codex']);
  assert.ok(results.every((r) => r.status === 'replied'));
  const after = orch.getRoom(room.room_id);
  assert.equal(after.status, 'paused');
  assert.equal(after.auto_turns_used, 2);
  // 第3棒(自动)必被预算挡下 → 不会自启动
  const extra = orch.postLisaMessage(room.room_id, 'x');
  const r3 = await orch.dispatch({ room_id: room.room_id, target: 'yanqiu', message_id: extra.message_id, automatic: true });
  assert.equal(r3.status, 'refused');
  assert.equal(r3.reason, 'auto_turns_exhausted');
});

test('3) 预算用尽自动禁用：max_auto_turns=1，第2个自动棒拒绝，手动仍可发', async () => {
  const { orch, room } = build({ max_auto_turns: 1 });
  const m1 = orch.postLisaMessage(room.room_id, 'a');
  const r1 = await orch.dispatch({ room_id: room.room_id, target: 'yanqiu', message_id: m1.message_id, automatic: true });
  assert.equal(r1.status, 'replied');
  const m2 = orch.postLisaMessage(room.room_id, 'b');
  const r2 = await orch.dispatch({ room_id: room.room_id, target: 'codex', message_id: m2.message_id, automatic: true });
  assert.equal(r2.status, 'refused');
  assert.equal(r2.reason, 'auto_turns_exhausted');
  // 手动主持不受 auto 上限约束(§9)
  const m3 = orch.postLisaMessage(room.room_id, 'c');
  const r3 = await orch.dispatch({ room_id: room.room_id, target: 'codex', message_id: m3.message_id, automatic: false });
  assert.equal(r3.status, 'replied');
});

test('4) 暂停后不启动下一棒：baton A 后 pause，baton B 不投递', async () => {
  const { orch, room, cc, codex } = build({ max_auto_turns: 2 });
  // A 棒结束后 Lisa 立即暂停 → B 棒必须被取消
  orch.hooks.afterBaton = async ({ index }) => { if (index === 0) orch.pause(room.room_id); };
  const results = await orch.runOneEach({ room_id: room.room_id, first_speaker: 'yanqiu' });
  assert.equal(results.length, 1);                 // 只跑了 A
  assert.equal(results[0].speaker, 'yanqiu');
  assert.equal(cc.totalDelivers(), 1);
  assert.equal(codex.totalDelivers(), 0);          // B(codex) 一次没投
  const after = orch.getRoom(room.room_id);
  assert.equal(after.status, 'paused');
  assert.equal(after.pause_requested, 1);
});

test('5) 运行中重启：未回复的 in-flight → needs_attention，不擅自重发', async () => {
  const db = openDb(':memory:');
  const cc = new FakeAdapter('cc'); const codex = new FakeAdapter('codex');
  const orch1 = new Orchestrator({ db, cc, codex, clock: fakeClock(), pollInterval: 500 });
  const room = orch1.createRoom({});
  const src = orch1.postLisaMessage(room.room_id, 'hi');
  const did = await orch1._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  assert.equal(cc.targetDeliverCount(src.message_id, 'yanqiu'), 1);
  cc.program(did, ['pending']);                    // 重启后对方仍未回复
  // 模拟进程重启：全新 orchestrator(锁清空)，同一 DB
  const orch2 = new Orchestrator({ db, cc, codex, clock: fakeClock(), pollInterval: 500 });
  const summary = await orch2.recover();
  assert.equal(summary.needs_attention, 1);
  assert.equal(summary.collected, 0);
  assert.equal(orch2.getDispatch(did).status, 'needs_attention');
  assert.equal(orch2.getRoom(room.room_id).status, 'needs_attention');
  assert.equal(cc.targetDeliverCount(src.message_id, 'yanqiu'), 1); // 关键：没有重发
});

test('6) 已有回复只补采集：重启时对方已回复 → 收集，不重发', async () => {
  const db = openDb(':memory:');
  const cc = new FakeAdapter('cc'); const codex = new FakeAdapter('codex');
  const orch1 = new Orchestrator({ db, cc, codex, clock: fakeClock(), pollInterval: 500 });
  const room = orch1.createRoom({});
  const src = orch1.postLisaMessage(room.room_id, 'hi');
  const did = await orch1._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  cc.seedReply(did, { content: '崩溃前已经回好的话', bubbles: 1, cursor_end: 'cur_seed' });
  const orch2 = new Orchestrator({ db, cc, codex, clock: fakeClock(), pollInterval: 500 });
  const summary = await orch2.recover();
  assert.equal(summary.collected, 1);
  assert.equal(summary.needs_attention, 0);
  assert.equal(orch2.getDispatch(did).status, 'replied');
  const msgs = orch2.listMessages(room.room_id).filter((m) => m.speaker === 'yanqiu');
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].content, '崩溃前已经回好的话');
  assert.equal(cc.targetDeliverCount(src.message_id, 'yanqiu'), 1); // 没有重发
  assert.equal(orch2.getRoom(room.room_id).status, 'paused');
});

test('7) 插队 → needs_attention，不猜绑', async () => {
  const { orch, room, cc } = build();
  const src = orch.postLisaMessage(room.room_id, 'hi');
  const did = await orch._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  cc.program(did, ['intrusion']);                  // 游标窗口混入真实用户插队
  const res = await orch._resolveReply(room.room_id, did, 'yanqiu', 60000);
  assert.equal(res.status, 'needs_attention');
  assert.equal(res.reason, 'intrusion');
  assert.equal(orch.getRoom(room.room_id).status, 'needs_attention');
  const bound = orch.listMessages(room.room_id).filter((m) => m.speaker === 'yanqiu');
  assert.equal(bound.length, 0);                   // 没有擅自绑定任何回复
});

// ---------- 附加：铁律 ----------
test('附) 单飞锁：in-flight 时再投递抛 LOCKED', async () => {
  const { orch, room } = build();
  const s1 = orch.postLisaMessage(room.room_id, 'a');
  await orch._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: s1.message_id });
  assert.equal(orch.getRoom(room.room_id).status, 'waiting_reply'); // 未闭合
  const s2 = orch.postLisaMessage(room.room_id, 'b');
  await assert.rejects(
    () => orch.dispatch({ room_id: room.room_id, target: 'codex', message_id: s2.message_id }),
    /LOCKED|in-flight/,
  );
});

test('附) 立即暂停：pause 后自动棒被拒', async () => {
  const { orch, room } = build();
  orch.pause(room.room_id);
  const r = orch.getRoom(room.room_id);
  assert.equal(r.status, 'paused');
  assert.equal(r.pause_requested, 1);
  const m = orch.postLisaMessage(room.room_id, 'x');
  const res = await orch.dispatch({ room_id: room.room_id, target: 'yanqiu', message_id: m.message_id, automatic: true });
  assert.equal(res.status, 'refused');
  assert.equal(res.reason, 'paused');
});

test('附) 超时不自动重投 → needs_attention(timeout)，可手动重试收回', async () => {
  const db = openDb(':memory:');
  const cc = new FakeAdapter('cc'); const codex = new FakeAdapter('codex');
  const clock = fakeClock();
  const orch = new Orchestrator({ db, cc, codex, clock, pollInterval: 500, defaultTimeoutMs: 1000 });
  const room = orch.createRoom({});
  const src = orch.postLisaMessage(room.room_id, 'hi');
  const did = await orch._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  cc.program(did, Array(100).fill('pending'));     // 一直不回 → 超时
  const res = await orch._resolveReply(room.room_id, did, 'yanqiu', 1000);
  assert.equal(res.status, 'needs_attention');
  assert.equal(orch.getDispatch(did).status, 'timeout');
  assert.equal(cc.targetDeliverCount(src.message_id, 'yanqiu'), 1); // 超时不自动重投
  // Lisa 手动重试：这次对方回了
  cc._script.delete(did);                          // 清脚本 → 默认 replied
  const retry = await orch.retry(did);
  assert.equal(retry.status, 'replied');
});

test('附) 真·落盘重启：关库重开后 recover 只补采集、不重发', async () => {
  const os = require('node:os'); const path = require('node:path'); const fs = require('node:fs');
  const file = path.join(os.tmpdir(), `lounge_test_${process.pid}_${Date.now()}.db`);
  try {
    const db1 = openDb(file);
    const cc = new FakeAdapter('cc'); const codex = new FakeAdapter('codex');
    const orch1 = new Orchestrator({ db: db1, cc, codex, clock: fakeClock(), pollInterval: 500 });
    const room = orch1.createRoom({});
    const src = orch1.postLisaMessage(room.room_id, 'hi');
    const did = await orch1._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
    db1.close();                                   // 进程"崩溃"

    const db2 = openDb(file);                       // 真·重开磁盘库
    cc.seedReply(did, { content: '落盘后仍能补采集', bubbles: 1, cursor_end: 'cur_disk' });
    const orch2 = new Orchestrator({ db: db2, cc, codex, clock: fakeClock(), pollInterval: 500 });
    const summary = await orch2.recover();
    assert.equal(summary.collected, 1);
    assert.equal(orch2.getDispatch(did).status, 'replied');
    assert.equal(cc.targetDeliverCount(src.message_id, 'yanqiu'), 1); // 没重发
    db2.close();
  } finally {
    for (const suf of ['', '-wal', '-shm']) { try { fs.unlinkSync(file + suf); } catch {} }
  }
});

test('附) budget 分级：warn>=70%、disabled>=90%', () => {
  const base = { max_auto_turns: 99, auto_turns_used: 0, daily_char_cap: 100 };
  assert.equal(budgetState({ ...base, chars_used_today: 50 }).level, 'ok');
  assert.equal(budgetState({ ...base, chars_used_today: 70 }).level, 'warn');
  assert.equal(budgetState({ ...base, chars_used_today: 90 }).level, 'disabled');
  // auto 用尽也 disabled
  assert.equal(budgetState({ max_auto_turns: 2, auto_turns_used: 2, daily_char_cap: 0, chars_used_today: 0 }).level, 'disabled');
});
