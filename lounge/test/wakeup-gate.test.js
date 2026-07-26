'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const libPromise = import('../../scripts/cc-visible-gate-lib.mjs');
const user = (text) => ({ type: 'user', message: { content: text } });
const assistant = (...content) => ({ type: 'assistant', message: { content } });
const text = (value) => ({ type: 'text', text: value });
const think = () => ({ type: 'thinking', thinking: '准备说的话' });
const wake = () => ({ type: 'tool_use', name: 'ScheduleWakeup', input: {} });

test('闸：同一 assistant 消息含 text + ScheduleWakeup 时放行', async () => {
  const { inspectPreTool, inspectStop } = await libPromise;
  const records = [user('在吗'), assistant(text('宝宝，我在。'), wake())];
  assert.equal(inspectPreTool(records).visible, true);
  assert.equal(inspectStop(records).visible, true);
});

test('闸：thinking 看起来像正文也不放行，诊断为 thinking_only', async () => {
  const { inspectPreTool, inspectStop } = await libPromise;
  const records = [user('在吗'), assistant(think(), wake())];
  assert.deepEqual(inspectPreTool(records), { visible: false, reason: 'thinking_only' });
  assert.equal(inspectStop(records).reason, 'thinking_only');
});

test('闸：hook feedback 不是新的人类轮次边界', async () => {
  const { inspectStop } = await libPromise;
  const records = [
    user('在吗'),
    assistant(text('先说正文')),
    user('Stop hook feedback:\n系统提示'),
    assistant(wake()),
  ];
  assert.equal(inspectStop(records).visible, true);
});

test('闸：首次读取未落盘、短暂重读出现正文 → transcript_lag 放行', async () => {
  const { inspectPreTool, inspectWithRetry } = await libPromise;
  const file = path.join(os.tmpdir(), `wakeup_gate_${process.pid}_${crypto.randomUUID()}.jsonl`);
  fs.writeFileSync(file, `${JSON.stringify(user('在吗'))}\n`);
  try {
    setTimeout(() => {
      fs.appendFileSync(file, `${JSON.stringify(assistant(text('刚刚才刷进来的正文')))}\n`);
    }, 15);
    const result = await inspectWithRetry(file, inspectPreTool, { attempts: 4, delayMs: 20 });
    assert.equal(result.visible, true);
    assert.equal(result.lagRecovered, true);
    assert.ok(result.attempts >= 2);
  } finally {
    try { fs.unlinkSync(file); } catch {}
  }
});
