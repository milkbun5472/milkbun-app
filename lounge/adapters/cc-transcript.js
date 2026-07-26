'use strict';
// 三方会客厅 · CC transcript 读取与可见正文闸（Step 2）
// 把 probe-0 的读逻辑正式移植为 JS 纯函数：
//   append-only JSONL → 字节游标增量读 → 可见正文白名单 → promptId/连续assistant分包
//   → 分类为 replied / empty / intrusion / pending。
// 施工图 §6 可见正文闸 / §2bis 时序绑定不猜绑。绝不调用任何真实接口。
const fs = require('node:fs');

function parseLine(line) { try { return JSON.parse(line); } catch { return null; } }

// 从 cursor 字节读增量；newCursor 只推进到最后一条完整行(防丢半行)
function readNewEvents(path, cursor) {
  let size;
  try { size = fs.statSync(path).size; } catch { return { events: [], newCursor: cursor, size: 0, missing: true }; }
  if (size <= cursor) return { events: [], newCursor: cursor, size };
  const fd = fs.openSync(path, 'r');
  try {
    const buf = Buffer.alloc(size - cursor);
    fs.readSync(fd, buf, 0, buf.length, cursor);
    const text = buf.toString('utf8');
    const nl = text.lastIndexOf('\n');
    const newCursor = nl >= 0 ? cursor + Buffer.byteLength(text.slice(0, nl + 1), 'utf8') : cursor;
    const complete = nl >= 0 ? text.slice(0, nl) : '';
    const events = [];
    if (complete) for (const l of complete.split('\n')) { if (!l) continue; const o = parseLine(l); if (o) events.push(o); }
    return { events, newCursor, size };
  } finally { fs.closeSync(fd); }
}

// 归一化一行事件（提取可见 text、判定用户行性质）
function normalize(o) {
  const type = o.type;
  const msg = o.message || {};
  const content = msg.content;
  const n = { type, uuid: o.uuid, promptId: o.promptId, ts: o.timestamp, isSidechain: !!o.isSidechain };
  if (type === 'assistant') {
    const parts = Array.isArray(content) ? content : [];
    n.textParts = parts.filter((p) => p && p.type === 'text' && typeof p.text === 'string' && p.text.trim()).map((p) => p.text);
    n.hasThinking = parts.some((p) => p && p.type === 'thinking');
    n.hasTool = parts.some((p) => p && p.type === 'tool_use');
  } else if (type === 'user') {
    let isToolResult = false, cross = false, str = '';
    if (Array.isArray(content)) isToolResult = content.some((p) => p && p.type === 'tool_result');
    else if (typeof content === 'string') { str = content; cross = str.startsWith('<cross-session-message'); }
    n.isToolResult = isToolResult; n.isCrossSession = cross; n.userText = str;
    n.humanUser = type === 'user' && !isToolResult && !cross;   // 真实用户直接输入
  }
  return n;
}

function replied(bubbles) {
  return {
    state: 'replied',
    reply: {
      content: bubbles.map((b) => b.text).join('\n\n'),
      bubbles: bubbles.length,
      cursor_end: `cc@${bubbles[bubbles.length - 1].uuid}`,   // 稳定 id → 幂等绑定
    },
  };
}

// events: readNewEvents 的原始对象数组。ourText/ourCross 定位我们投递的那条 user 行。
// 返回 { state:'replied'|'empty'|'intrusion'|'pending', reply? }
function classify(rawEvents, { ourText = '', nowMs = null, silenceMs = 1500 } = {}) {
  const events = rawEvents.map(normalize);
  // 1) 定位我们投递的 user 行（cross-session 或含 ourText）；其后为响应区
  let start = -1;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'user' && (e.isCrossSession || (ourText && e.userText && e.userText.includes(ourText)))) { start = i; break; }
  }
  if (ourText && start < 0) return { state: 'pending' };        // 我们的消息还没落地
  const region = events.slice(start + 1);

  // 2) 扫响应区
  const bubbles = []; let hadAssistant = false, lastTs = null, closedByBoundary = false;
  for (const e of region) {
    if (e.type === 'assistant') {
      if (e.isSidechain) continue;                              // 子 agent 不算
      hadAssistant = true; if (e.ts) lastTs = e.ts;
      for (const t of e.textParts || []) bubbles.push({ uuid: e.uuid, text: t });
      continue;
    }
    if (e.type === 'user') {
      if (e.isToolResult) { if (e.ts) lastTs = e.ts; continue; } // 工具回执=助手工具环，非边界
      // 非工具回执的 user 行 = 轮次边界
      if (e.humanUser && !hadAssistant && bubbles.length === 0) return { state: 'intrusion' }; // 助手还没答就被真人插队
      closedByBoundary = true; break;                           // 我们这轮到此为止
    }
    // 其它类型(system/attachment/...)忽略
  }
  // 3) 静默窗口 or 边界 → 判定收 turn
  const silent = nowMs != null && lastTs != null && (nowMs - Date.parse(lastTs) >= silenceMs);
  const closed = closedByBoundary || silent;
  if (bubbles.length > 0 && closed) return replied(bubbles);
  if (bubbles.length > 0) return { state: 'pending' };          // 还在冒泡，未静默未到边界
  if (hadAssistant && closed) return { state: 'empty' };        // 只有 thinking/工具，无可见正文(§6)
  return { state: 'pending' };
}

module.exports = { readNewEvents, normalize, classify, parseLine };
