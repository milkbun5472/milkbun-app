'use strict';
// 三方会客厅 · 真实 CC Adapter（Step 2，含可恢复投递态）
// 实现 orchestrator 的 deliver/poll/getHealth 契约，接现有言秋 CC 老会话。
// 红线：本模块【绝不】直接调用 send_message —— 外呼口 `sender` 依赖注入。
//   · 离线测试注入 spy sender（不投递）+ fixture transcript（不碰真会话）。
//   · 真实活测时才由 CC 会话侧把 sender=send_message 接上（活测前必须问 Lisa）。
// 缺口修补：
//   ① 分类精确匹配"跨会话 + 本次自然正文"（见 cc-transcript.classify）。
//   ② 外呼前先 prepare(解析会话+投前 byte 游标) 并持久化到 DB(cc_dispatch_state)，
//      重启后从 DB 重建 adapter 态、只读 transcript，绝不重投。
const fs = require('node:fs');
const { realClock } = require('../clock');
const { resolvePointer } = require('./cc-sessions');
const { readNewEvents, classify } = require('./cc-transcript');

class CCAdapter {
  constructor({ sender, resolve, readNew, clock = realClock(), silenceMs = 1500, projectDir, appSupportDir, db } = {}) {
    if (typeof sender !== 'function') throw new Error('CCAdapter 需要注入 sender(sessionId, text) —— 本模块不直接调用 send_message');
    this.name = 'cc';
    this.sender = sender;
    this.resolve = resolve || ((id) => resolvePointer(id, { projectDir, appSupportDir }));
    this.readNew = readNew || readNewEvents;
    this.clock = clock;
    this.silenceMs = silenceMs;
    this.db = db || null;                 // 提供则持久化可恢复态；不提供则仅内存(纯单元测试)
    this._st = new Map();                 // dispatch_id -> { sessionId, transcriptPath, cursor, ourText, deliveredAt }
  }

  _iso() { return new Date(this.clock.now()).toISOString(); }

  // 外呼前 prepare：解析会话 + transcript 路径 + 投前字节游标
  _prepare(sessionId) {
    const { transcriptPath } = this.resolve(sessionId);
    let cursor = 0;
    try { cursor = fs.statSync(transcriptPath).size; } catch { cursor = 0; }  // 尚无 transcript → 从 0
    return { transcriptPath, cursor };
  }

  _persist(state) {
    if (!this.db) return;
    this.db.prepare(`INSERT OR REPLACE INTO cc_dispatch_state
      (dispatch_id,session_id,transcript_path,after_byte,our_text,created_at) VALUES(?,?,?,?,?,?)`)
      .run(state.dispatch_id, state.sessionId, state.transcriptPath, state.cursor, state.ourText, this._iso());
  }

  // 取投递态：先内存，miss 则从 DB 重建(重启恢复关键路径)
  _load(dispatch_id) {
    if (this._st.has(dispatch_id)) return this._st.get(dispatch_id);
    if (!this.db) return null;
    const row = this.db.prepare('SELECT * FROM cc_dispatch_state WHERE dispatch_id=?').get(dispatch_id);
    if (!row) return null;
    const st = { dispatch_id, sessionId: row.session_id, transcriptPath: row.transcript_path, cursor: row.after_byte, ourText: row.our_text };
    this._st.set(dispatch_id, st);
    return st;
  }

  // deliver：prepare → 外呼前持久化可恢复态 → 才调 sender 唤醒。
  // sender 抛错整体抛出 → orchestrator 记 failed（不退款不重投）。
  async deliver(envelope) {
    const sessionId = envelope.cc_session_id;
    if (!sessionId) throw Object.assign(new Error('deliver 缺 cc_session_id'), { code: 'NO_SESSION' });
    const { transcriptPath, cursor } = this._prepare(sessionId);
    const state = { dispatch_id: envelope.dispatch_id, sessionId, transcriptPath, cursor, ourText: envelope.content, deliveredAt: this.clock.now() };
    this._persist(state);              // 先持久化(外呼前)——崩溃也能恢复
    this._st.set(envelope.dispatch_id, state);
    await this.sender(sessionId, envelope.content);   // 然后才外呼；离线为 spy
    return { accepted: true, dispatch_id: envelope.dispatch_id };
  }

  // poll：从投前游标重扫(不推进游标，保证多气泡收齐/不丢尾) → 过可见闸 → 精确匹配分类
  async poll(dispatch_id) {
    const st = this._load(dispatch_id);
    if (!st) return { state: 'pending' };            // 无态可依(既无内存又无 DB) → pending
    const { events } = this.readNew(st.transcriptPath, st.cursor);
    return classify(events, { ourText: st.ourText, nowMs: this.clock.now(), silenceMs: this.silenceMs });
  }

  async getHealth(ccSessionId) {
    try {
      const { transcriptPath, lastActivityAt, isArchived } = this.resolve(ccSessionId);
      return { online: fs.existsSync(transcriptPath), running: false, lastActivityAt, isArchived };
    } catch (e) {
      return { online: false, running: false, error: (e && e.message) || String(e) };
    }
  }
}

module.exports = { CCAdapter };
