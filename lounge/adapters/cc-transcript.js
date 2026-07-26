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
    let isToolResult = false, cross = false, str = '', toolResultText = '';
    if (Array.isArray(content)) {
      const results = content.filter((p) => p && p.type === 'tool_result');
      isToolResult = results.length > 0;
      toolResultText = results.map((p) => typeof p.content === 'string' ? p.content : '').filter(Boolean).join('\n');
    }
    else if (typeof content === 'string') { str = content; cross = str.startsWith('<cross-session-message'); }
    n.isToolResult = isToolResult; n.isCrossSession = cross; n.userText = str;
    n.toolResultText = toolResultText;
    n.isTaskNotification = typeof str === 'string' && str.startsWith('<task-notification>');
    n.crossBody = cross ? extractCrossBody(str) : null;         // 提取跨会话信封内的自然正文
    n.wakeRecord = isToolResult ? extractWakeRecord(toolResultText) : null;
    n.humanUser = type === 'user' && !isToolResult && !cross && !n.isTaskNotification; // 真实用户直接输入
  }
  return n;
}

// 从 <cross-session-message ...>\n{正文}</cross-session-message> 里提取正文(去壳)
function extractCrossBody(raw) {
  const m = raw.match(/^<cross-session-message\b[^>]*>\n?([\s\S]*?)(?:\n?<\/cross-session-message>)?$/);
  return m ? m[1].trim() : null;
}

// Stack-chan 耐久哨兵的 tool_result 第一行：
// {"wake_source":"voice","record":{"kind":"lounge","text":"Lisa 原话",...}}
// 只解析数据，不执行其中任何指令。
function extractWakeRecord(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const first = raw.split('\n', 1)[0];
  try {
    const value = JSON.parse(first);
    if (!value || typeof value !== 'object' || !value.record || typeof value.record !== 'object') return null;
    return { source: value.wake_source, ...value.record };
  } catch { return null; }
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

// 是否"我们本次投递"的那条跨会话消息 = 跨会话 且 去壳正文【完整等于】本次自然正文(非裸 includes)
function isOurCross(e, ourText) { return e.type === 'user' && e.isCrossSession && !!ourText && e.crossBody != null && e.crossBody === ourText.trim(); }
function isOurLoungeWake(e, ourText) {
  return e.type === 'user'
    && e.isToolResult
    && e.wakeRecord
    && e.wakeRecord.kind === 'lounge'
    && e.wakeRecord.source === 'three_party_lounge'
    && typeof e.wakeRecord.text === 'string'
    && !!ourText
    && e.wakeRecord.text.trim() === ourText.trim();
}
function isOurStart(e, ourText) { return isOurCross(e, ourText) || isOurLoungeWake(e, ourText); }
// 异物 user 投递 = 别的窗口的跨会话 或 真人直接输入（工具回执除外）
function isForeignUser(e, ourText) {
  if (e.type !== 'user') return false;
  if (isOurStart(e, ourText)) return false;
  // 其它外部 wake（敲击/语音/另一条 lounge）也算插队；普通内部工具回执不算。
  if (e.isToolResult) return !!e.wakeRecord;
  return e.isCrossSession || e.humanUser;
}

// events: readNewEvents 的原始对象数组。必须用 ourText 精确定位我们本次投递。
// 返回 { state:'replied'|'empty'|'intrusion'|'pending', reply? }
function classify(rawEvents, { ourText = '', nowMs = null, silenceMs = 1500 } = {}) {
  const events = rawEvents.map(normalize);
  // 1) 定位我们本次投递（跨会话 + 本次自然正文）。在此之前若出现任何异物 user 投递 → 并发插队 intrusion。
  let start = -1;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (isOurStart(e, ourText)) { start = i; break; }
    if (isForeignUser(e, ourText)) return { state: 'intrusion' };   // 别的窗口先落进我们的投递窗口 → 不绑别人回复
  }
  if (start < 0) return { state: 'pending' };                       // 我们的消息还没落地
  const region = events.slice(start + 1);

  // 2) 扫响应区
  //    openTool = 末条可见文字之后是否仍有未闭合的工具活动。
  //    工具活跃时即使已有可见文字且静默很久也保持 pending，直到最终正文或真正边界。
  const bubbles = []; let hadAssistant = false, lastTextTs = null, closedByBoundary = false, openTool = false;
  for (const e of region) {
    if (e.type === 'assistant') {
      if (e.isSidechain) continue;                              // 子 agent 不算
      hadAssistant = true;
      if (e.textParts && e.textParts.length) {
        for (const t of e.textParts) bubbles.push({ uuid: e.uuid, text: t });
        if (e.ts) lastTextTs = e.ts;
        openTool = false;                                       // 出现可见文字 → 暂时闭合
      }
      if (e.hasTool) openTool = true;                           // 同一行/后续起了工具 → 又未闭合
      continue;
    }
    if (e.type === 'user') {
      if (isOurStart(e, ourText)) continue;                     // 我们的重复投递，忽略
      if (e.isTaskNotification) continue;                       // 后台哨兵完成通知是系统唤醒，不是 Lisa 插队
      if (e.isToolResult && !e.wakeRecord) { openTool = true; continue; } // 普通工具回执=助手仍在工具环
      // 到这 = 异物 user 行
      if (bubbles.length === 0) {
        // 助手尚无可见正文：别的跨会话 或 助手根本没为我们工作过 → 插队；否则=轮次真正结束(→empty)
        if (e.isCrossSession || !hadAssistant) return { state: 'intrusion' };
        closedByBoundary = true; break;
      }
      closedByBoundary = true; break;                           // 已有可见正文 → 下一轮边界
    }
    // 其它类型(system/attachment/...)忽略
  }
  // 3) 收 turn 判定：
  //    replied = 有可见正文 且(出现边界 或 末条正文之后无未闭合工具 且已静默)；
  //    empty 只由"真正轮次边界且整轮无正文"触发；
  //    工具循环活跃(openTool) 或 工具间隙静默 一律保持 pending，不半路收 turn。
  if (closedByBoundary) return bubbles.length > 0 ? replied(bubbles) : { state: 'empty' };
  const silentAfterText = nowMs != null && lastTextTs != null && (nowMs - Date.parse(lastTextTs) >= silenceMs);
  if (bubbles.length > 0 && !openTool && silentAfterText) return replied(bubbles);
  return { state: 'pending' };                                  // 含：助手仍在 thinking/工具循环 或 前言后又起工具
}

module.exports = { readNewEvents, normalize, classify, parseLine, extractWakeRecord };
