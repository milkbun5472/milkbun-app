'use strict';
// 三方会客厅 · Orchestrator 状态机（Step 1）
// 施工图 §5 轮次状态机 / §10 恢复规则 / §2bis 生产协议。
// 唯一写入者：顺序、单飞锁、幂等、超时、预算、重启恢复。Adapter 一律注入(Step1 用 fake)。
const crypto = require('node:crypto');
const { canDispatch, budgetState } = require('./budget');
const { SingleFlight, LockedError } = require('./lock');
const { realClock } = require('./clock');

const ROOM_STATUS = ['paused', 'dispatching', 'waiting_reply', 'needs_attention', 'stopped'];
const TARGETS = { yanqiu: 'cc', codex: 'codex' };
const INFLIGHT_DISPATCH = ['dispatching', 'delivered'];

class Orchestrator {
  constructor({ db, cc, codex, clock = realClock(), hooks = {}, pollInterval = 500, defaultTimeoutMs = 60000 }) {
    this.db = db;
    this.adapters = { cc, codex };
    this.clock = clock;
    this.hooks = hooks;
    this.pollInterval = pollInterval;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.lock = new SingleFlight();
    this.MAX_POLLS = 10000; // 防跑飞兜底；正常靠脚本/超时收敛
  }

  // ---------- 基础 ----------
  _uuid(p) { return `${p}_${crypto.randomUUID()}`; }
  _iso() { return new Date(this.clock.now()).toISOString(); }
  _adapter(target) {
    const k = TARGETS[target];
    if (!k || !this.adapters[k]) throw new Error(`no adapter for target ${target}`);
    return this.adapters[k];
  }

  getRoom(id) { return this.db.prepare('SELECT * FROM rooms WHERE room_id=?').get(id); }
  getDispatch(id) { return this.db.prepare('SELECT * FROM dispatches WHERE dispatch_id=?').get(id); }
  getMessage(id) { return this.db.prepare('SELECT * FROM messages WHERE message_id=?').get(id); }
  listMessages(roomId) { return this.db.prepare('SELECT * FROM messages WHERE room_id=? ORDER BY created_at').all(roomId); }
  _dispatchByMsgTarget(mid, target) {
    return this.db.prepare('SELECT * FROM dispatches WHERE message_id=? AND target=?').get(mid, target);
  }
  _setRoom(id, fields) {
    const keys = Object.keys(fields);
    const set = keys.map((k) => `${k}=?`).join(',');
    this.db.prepare(`UPDATE rooms SET ${set}, updated_at=? WHERE room_id=?`)
      .run(...keys.map((k) => fields[k]), this._iso(), id);
  }
  _attempt(dispatchId, target, outcome, detail = null) {
    this.db.prepare('INSERT INTO delivery_attempts(dispatch_id,target,outcome,detail,at) VALUES(?,?,?,?,?)')
      .run(dispatchId, target, outcome, detail, this._iso());
  }

  // ---------- Room ----------
  createRoom({ room_id, title = '三方会客厅', cc_session_id = null, codex_thread_id = null,
    mode = 'hosted', max_auto_turns = 2, daily_char_cap = 0 } = {}) {
    const id = room_id || this._uuid('lounge');
    const now = this._iso();
    this.db.prepare(`INSERT INTO rooms
      (room_id,title,cc_session_id,codex_thread_id,mode,status,next_speaker,
       max_auto_turns,auto_turns_used,daily_char_cap,chars_used_today,pause_requested,created_at,updated_at)
      VALUES(?,?,?,?,?, 'paused', NULL, ?,0,?,0,0,?,?)`)
      .run(id, title, cc_session_id, codex_thread_id, mode, max_auto_turns, daily_char_cap, now, now);
    return this.getRoom(id);
  }

  // ---------- Message ----------
  // 幂等落消息：命中 (room_id,origin,origin_message_id) 唯一键则返回既有
  _insertMessage({ room_id, speaker, content, origin, origin_message_id = null, reply_to = null, round_id = null, automatic = false }) {
    if (origin_message_id) {
      const ex = this.db.prepare('SELECT * FROM messages WHERE room_id=? AND origin=? AND origin_message_id=?')
        .get(room_id, origin, origin_message_id);
      if (ex) return ex;
    }
    const id = this._uuid('msg');
    this.db.prepare(`INSERT INTO messages
      (message_id,room_id,speaker,content,reply_to,origin,origin_message_id,round_id,automatic,character_count,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, room_id, speaker, content, reply_to, origin, origin_message_id, round_id,
        automatic ? 1 : 0, content.length, this._iso());
    return this.getMessage(id);
  }

  postLisaMessage(room_id, content, { reply_to = null, round_id = null } = {}) {
    return this._insertMessage({ room_id, speaker: 'lisa', content, origin: 'lounge', reply_to, round_id });
  }

  // ---------- 控制 ----------
  pause(room_id) {                          // 立即暂停(优先级①)：置闸 + 状态即刻 paused
    this._setRoom(room_id, { pause_requested: 1, status: 'paused' });
    return this.getRoom(room_id);
  }
  resume(room_id) { this._setRoom(room_id, { pause_requested: 0 }); return this.getRoom(room_id); }
  stop(room_id) { this._setRoom(room_id, { status: 'stopped', pause_requested: 1 }); return this.getRoom(room_id); }

  // ---------- 投递（两段：begin / resolve，便于重启恢复）----------
  async dispatch(opts) {
    const { room_id, target, message_id, automatic = false } = opts;
    const room = this.getRoom(room_id);
    if (!room) throw new Error(`no room ${room_id}`);

    // 幂等①：同 (message_id,target) 已有投递 → 直接返回既有，绝不二次投递(§1 红线⑤)
    const existing = this._dispatchByMsgTarget(message_id, target);
    if (existing) return { status: existing.status, dispatch_id: existing.dispatch_id, idempotent: true };

    // 预算/停止/暂停闸
    const gate = canDispatch(room, { automatic });
    if (!gate.ok) return { status: 'refused', reason: gate.reason };

    // 单飞锁：一房间同一时刻至多一个未闭合投递
    if (!this.lock.acquire(room_id, room.status)) throw new LockedError(room_id);
    try {
      const dispatch_id = await this._beginDispatch(opts, room);
      return await this._resolveReply(room_id, dispatch_id, target, opts.timeout_ms || this.defaultTimeoutMs);
    } finally {
      this.lock.release(room_id);
    }
  }

  // 投递到已送达为止（不含收回复）——供重启恢复测试模拟"送达后崩溃"
  async _beginDispatch(opts, room = null) {
    const { room_id, target, message_id, automatic = false, round_id = null } = opts;
    room = room || this.getRoom(room_id);
    if (!automatic) this._setRoom(room_id, { pause_requested: 0 }); // 手动主持=Lisa 主动，解暂停
    const src = this.getMessage(message_id);
    const dispatch_id = this._uuid('dispatch');
    const cursor = this.db.prepare('SELECT cursor FROM adapter_cursors WHERE room_id=? AND target=?').get(room_id, target);
    const after_cursor = (cursor && cursor.cursor) || `cur_before_${this.clock.now()}`;
    this.db.prepare(`INSERT INTO dispatches
      (dispatch_id,room_id,round_id,target,speaker,message_id,status,after_cursor,expects_reply,reply_limit,automatic,created_at)
      VALUES(?,?,?,?,?,?, 'dispatching', ?,1,1,?,?)`)
      .run(dispatch_id, room_id, round_id, target, src ? src.speaker : null, message_id,
        after_cursor, automatic ? 1 : 0, this._iso());
    this._setRoom(room_id, { status: 'dispatching' });

    const envelope = {
      dispatch_id, room_id, round_id, target,
      speaker: src ? src.speaker : null, message_id,
      content: src ? src.content : '', expects_reply: true, reply_limit: 1,
    };
    await this._adapter(target).deliver(envelope);
    this._attempt(dispatch_id, target, 'delivered');
    this.db.prepare('UPDATE dispatches SET status=?, delivered_at=? WHERE dispatch_id=?')
      .run('delivered', this._iso(), dispatch_id);
    this._setRoom(room_id, { status: 'waiting_reply' });
    if (automatic) this._setRoom(room_id, { auto_turns_used: room.auto_turns_used + 1 });
    return dispatch_id;
  }

  async _resolveReply(room_id, dispatch_id, target, timeout_ms) {
    const adapter = this._adapter(target);
    const d = this.getDispatch(dispatch_id);
    const deliveredAt = this.clock.now();
    for (let i = 0; i < this.MAX_POLLS; i++) {
      const room = this.getRoom(room_id);
      if (room.pause_requested) { this._setRoom(room_id, { status: 'paused' }); return { status: 'paused', dispatch_id }; }

      const p = await adapter.poll(dispatch_id);
      if (p.state === 'replied') return this._bindReply(room_id, dispatch_id, target, d, p.reply);
      if (p.state === 'empty') return this._needsAttention(room_id, dispatch_id, 'empty');       // §6 空回复不造假
      if (p.state === 'intrusion') return this._needsAttention(room_id, dispatch_id, 'intrusion'); // 真实用户插队→不猜绑
      if (this.clock.now() - deliveredAt > timeout_ms) return this._needsAttention(room_id, dispatch_id, 'timeout');
      await this.clock.sleep(this.pollInterval);
    }
    return this._needsAttention(room_id, dispatch_id, 'poll_exhausted');
  }

  _bindReply(room_id, dispatch_id, target, d, reply) {
    const origin = target === 'codex' ? 'codex' : 'cc';
    const msg = this._insertMessage({
      room_id, speaker: target, content: reply.content, origin,
      origin_message_id: reply.cursor_end, round_id: d.round_id,
    });
    this.db.prepare('UPDATE dispatches SET status=?, reply_message_id=?, resolved_at=? WHERE dispatch_id=?')
      .run('replied', msg.message_id, this._iso(), dispatch_id);
    const room = this.getRoom(room_id);
    this._setRoom(room_id, { chars_used_today: room.chars_used_today + reply.content.length, status: 'paused' });
    this.db.prepare('INSERT OR REPLACE INTO adapter_cursors(room_id,target,cursor,updated_at) VALUES(?,?,?,?)')
      .run(room_id, target, reply.cursor_end, this._iso());
    return { status: 'replied', dispatch_id, message_id: msg.message_id, reply };
  }

  _needsAttention(room_id, dispatch_id, reason) {
    this.db.prepare('UPDATE dispatches SET status=?, resolved_at=? WHERE dispatch_id=?')
      .run(reason === 'timeout' ? 'timeout' : 'needs_attention', this._iso(), dispatch_id);
    this._setRoom(room_id, { status: 'needs_attention' });
    this._attempt(dispatch_id, this.getDispatch(dispatch_id).target, 'stalled', reason);
    return { status: 'needs_attention', dispatch_id, reason };
  }

  // ---------- 双方各答一轮（§5.2）----------
  async runOneEach({ room_id, first_speaker = 'yanqiu', timeout_ms } = {}) {
    this._setRoom(room_id, { mode: 'one_each' });
    const order = first_speaker === 'codex' ? ['codex', 'yanqiu'] : ['yanqiu', 'codex'];
    const results = [];
    for (let idx = 0; idx < order.length; idx++) {
      const speaker = order[idx];
      const room = this.getRoom(room_id);
      if (room.status === 'stopped') break;
      if (room.pause_requested) break;                       // 立即暂停取消未开始的下一棒(case4)
      const gate = canDispatch(room, { automatic: true });
      if (!gate.ok) { results.push({ status: 'refused', reason: gate.reason, speaker }); break; }

      const round_id = this._uuid('round');
      const src = this._insertMessage({
        room_id, speaker: 'lisa', content: `【自动棒${idx + 1}·发给${speaker}】`,
        origin: 'lounge', origin_message_id: `${round_id}:${speaker}`, round_id, automatic: true,
      });
      const r = await this.dispatch({ room_id, target: speaker, message_id: src.message_id, automatic: true, round_id, timeout_ms });
      results.push({ ...r, speaker });

      if (this.hooks.afterBaton) await this.hooks.afterBaton({ room_id, index: idx, speaker, result: r });
      if (r.status !== 'replied') break;                     // 任一异常立即停(§5.2)
    }
    // 严格两棒后强制暂停
    const room = this.getRoom(room_id);
    if (room.status !== 'stopped') this._setRoom(room_id, { status: 'paused' });
    return results;
  }

  // ---------- 手动重试（§5.2 超时不自动重投，由 Lisa 点重试）----------
  async retry(dispatch_id, { timeout_ms } = {}) {
    const d = this.getDispatch(dispatch_id);
    if (!d) throw new Error(`no dispatch ${dispatch_id}`);
    if (d.status === 'replied') return { status: 'replied', dispatch_id, idempotent: true };
    // 重试=对同一 dispatch 重新收回复(若之前只是没收到)，不新建投递
    if (!this.lock.acquire(d.room_id, this.getRoom(d.room_id).status)) throw new LockedError(d.room_id);
    try {
      this._setRoom(d.room_id, { status: 'waiting_reply' });
      return await this._resolveReply(d.room_id, dispatch_id, d.target, timeout_ms || this.defaultTimeoutMs);
    } finally { this.lock.release(d.room_id); }
  }

  // ---------- 重启恢复（§10）----------
  // 启动后把 in-flight 投递标为"待核实"，先只读查对方是否已回复：
  //   已回复 → 只补采集(不重发)；未回复 → needs_attention，等 Lisa 手动重试。绝不自动重投。
  async recover() {
    const rows = this.db.prepare(
      `SELECT * FROM dispatches WHERE status IN (${INFLIGHT_DISPATCH.map(() => '?').join(',')})`
    ).all(...INFLIGHT_DISPATCH);
    const summary = { checked: rows.length, collected: 0, needs_attention: 0 };
    for (const d of rows) {
      const adapter = this._adapter(d.target);
      const p = await adapter.poll(d.dispatch_id);          // 只读，绝不 deliver
      if (p.state === 'replied') {
        this._bindReply(d.room_id, d.dispatch_id, d.target, d, p.reply);
        this._attempt(d.dispatch_id, d.target, 'recovered', 'collected existing reply');
        summary.collected++;
      } else {
        this.db.prepare('UPDATE dispatches SET status=? WHERE dispatch_id=?').run('needs_attention', d.dispatch_id);
        this._setRoom(d.room_id, { status: 'needs_attention' });
        this._attempt(d.dispatch_id, d.target, 'recovered', 'unresolved -> needs_attention');
        summary.needs_attention++;
      }
    }
    return summary;
  }

  budget(room_id) { return budgetState(this.getRoom(room_id)); }
}

module.exports = { Orchestrator, ROOM_STATUS, TARGETS };
