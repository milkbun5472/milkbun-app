'use strict';
// 三方会客厅 · Step 1 验收测试（node:test，零依赖，全 fake adapter）
// 覆盖 §12 第1步 + §13 必测 + 初审六条修补的新增用例。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../db');
const { Orchestrator, CrossRoomError } = require('../orchestrator');
const { FakeAdapter } = require('../adapters/fake');
const { fakeClock } = require('../clock');
const { budgetState } = require('../budget');

const DAY = 24 * 3600 * 1000;

function build({ hooks = {}, max_auto_turns = 2, daily_char_cap = 0, daily_call_cap = 0, clock } = {}) {
  const db = openDb(':memory:');
  const cc = new FakeAdapter('cc');
  const codex = new FakeAdapter('codex');
  const orch = new Orchestrator({ db, cc, codex, clock: clock || fakeClock(), hooks, pollInterval: 500, defaultTimeoutMs: 60000 });
  const room = orch.createRoom({ max_auto_turns, daily_char_cap, daily_call_cap });
  return { db, cc, codex, orch, room };
}

// ---------------- §13 必测 ----------------
test('1) 重复投递不重复：同(message_id,target)投3次，目标只收1次', async () => {
  const { cc, orch, room } = build();
  const src = orch.postLisaMessage(room.room_id, '宝宝你好');
  const r1 = await orch.dispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  const r2 = await orch.dispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  const r3 = await orch.dispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  assert.equal(r1.status, 'replied');
  assert.ok(r2.idempotent && r3.idempotent);
  assert.equal(cc.targetDeliverCount(src.message_id, 'yanqiu'), 1);
});

test('2) 双方各答一轮：严格2棒后强制暂停，算一次自动 run', async () => {
  const { orch, room } = build({ max_auto_turns: 2 });
  const lisa = orch.postLisaMessage(room.room_id, '你俩聊聊卡加的事');
  const out = await orch.runOneEach({ room_id: room.room_id, lisa_message_id: lisa.message_id, first_speaker: 'yanqiu' });
  assert.equal(out.results.length, 2);
  assert.deepEqual(out.results.map((r) => r.speaker), ['yanqiu', 'codex']);
  assert.ok(out.results.every((r) => r.status === 'replied'));
  const after = orch.getRoom(room.room_id);
  assert.equal(after.status, 'paused');
  assert.equal(after.auto_turns_used, 1);          // ⑤两棒=一次 run
  assert.equal(after.calls_today, 2);              // 两次外呼
});

test('3) 预算用尽自动禁用：max_auto_turns=1，第2个 run 拒绝，手动仍可发', async () => {
  const { orch, room } = build({ max_auto_turns: 1 });
  const l1 = orch.postLisaMessage(room.room_id, 'a');
  const r1 = await orch.runOneEach({ room_id: room.room_id, lisa_message_id: l1.message_id });
  assert.equal(r1.results.length, 2);
  const l2 = orch.postLisaMessage(room.room_id, 'b');
  const r2 = await orch.runOneEach({ room_id: room.room_id, lisa_message_id: l2.message_id });
  assert.ok(r2.refused);
  assert.equal(r2.reason, 'auto_turns_exhausted');
  // 手动主持不受 auto 上限约束(§9)
  const l3 = orch.postLisaMessage(room.room_id, 'c');
  const r3 = await orch.dispatch({ room_id: room.room_id, target: 'codex', message_id: l3.message_id, automatic: false });
  assert.equal(r3.status, 'replied');
});

test('4) 暂停后不启动下一棒：baton A 后 pause，baton B 不投递', async () => {
  const { orch, room, cc, codex } = build({ max_auto_turns: 2 });
  orch.hooks.afterBaton = async ({ index }) => { if (index === 0) orch.pause(room.room_id); };
  const lisa = orch.postLisaMessage(room.room_id, '开聊');
  const out = await orch.runOneEach({ room_id: room.room_id, lisa_message_id: lisa.message_id, first_speaker: 'yanqiu' });
  assert.equal(out.results.length, 1);
  assert.equal(cc.totalDelivers(), 1);
  assert.equal(codex.totalDelivers(), 0);          // B(codex) 一次没投
  const after = orch.getRoom(room.room_id);
  assert.equal(after.status, 'paused');
  assert.equal(after.pause_requested, 1);
});

test('5) 运行中重启：未回复 in-flight → needs_attention，不重发', async () => {
  const db = openDb(':memory:');
  const cc = new FakeAdapter('cc'); const codex = new FakeAdapter('codex');
  const orch1 = new Orchestrator({ db, cc, codex, clock: fakeClock(), pollInterval: 500 });
  const room = orch1.createRoom({});
  const src = orch1.postLisaMessage(room.room_id, 'hi');
  const b = await orch1._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  assert.equal(cc.targetDeliverCount(src.message_id, 'yanqiu'), 1);
  cc.program(b.dispatch_id, ['pending']);
  const orch2 = new Orchestrator({ db, cc, codex, clock: fakeClock(), pollInterval: 500 });
  const summary = await orch2.recover();
  assert.equal(summary.needs_attention, 1);
  assert.equal(summary.collected, 0);
  assert.equal(orch2.getDispatch(b.dispatch_id).status, 'needs_attention');
  assert.equal(cc.targetDeliverCount(src.message_id, 'yanqiu'), 1);
});

test('6) 已有回复只补采集：重启时对方已回复 → 收集，不重发', async () => {
  const db = openDb(':memory:');
  const cc = new FakeAdapter('cc'); const codex = new FakeAdapter('codex');
  const orch1 = new Orchestrator({ db, cc, codex, clock: fakeClock(), pollInterval: 500 });
  const room = orch1.createRoom({});
  const src = orch1.postLisaMessage(room.room_id, 'hi');
  const b = await orch1._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  cc.seedReply(b.dispatch_id, { content: '崩溃前已经回好的话', bubbles: 1, cursor_end: 'cur_seed' });
  const orch2 = new Orchestrator({ db, cc, codex, clock: fakeClock(), pollInterval: 500 });
  const summary = await orch2.recover();
  assert.equal(summary.collected, 1);
  assert.equal(orch2.getDispatch(b.dispatch_id).status, 'replied');
  const msgs = orch2.listMessages(room.room_id).filter((m) => m.speaker === 'yanqiu');
  assert.equal(msgs.length, 1);
  assert.equal(cc.targetDeliverCount(src.message_id, 'yanqiu'), 1);
});

test('7) 插队 → needs_attention，不猜绑', async () => {
  const { orch, room, cc } = build();
  const src = orch.postLisaMessage(room.room_id, 'hi');
  const b = await orch._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  cc.program(b.dispatch_id, ['intrusion']);
  const res = await orch._resolveReply(room.room_id, b.dispatch_id, 'yanqiu', 60000);
  assert.equal(res.status, 'needs_attention');
  assert.equal(res.reason, 'intrusion');
  assert.equal(orch.listMessages(room.room_id).filter((m) => m.speaker === 'yanqiu').length, 0);
});

// ---------------- 初审六条修补 ----------------
test('①) 等待回复时 pause → 手动再投必须 LOCKED（锁真相=未闭合dispatch）', async () => {
  const { orch, room } = build();
  const s1 = orch.postLisaMessage(room.room_id, 'a');
  await orch._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: s1.message_id }); // 未闭合
  orch.pause(room.room_id);                          // room.status 变 paused，但投递仍未闭合
  assert.equal(orch.getRoom(room.room_id).status, 'paused');
  const s2 = orch.postLisaMessage(room.room_id, 'b');
  await assert.rejects(
    () => orch.dispatch({ room_id: room.room_id, target: 'codex', message_id: s2.message_id }),
    /LOCKED|unclosed/,
  );
});

test('②) 外呼失败=unknown：预算已扣不自动退款、recover 不自动重投', async () => {
  const { orch, room, cc } = build();
  const src = orch.postLisaMessage(room.room_id, 'hi');
  cc.setHealth({ online: false });                  // 外呼抛错(未知是否落地)
  const b = await orch._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  assert.ok(b.failed);
  const room1 = orch.getRoom(room.room_id);
  assert.equal(room1.calls_today, 1);               // 预算已预留，未退款
  assert.equal(orch.getDispatch(b.dispatch_id).status, 'failed');
  assert.equal(cc.totalDelivers(), 0);              // 确实没送达
  // failed 不在未闭合集合里 → recover 不碰它、更不重投
  const summary = await orch.recover();
  assert.equal(summary.checked, 0);
  assert.equal(cc.totalDelivers(), 0);
});

test('③) 重复绑定不重复扣费：bind 两次，用量只记一次', async () => {
  const { orch, room, cc } = build();
  const src = orch.postLisaMessage(room.room_id, 'hi');
  const b = await orch._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  const reply = { content: '一段12345', bubbles: 1, cursor_end: 'cur_dup' };
  const r1 = orch._bindReply(room.room_id, b.dispatch_id, 'yanqiu', reply);
  const r2 = orch._bindReply(room.room_id, b.dispatch_id, 'yanqiu', reply); // 二次绑定
  assert.equal(r1.status, 'replied');
  assert.ok(r2.idempotent);
  const room2 = orch.getRoom(room.room_id);
  assert.equal(room2.usage_today, reply.content.length);   // 只扣一次
  assert.equal(orch.listMessages(room.room_id).filter((m) => m.speaker === 'yanqiu').length, 1);
});

test('④) runOneEach 真实正文：A=Lisa原话，B=Lisa原话+A可见回复，无机器元数据', async () => {
  const { orch, room, cc, codex } = build({ max_auto_turns: 2 });
  const lisaText = '你俩说说搬去卡加的分工';
  const lisa = orch.postLisaMessage(room.room_id, lisaText);
  await orch.runOneEach({ room_id: room.room_id, lisa_message_id: lisa.message_id, first_speaker: 'yanqiu' });
  const toA = cc.delivered[0];       // 发给 yanqiu(A)
  const toB = codex.delivered[0];    // 发给 codex(B)
  const aReplyMsg = orch.listMessages(room.room_id).find((m) => m.speaker === 'yanqiu');
  // 精确等值：A=Lisa原话；B=Lisa原话+A可见回复。等值即证明 orchestrator 没有向正文注入任何机器元数据
  assert.equal(toA.content, lisaText);
  assert.equal(toB.content, `${lisaText}\n\n${aReplyMsg.content}`);
  // 元数据只在信封字段(out-of-band)，不在正文里
  assert.ok(toA.dispatch_id && toB.dispatch_id);
  assert.ok(!toA.content.includes(toA.dispatch_id) && !toB.content.includes(toB.dispatch_id));
  assert.ok(!/dispatch_|round_|run_/.test(toA.content) && !/dispatch_|round_|run_/.test(toB.content));
});

test('⑤) 跨日预算：达上限禁用；跨到次日重置并重新可用', async () => {
  const clock = fakeClock();
  const { orch, room } = build({ max_auto_turns: 99, daily_call_cap: 1, clock });
  // 第一次自动 run 用掉当日调用配额(cap=1, 2棒会在第2棒触达上限)
  const l1 = orch.postLisaMessage(room.room_id, 'day1');
  await orch.runOneEach({ room_id: room.room_id, lisa_message_id: l1.message_id });
  assert.equal(budgetState(orch.getRoom(room.room_id)).level, 'disabled'); // 当日已禁自动
  const l2 = orch.postLisaMessage(room.room_id, 'day1-again');
  const blocked = await orch.runOneEach({ room_id: room.room_id, lisa_message_id: l2.message_id });
  assert.ok(blocked.refused);
  assert.equal(blocked.reason, 'daily_cap');
  // 跨到次日
  clock.advance(DAY);
  const l3 = orch.postLisaMessage(room.room_id, 'day2');
  const ok = await orch.runOneEach({ room_id: room.room_id, lisa_message_id: l3.message_id });
  assert.equal(ok.results.length, 2);                         // 次日重置后重新可用
  const r = orch.getRoom(room.room_id);
  assert.equal(r.budget_day, new Date(clock.now()).toISOString().slice(0, 10));
});

test('⑥) 跨房间消息拒绝', async () => {
  const { orch } = build();
  const roomA = orch.createRoom({});
  const roomB = orch.createRoom({});
  const msgB = orch.postLisaMessage(roomB.room_id, 'B 的消息');
  await assert.rejects(
    () => orch.dispatch({ room_id: roomA.room_id, target: 'yanqiu', message_id: msgB.message_id }),
    (e) => e instanceof CrossRoomError,
  );
});

// ---------------- 附加铁律 ----------------
test('附) 单飞锁：in-flight 时再投递抛 LOCKED', async () => {
  const { orch, room } = build();
  const s1 = orch.postLisaMessage(room.room_id, 'a');
  await orch._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: s1.message_id });
  const s2 = orch.postLisaMessage(room.room_id, 'b');
  await assert.rejects(() => orch.dispatch({ room_id: room.room_id, target: 'codex', message_id: s2.message_id }), /LOCKED|unclosed/);
});

test('附) 立即暂停：pause 后自动棒被拒', async () => {
  const { orch, room } = build();
  orch.pause(room.room_id);
  const m = orch.postLisaMessage(room.room_id, 'x');
  const res = await orch.dispatch({ room_id: room.room_id, target: 'yanqiu', message_id: m.message_id, automatic: true });
  assert.equal(res.status, 'refused');
  assert.equal(res.reason, 'paused');
});

test('附) 超时不自动重投 → timeout；手动重试可收回', async () => {
  const db = openDb(':memory:');
  const cc = new FakeAdapter('cc'); const codex = new FakeAdapter('codex');
  const orch = new Orchestrator({ db, cc, codex, clock: fakeClock(), pollInterval: 500, defaultTimeoutMs: 1000 });
  const room = orch.createRoom({});
  const src = orch.postLisaMessage(room.room_id, 'hi');
  const b = await orch._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
  cc.program(b.dispatch_id, Array(100).fill('pending'));
  const res = await orch._resolveReply(room.room_id, b.dispatch_id, 'yanqiu', 1000);
  assert.equal(res.status, 'needs_attention');
  assert.equal(orch.getDispatch(b.dispatch_id).status, 'timeout');
  assert.equal(cc.targetDeliverCount(src.message_id, 'yanqiu'), 1);
  cc._script.delete(b.dispatch_id);
  const retry = await orch.retry(b.dispatch_id);
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
    const b = await orch1._beginDispatch({ room_id: room.room_id, target: 'yanqiu', message_id: src.message_id });
    db1.close();
    const db2 = openDb(file);
    cc.seedReply(b.dispatch_id, { content: '落盘后仍能补采集', bubbles: 1, cursor_end: 'cur_disk' });
    const orch2 = new Orchestrator({ db: db2, cc, codex, clock: fakeClock(), pollInterval: 500 });
    const summary = await orch2.recover();
    assert.equal(summary.collected, 1);
    assert.equal(orch2.getDispatch(b.dispatch_id).status, 'replied');
    assert.equal(cc.targetDeliverCount(src.message_id, 'yanqiu'), 1);
    db2.close();
  } finally {
    for (const suf of ['', '-wal', '-shm']) { try { fs.unlinkSync(file + suf); } catch {} }
  }
});

test('附) budget 分级：warn>=70%、disabled>=90%（call/char 取高）', () => {
  const base = { max_auto_turns: 99, auto_turns_used: 0, daily_char_cap: 100, daily_call_cap: 0, usage_today: 0, calls_today: 0 };
  assert.equal(budgetState({ ...base, usage_today: 50 }).level, 'ok');
  assert.equal(budgetState({ ...base, usage_today: 70 }).level, 'warn');
  assert.equal(budgetState({ ...base, usage_today: 90 }).level, 'disabled');
  assert.equal(budgetState({ ...base, daily_call_cap: 10, calls_today: 9 }).level, 'disabled'); // call 维度也算
  assert.equal(budgetState({ max_auto_turns: 1, auto_turns_used: 1, daily_char_cap: 0, daily_call_cap: 0, usage_today: 0, calls_today: 0 }).level, 'disabled');
});
