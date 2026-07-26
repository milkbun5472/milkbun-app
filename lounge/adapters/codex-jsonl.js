'use strict';
// Codex CLI `exec resume --json` 的可见正文闸。
// 只认当前进程 stdout 中的 agent_message + turn.completed；thinking/tool/commentary 不进正文。

function parseLine(line) { try { return JSON.parse(line); } catch { return null; } }

function readJsonl(text) {
  const events = [];
  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) continue;
    const event = parseLine(line);
    if (event) events.push(event);
  }
  return events;
}

function eventThreadId(e) {
  return e.thread_id || (e.thread && e.thread.id) || (e.data && e.data.thread_id) || null;
}

function eventTurnId(e) {
  return e.turn_id || (e.turn && e.turn.id) || (e.data && e.data.turn_id) || null;
}

function itemText(e) {
  const item = e.item || (e.data && e.data.item) || {};
  if (item.type !== 'agent_message') return null;
  const text = item.text ?? item.content ?? item.message;
  return typeof text === 'string' && text.trim() ? text.trim() : null;
}

function classifyCodexJsonl(text, expectedThreadId) {
  const events = readJsonl(text);
  let seenThread = null;
  let turnId = null;
  let completed = false;
  let failed = false;
  let processExit = null;
  let usage = null;
  const visible = [];

  for (const e of events) {
    if (e.type === 'thread.started') seenThread = eventThreadId(e);
    if (e.type === 'turn.started') turnId = eventTurnId(e) || turnId;
    if (e.type === 'item.completed') {
      const t = itemText(e);
      if (t) visible.push(t);
    }
    if (e.type === 'turn.completed') {
      completed = true;
      turnId = eventTurnId(e) || turnId;
      usage = e.usage || (e.turn && e.turn.usage) || (e.data && e.data.usage) || null;
    }
    if (e.type === 'turn.failed' || e.type === 'error') failed = true;
    if (e.type === 'process.exited') processExit = e;
  }

  if (seenThread && expectedThreadId && seenThread !== expectedThreadId) {
    return { state: 'intrusion', reason: 'thread_mismatch' };
  }
  // CLI 会在流重连时先写 error，但随后仍可能成功吐出最终正文并正常完成。
  // 一旦同一 spool 已有 turn.completed，就以最终封包为准；中途网络告警只作诊断，
  // 不能盖掉已经完成的可见回复。
  if (!completed && failed) return { state: 'error', reason: 'turn_failed' };
  if (!completed && processExit && processExit.exit_code !== 0) return { state: 'error', reason: 'process_failed' };
  if (processExit && !completed) return { state: 'error', reason: 'process_exited_without_completion' };
  if (!completed) return { state: 'pending' };
  if (!visible.length) return { state: 'empty' };

  // CLI 的单次 stdout 是天然 dispatch 边界；最终 agent_message 为会客厅可见回复。
  const content = visible[visible.length - 1];
  return {
    state: 'replied',
    reply: {
      content,
      bubbles: 1,
      cursor_end: `codex@${turnId || 'completed'}`,
      usage,
    },
  };
}

module.exports = { parseLine, readJsonl, classifyCodexJsonl, itemText };
