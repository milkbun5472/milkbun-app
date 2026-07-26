'use strict';

// 把会客厅自然正文投进言秋现有 Stack-chan 耐久唤醒信箱。
// wake_queue.py 已经监听 voice_inbox.jsonl；无需新建 CC 会话，也不多跑一层 relay 模型。
// 文件只保存本机、0600、append-only。dispatch/room 等机器 ID 不写进正文记录。
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_WAKE_INBOX = '/Users/lisa/Desktop/lisa-practice/yanqiu-den/stackchan-relay/voice_inbox.jsonl';

function appendJsonl(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND, 0o600);
  try { fs.writeSync(fd, `${JSON.stringify(value)}\n`, null, 'utf8'); }
  finally { fs.closeSync(fd); }
}

function createWakeQueueSender({ inboxPath = process.env.YANQIU_WAKE_INBOX || DEFAULT_WAKE_INBOX, now = () => Date.now() } = {}) {
  return async function wakeQueueSender(_sessionId, text) {
    const natural = typeof text === 'string' ? text.trim() : '';
    if (!natural) throw Object.assign(new Error('会客厅正文为空'), { code: 'EMPTY_MESSAGE' });
    appendJsonl(inboxPath, {
      kind: 'lounge',
      source: 'three_party_lounge',
      text: natural,
      received_at_ms: now(),
    });
    return { accepted: true };
  };
}

function getWakeQueueHealth({ inboxPath = process.env.YANQIU_WAKE_INBOX || DEFAULT_WAKE_INBOX } = {}) {
  try {
    const dir = path.dirname(inboxPath);
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
    return { online: true, running: false, transport: 'durable_wake_queue' };
  } catch (error) {
    return { online: false, running: false, transport: 'durable_wake_queue', error: error.code || 'wake_inbox_unavailable' };
  }
}

module.exports = { createWakeQueueSender, getWakeQueueHealth, appendJsonl, DEFAULT_WAKE_INBOX };
