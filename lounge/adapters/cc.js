'use strict';
// 三方会客厅 · 真实 CC Adapter（Step 2）
// 实现 orchestrator 的 deliver/poll/getHealth 契约，接现有言秋 CC 老会话。
// 红线：本模块【绝不】直接调用 send_message —— 外呼口 `sender` 依赖注入。
//   · 离线测试注入 spy sender（不投递）+ fixture transcript（不碰真会话）。
//   · 真实活测时才由 CC 会话侧把 sender=send_message 接上（活测前必须问 Lisa）。
// 投递 = 记录投前字节游标 + 调 sender 唤醒；收回复 = 从投前游标重扫 transcript 过可见闸。
const fs = require('node:fs');
const { realClock } = require('../clock');
const { resolvePointer } = require('./cc-sessions');
const { readNewEvents, classify } = require('./cc-transcript');

class CCAdapter {
  constructor({ sender, resolve, readNew, clock = realClock(), silenceMs = 1500, projectDir, appSupportDir } = {}) {
    if (typeof sender !== 'function') throw new Error('CCAdapter 需要注入 sender(sessionId, text) —— 本模块不直接调用 send_message');
    this.name = 'cc';
    this.sender = sender;
    this.resolve = resolve || ((id) => resolvePointer(id, { projectDir, appSupportDir }));
    this.readNew = readNew || readNewEvents;
    this.clock = clock;
    this.silenceMs = silenceMs;
    this._st = new Map();   // dispatch_id -> { sessionId, transcriptPath, cursor(投前字节), ourText, deliveredAt }
  }

  // deliver：定位会话 → 记投前游标 → 调 sender 唤醒。sender 抛错则整体抛出(orchestrator 记 failed，不退款不重投)
  async deliver(envelope) {
    const sessionId = envelope.cc_session_id;
    if (!sessionId) throw Object.assign(new Error('deliver 缺 cc_session_id'), { code: 'NO_SESSION' });
    const { transcriptPath } = this.resolve(sessionId);
    let cursor = 0;
    try { cursor = fs.statSync(transcriptPath).size; } catch { cursor = 0; }  // 会话尚无 transcript → 从 0
    this._st.set(envelope.dispatch_id, {
      sessionId, transcriptPath, cursor, ourText: envelope.content, deliveredAt: this.clock.now(),
    });
    await this.sender(sessionId, envelope.content);   // 唯一外呼；离线为 spy
    return { accepted: true, dispatch_id: envelope.dispatch_id };
  }

  // poll：从投前游标重扫(不推进游标，保证多气泡收齐/不丢尾)，过可见闸分类
  async poll(dispatch_id) {
    const st = this._st.get(dispatch_id);
    if (!st) return { state: 'pending' };            // 未知投递(如重启后内存态丢失) → 交 orchestrator 走 recover/needs_attention
    const { events } = this.readNew(st.transcriptPath, st.cursor);
    return classify(events, { ourText: st.ourText, nowMs: this.clock.now(), silenceMs: this.silenceMs });
  }

  // 健康：能定位并读到 transcript 即 online；running 无法从文件确知，恒 false（保守）
  async getHealth(ccSessionId) {
    try {
      const { transcriptPath, lastActivityAt, isArchived } = this.resolve(ccSessionId);
      const online = fs.existsSync(transcriptPath);
      return { online, running: false, lastActivityAt, isArchived };
    } catch (e) {
      return { online: false, running: false, error: (e && e.message) || String(e) };
    }
  }

  // 供重启后重建投递态（可选）：把 dispatch 的投前游标重新登记，便于继续 poll
  rehydrate(dispatch_id, { sessionId, transcriptPath, cursor, ourText }) {
    this._st.set(dispatch_id, { sessionId, transcriptPath, cursor, ourText, deliveredAt: this.clock.now() });
  }
}

module.exports = { CCAdapter };
