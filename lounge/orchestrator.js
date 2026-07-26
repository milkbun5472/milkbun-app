'use strict';
// 三方会客厅 · Orchestrator 状态机（Step 1，初审修补版）
// 施工图 §5 / §10 / §2bis。唯一写入者。Adapter 注入(Step1 全 fake，零真实模型)。
// 初审修补：①未闭合dispatch为锁真相 ②外呼前事务预留预算·崩溃不退款不重投
//          ③bind单事务·防重复扣费 ④runOneEach真实正文 ⑤run计数+日预算 ⑥外键/CHECK/跨房间拒绝
const crypto = require('node:crypto');
const { budgetState } = require('./budget');
const { SingleFlight, LockedError } = require('./lock');
const { realClock } = require('./clock');

const TARGETS = { yanqiu: 'cc', codex: 'codex' };
const NAME = { lisa: 'Lisa', yanqiu: '言秋', codex: 'Codex' };
// 崩溃恢复只重扫真正"外呼后中断"的两态；timeout/needs_attention/failed 是已知需人工态，不重扫。
const RECOVER_SCAN = ['dispatching', 'delivered'];
// 单飞锁"占用"集合 = 除已闭合(replied)与已放弃(skipped)外，一切未闭合投递都继续占锁。
const CLOSED = ['replied', 'skipped'];

class CrossRoomError extends Error {
  constructor(messageId, roomId) { super(`message ${messageId} 不属于房间 ${roomId}`); this.code = 'CROSS_ROOM'; }
}

class Orchestrator {
  constructor({
    db, cc, codex, clock = realClock(), hooks = {}, pollInterval = 500,
    defaultTimeoutMs = 60000, targetTimeoutMs = {},
  }) {
    this.db = db;
    this.adapters = { cc, codex };
    this.clock = clock;
    this.hooks = hooks;
    this.pollInterval = pollInterval;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.targetTimeoutMs = targetTimeoutMs;
    this.lock = new SingleFlight();
    this.MAX_POLLS = 10000;
  }

  // ---------- 基础 ----------
  _uuid(p) { return `${p}_${crypto.randomUUID()}`; }
  _iso() { return new Date(this.clock.now()).toISOString(); }
  _today() { return new Date(this.clock.now()).toISOString().slice(0, 10); }
  _tx(fn) {
    this.db.exec('BEGIN');
    try { const r = fn(); this.db.exec('COMMIT'); return r; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  _adapter(target) {
    const k = TARGETS[target];
    if (!k || !this.adapters[k]) throw new Error(`no adapter for target ${target}`);
    return this.adapters[k];
  }
  getRoom(id) { return this.db.prepare('SELECT * FROM rooms WHERE room_id=?').get(id); }
  getDispatch(id) { return this.db.prepare('SELECT * FROM dispatches WHERE dispatch_id=?').get(id); }
  getMessage(id) { return this.db.prepare('SELECT * FROM messages WHERE message_id=?').get(id); }
  listMessages(roomId) { return this.db.prepare('SELECT * FROM messages WHERE room_id=? ORDER BY created_at, rowid').all(roomId); }
  _dispatchByMsgTarget(mid, t) { return this.db.prepare('SELECT * FROM dispatches WHERE message_id=? AND target=?').get(mid, t); }
  // 占锁真相：非 replied/skipped 的一切未闭合投递都继续占锁（含 timeout/needs_attention/failed）。
  // exceptId：retry 时排除被重试的那条自身，避免自己锁死自己。
  _hasOpenDispatch(roomId, exceptId = null) {
    const sql = `SELECT COUNT(*) c FROM dispatches WHERE room_id=? AND status NOT IN ('replied','skipped')`
      + (exceptId ? ' AND dispatch_id != ?' : '');
    const row = exceptId ? this.db.prepare(sql).get(roomId, exceptId) : this.db.prepare(sql).get(roomId);
    return row.c > 0;
  }
  _cursorOf(roomId, target) {
    const c = this.db.prepare('SELECT cursor FROM adapter_cursors WHERE room_id=? AND target=?').get(roomId, target);
    return (c && c.cursor) || `cur_before_${this.clock.now()}`;
  }
  _setRoom(id, fields) {
    const keys = Object.keys(fields);
    this.db.prepare(`UPDATE rooms SET ${keys.map((k) => `${k}=?`).join(',')}, updated_at=? WHERE room_id=?`)
      .run(...keys.map((k) => fields[k]), this._iso(), id);
  }
  _attempt(dispatchId, target, outcome, detail = null) {
    this.db.prepare('INSERT INTO delivery_attempts(dispatch_id,target,outcome,detail,at) VALUES(?,?,?,?,?)')
      .run(dispatchId, target, outcome, detail, this._iso());
  }

  // ---------- Room ----------
  createRoom({ room_id, title = '三方会客厅', cc_session_id = null, codex_thread_id = null,
    mode = 'hosted', max_auto_turns = 2, daily_char_cap = 0, daily_call_cap = 0 } = {}) {
    const id = room_id || this._uuid('lounge');
    const now = this._iso();
    this.db.prepare(`INSERT INTO rooms
      (room_id,title,cc_session_id,codex_thread_id,mode,status,next_speaker,max_auto_turns,auto_turns_used,
       budget_day,calls_today,usage_today,daily_char_cap,daily_call_cap,pause_requested,created_at,updated_at)
      VALUES(?,?,?,?,?, 'paused', NULL, ?,0, ?,0,0,?,?,0,?,?)`)
      .run(id, title, cc_session_id, codex_thread_id, mode, max_auto_turns, this._today(), daily_char_cap, daily_call_cap, now, now);
    return this.getRoom(id);
  }

  // ---------- Message ----------
  _insertMessage({ room_id, speaker, content, origin, origin_message_id = null, reply_to = null, round_id = null, automatic = false }) {
    if (origin_message_id) {
      const ex = this.db.prepare('SELECT * FROM messages WHERE room_id=? AND origin=? AND origin_message_id=?')
        .get(room_id, origin, origin_message_id);
      if (ex) return ex;                              // 幂等
    }
    const id = this._uuid('msg');
    this.db.prepare(`INSERT INTO messages
      (message_id,room_id,speaker,content,reply_to,origin,origin_message_id,round_id,automatic,character_count,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, room_id, speaker, content, reply_to, origin, origin_message_id, round_id, automatic ? 1 : 0, content.length, this._iso());
    return this.getMessage(id);
  }
  postLisaMessage(room_id, content, { reply_to = null, round_id = null } = {}) {
    return this._insertMessage({ room_id, speaker: 'lisa', content, origin: 'lounge', reply_to, round_id });
  }
  ingestExternalMessage(room_id, { speaker, content, origin, origin_message_id }) {
    if (!this.getRoom(room_id)) throw new Error(`no room ${room_id}`);
    if (!['yanqiu', 'codex'].includes(speaker)) throw new Error('外部发言人不正确');
    if (!['cc', 'codex'].includes(origin)) throw new Error('外部来源不正确');
    if (!origin_message_id || !String(content || '').trim()) throw new Error('外部发言缺幂等键或正文');
    return this._insertMessage({
      room_id, speaker, content: String(content).trim(), origin, origin_message_id,
    });
  }
  composeLisaMessages(room_id, message_ids) {
    const ids = [...new Set(Array.isArray(message_ids) ? message_ids : [])];
    if (!ids.length) throw new Error('composeLisaMessages 需要至少一条消息');
    const messages = ids.map((id) => this.getMessage(id));
    if (messages.some((m) => !m || m.room_id !== room_id || m.speaker !== 'lisa' || m.automatic)) {
      throw new Error('只能合并本房间里 Lisa 亲自写的消息');
    }
    if (messages.length === 1) return messages[0];
    return this._insertMessage({
      room_id,
      speaker: 'lisa',
      content: messages.map((m) => m.content).join('\n\n'),
      origin: 'lounge',
      automatic: true,
    });
  }

  composeHandoff(room_id, message_ids, target) {
    if (!['yanqiu', 'codex'].includes(target)) throw new Error('施工交接目标不正确');
    const source = this.composeLisaMessages(room_id, message_ids);
    return this._insertMessage({
      room_id,
      speaker: 'lisa',
      content: [
        `Lisa 已明确按下「施工交接」，正式授权${NAME[target]}开始动手。`,
        '以下内容已经从议事转为施工任务；请在原窗口执行，完成后把施工回执带回会客厅。普通讨论内容之外不要自行扩大范围。',
        `交接内容：\n${source.content}`,
      ].join('\n\n'),
      origin: 'lounge',
      automatic: true,
    });
  }

  composeSummon(room_id, target) {
    if (!['yanqiu', 'codex'].includes(target)) throw new Error('呼叫目标不正确');
    const visible = this.listMessages(room_id).filter((m) => !m.automatic);
    let lastOwn = -1;
    for (let i = visible.length - 1; i >= 0; i--) {
      if (visible[i].speaker === target) { lastOwn = i; break; }
    }
    const delta = visible.slice(lastOwn + 1).filter((m) => m.speaker !== target);
    const lines = ['Lisa 刚刚按下呼叫，请你来会客厅坐坐。'];
    if (delta.length) {
      lines.push('你上次在桌上发言后，新增的公开内容如下：');
      lines.push(delta.map((m) => `${NAME[m.speaker]}：${m.content}`).join('\n\n'));
    } else {
      lines.push('桌上暂时没有新的指定问题；你可以自然地打个招呼，或说一句此刻真正想说的话。');
    }
    return this._insertMessage({
      room_id, speaker: 'lisa', content: lines.join('\n\n'),
      origin: 'lounge', automatic: true,
    });
  }

  // 给目标补齐“自从 TA 上次在桌上发言后新增的公开内容”。
  // 只取会客厅可见消息，不取 automatic 机器信封，也不重复目标自己的话。
  composeContextForTarget(room_id, target, { fallbackMessageId = null, alwaysLabel = false } = {}) {
    const visible = this.listMessages(room_id).filter((m) => !m.automatic);
    let lastOwn = -1;
    for (let i = visible.length - 1; i >= 0; i--) {
      if (visible[i].speaker === target) { lastOwn = i; break; }
    }
    let delta = visible.slice(lastOwn + 1).filter((m) => m.speaker !== target);
    if (!delta.length && fallbackMessageId) {
      const fallback = this.getMessage(fallbackMessageId);
      if (fallback) delta = [fallback];
    }
    if (!delta.length) throw new Error(`没有可递给 ${target} 的新公开内容`);
    if (delta.length === 1 && delta[0].speaker === 'lisa' && !alwaysLabel) return delta[0];

    const content = delta.map((m) => `${NAME[m.speaker]}：${m.content}`).join('\n\n');
    const fingerprint = crypto.createHash('sha256')
      .update(`${target}\0${delta.map((m) => m.message_id).join('\0')}`)
      .digest('hex').slice(0, 24);
    return this._insertMessage({
      room_id,
      speaker: 'lisa',
      content,
      origin: 'lounge',
      origin_message_id: `context:${target}:${fingerprint}`,
      automatic: true,
    });
  }

  // ---------- 控制 ----------
  pause(room_id) { this._setRoom(room_id, { pause_requested: 1, status: 'paused' }); return this.getRoom(room_id); }
  resume(room_id) { this._setRoom(room_id, { pause_requested: 0 }); return this.getRoom(room_id); }
  stop(room_id) { this._setRoom(room_id, { status: 'stopped', pause_requested: 1 }); return this.getRoom(room_id); }

  // ---------- 预算预留（必须在 tx 内调用；②外呼前预留）----------
  _reserve(roomId, { automatic = false, reserveTurn = false, reserveCall = true }) {
    // ⑤ 日滚动：跨日重置当日累计与自动 run 计数
    const today = this._today();
    let room = this.getRoom(roomId);
    if (room.budget_day !== today) {
      this.db.prepare('UPDATE rooms SET budget_day=?, calls_today=0, usage_today=0, auto_turns_used=0 WHERE room_id=?').run(today, roomId);
      room = this.getRoom(roomId);
    }
    if (room.status === 'stopped') return { ok: false, reason: 'room_stopped' };
    if (automatic && room.pause_requested) return { ok: false, reason: 'paused' };
    if (automatic) {
      const b = budgetState(room);
      if (!b.autoAllowedDaily) return { ok: false, reason: 'daily_cap' };
      if (reserveTurn && room.auto_turns_used >= room.max_auto_turns) return { ok: false, reason: 'auto_turns_exhausted' };
    }
    if (reserveTurn) this.db.prepare('UPDATE rooms SET auto_turns_used=auto_turns_used+1 WHERE room_id=?').run(roomId);
    if (reserveCall) this.db.prepare('UPDATE rooms SET calls_today=calls_today+1 WHERE room_id=?').run(roomId);
    return { ok: true };
  }

  // ---------- 投递（begin/resolve 两段）----------
  async dispatch(opts) {
    const { room_id, target, message_id } = opts;
    const room = this.getRoom(room_id);
    if (!room) throw new Error(`no room ${room_id}`);
    const src = this.getMessage(message_id);
    if (!src) throw new Error(`no message ${message_id}`);
    if (src.room_id !== room_id) throw new CrossRoomError(message_id, room_id);      // ⑥跨房间拒绝

    const existing = this._dispatchByMsgTarget(message_id, target);                  // 幂等①(红线⑤)
    if (existing) return { status: existing.status, dispatch_id: existing.dispatch_id, idempotent: true };

    if (target === 'codex' && opts.codex_confirmed !== true) {
      return { status: 'refused', reason: 'codex_confirmation_required' };
    }

    // Codex 的额度/状态闸必须先于预算预留与任何 dispatch 落库。
    const targetAdapter = this._adapter(target);
    if (target === 'codex' && typeof targetAdapter.preflight === 'function') {
      try {
        await targetAdapter.preflight({
          codex_thread_id: room.codex_thread_id,
          codex_confirmed: true,
          content: src.content,
        });
      } catch (e) {
        return { status: 'refused', reason: (e && e.code) || 'codex_preflight_failed' };
      }
    }

    // ① 单飞真相 = 未闭合 dispatch 查询（覆盖 waiting→pause→手动再投 必须 LOCKED）
    if (!this.lock.acquire(room_id, this._hasOpenDispatch(room_id))) throw new LockedError(room_id);
    try {
      const b = await this._beginDispatch(opts);
      if (b.refused) return { status: 'refused', reason: b.reason };
      if (b.failed) return { status: 'needs_attention', reason: b.reason, dispatch_id: b.dispatch_id };
      const timeout = opts.timeout_ms || this.targetTimeoutMs[target] || this.defaultTimeoutMs;
      return await this._resolveReply(room_id, b.dispatch_id, target, timeout);
    } finally {
      this.lock.release(room_id);
    }
  }

  // 送达为止（不含收回复）。②预留在外呼前的单事务里；外呼失败=unknown→不退款不重投
  async _beginDispatch(opts) {
    const { room_id, target, message_id, round_id = null } = opts;
    const automatic = opts.automatic || false;
    const reserveTurn = automatic && (opts.reserveTurn !== false);
    const src = this.getMessage(message_id);
    if (!src) throw new Error(`no message ${message_id}`);
    if (src.room_id !== room_id) throw new CrossRoomError(message_id, room_id);
    const dispatch_id = this._uuid('dispatch');
    const after_cursor = this._cursorOf(room_id, target);

    const res = this._tx(() => {
      const r = this._reserve(room_id, { automatic, reserveTurn, reserveCall: true });
      if (!r.ok) return r;
      if (!automatic) this.db.prepare('UPDATE rooms SET pause_requested=0 WHERE room_id=?').run(room_id);
      this.db.prepare(`INSERT INTO dispatches
        (dispatch_id,room_id,round_id,target,speaker,message_id,status,after_cursor,expects_reply,reply_limit,automatic,created_at)
        VALUES(?,?,?,?,?,?, 'dispatching', ?,1,1,?,?)`)
        .run(dispatch_id, room_id, round_id, target, src.speaker, message_id, after_cursor, automatic ? 1 : 0, this._iso());
      this._setRoom(room_id, { status: 'dispatching' });
      return { ok: true };
    });
    if (!res.ok) return { refused: true, reason: res.reason };

    // 唯一外呼/副作用点。抛错=未知是否落地：不退预算、不自动重投(②)
    const room = this.getRoom(room_id);
    try {
      await this._adapter(target).deliver({
        dispatch_id, room_id, round_id, target, speaker: src.speaker, message_id,
        content: src.content, expects_reply: true, reply_limit: 1,
        cc_session_id: room.cc_session_id, codex_thread_id: room.codex_thread_id, // 目标会话绑定(供真实 adapter 定位)
        codex_confirmed: opts.codex_confirmed === true, // Codex 每次真实调用必须由 Lisa 明确确认
      });
    } catch (e) {
      this.db.prepare('UPDATE dispatches SET status=?, resolved_at=? WHERE dispatch_id=?').run('failed', this._iso(), dispatch_id);
      this._setRoom(room_id, { status: 'needs_attention' });
      this._attempt(dispatch_id, target, 'error', (e && e.code) || String(e));
      return { failed: true, reason: 'deliver_failed', dispatch_id };
    }
    this._attempt(dispatch_id, target, 'delivered');
    this.db.prepare('UPDATE dispatches SET status=?, delivered_at=? WHERE dispatch_id=?').run('delivered', this._iso(), dispatch_id);
    this._setRoom(room_id, { status: 'waiting_reply' });
    return { ok: true, dispatch_id };
  }

  async _resolveReply(room_id, dispatch_id, target, timeout_ms) {
    const adapter = this._adapter(target);
    const deliveredAt = this.clock.now();
    for (let i = 0; i < this.MAX_POLLS; i++) {
      if (this.getRoom(room_id).pause_requested) { this._setRoom(room_id, { status: 'paused' }); return { status: 'paused', dispatch_id }; }
      const p = await adapter.poll(dispatch_id);
      if (p.state === 'replied') return this._bindReply(room_id, dispatch_id, target, p.reply);
      if (p.state === 'empty') return this._stall(room_id, dispatch_id, 'empty');
      if (p.state === 'intrusion') return this._stall(room_id, dispatch_id, 'intrusion');   // 真实用户插队→不猜绑
      if (p.state === 'error') return this._stall(room_id, dispatch_id, p.reason || 'adapter_error');
      if (this.clock.now() - deliveredAt > timeout_ms) return this._stall(room_id, dispatch_id, 'timeout');
      await this.clock.sleep(this.pollInterval);
    }
    return this._stall(room_id, dispatch_id, 'poll_exhausted');
  }

  // ③ 回复落库 + dispatch=replied + 用量记账 + cursor 推进：单事务；重复绑定不重复扣费
  _bindReply(room_id, dispatch_id, target, reply) {
    return this._tx(() => {
      const d = this.getDispatch(dispatch_id);
      if (d.status === 'replied' || d.usage_charged === 1) {
        return { status: 'replied', dispatch_id, message_id: d.reply_message_id, idempotent: true };
      }
      const origin = target === 'codex' ? 'codex' : 'cc';
      const msg = this._insertMessage({ room_id, speaker: target, content: reply.content, origin, origin_message_id: reply.cursor_end, round_id: d.round_id });
      this.db.prepare('UPDATE dispatches SET status=?, reply_message_id=?, usage_charged=1, resolved_at=? WHERE dispatch_id=?')
        .run('replied', msg.message_id, this._iso(), dispatch_id);
      const room = this.getRoom(room_id);
      this._setRoom(room_id, { usage_today: room.usage_today + reply.content.length, status: 'paused' });
      this.db.prepare('INSERT OR REPLACE INTO adapter_cursors(room_id,target,cursor,updated_at) VALUES(?,?,?,?)')
        .run(room_id, target, reply.cursor_end, this._iso());
      if (reply.usage) {
        this.db.prepare('INSERT OR REPLACE INTO adapter_usage(dispatch_id,target,usage_json,recorded_at) VALUES(?,?,?,?)')
          .run(dispatch_id, target, JSON.stringify(reply.usage), this._iso());
      }
      if (target === 'yanqiu' && Number.isFinite(Number(reply.stream_cursor))) {
        const st = this.db.prepare('SELECT outbox_path FROM cc_dispatch_state WHERE dispatch_id=?').get(dispatch_id);
        if (st && st.outbox_path) {
          this.db.prepare(`INSERT INTO external_stream_cursors(stream_key,stream_path,byte_cursor,updated_at)
            VALUES('yanqiu:lounge_outbox',?,?,?) ON CONFLICT(stream_key) DO UPDATE SET
            stream_path=excluded.stream_path,byte_cursor=MAX(byte_cursor,excluded.byte_cursor),updated_at=excluded.updated_at`)
            .run(st.outbox_path, Number(reply.stream_cursor), this._iso());
        }
      }
      return { status: 'replied', dispatch_id, message_id: msg.message_id, reply };
    });
  }

  _stall(room_id, dispatch_id, reason) {
    this.db.prepare('UPDATE dispatches SET status=?, resolved_at=? WHERE dispatch_id=?')
      .run(reason === 'timeout' ? 'timeout' : 'needs_attention', this._iso(), dispatch_id);
    this._setRoom(room_id, { status: 'needs_attention' });
    this._attempt(dispatch_id, this.getDispatch(dispatch_id).target, 'stalled', reason);
    return { status: 'needs_attention', dispatch_id, reason };
  }

  // ---------- 双方各答一轮（§5.2；④真实正文 ⑤两棒=一次run）----------
  async runOneEach({ room_id, lisa_message_id, first_speaker = 'yanqiu', timeout_ms, codex_confirmed = false } = {}) {
    if (!this.getRoom(room_id)) throw new Error(`no room ${room_id}`);
    const lisa = this.getMessage(lisa_message_id);
    if (!lisa || lisa.speaker !== 'lisa') throw new Error('runOneEach 需要一条 Lisa 自然正文消息');
    if (lisa.room_id !== room_id) throw new CrossRoomError(lisa_message_id, room_id);
    if (!codex_confirmed) return { refused: true, reason: 'codex_confirmation_required', results: [] };
    this._setRoom(room_id, { mode: 'one_each' });
    const runId = this._uuid('run');

    // ⑤ 预留一次自动 run（两棒共一次），外呼前事务内
    const res = this._tx(() => this._reserve(room_id, { automatic: true, reserveTurn: true, reserveCall: false }));
    if (!res.ok) return { run_id: runId, refused: true, reason: res.reason, results: [] };

    const order = first_speaker === 'codex' ? ['codex', 'yanqiu'] : ['yanqiu', 'codex'];
    const results = [];
    let prevReply = null;
    for (let idx = 0; idx < order.length; idx++) {
      const speaker = order[idx];
      const room = this.getRoom(room_id);
      if (room.status === 'stopped') break;
      if (room.pause_requested) break;                     // 立即暂停取消未开始的下一棒(④)
      let srcId;
      if (idx === 0) {
        // A 收自己上次发言之后的公开增量；首次至少含 Lisa 本轮原话。
        const aMsg = this.composeContextForTarget(room_id, speaker, {
          fallbackMessageId: lisa.message_id,
          alwaysLabel: true,
        });
        srcId = aMsg.message_id;
      } else {
        // B 同样收自己的未读公开增量，其中自然包含 A 刚刚的可见回复。
        const bMsg = this.composeContextForTarget(room_id, speaker, {
          fallbackMessageId: lisa.message_id,
          alwaysLabel: true,
        });
        srcId = bMsg.message_id;
      }
      const r = await this.dispatch({
        room_id, target: speaker, message_id: srcId, automatic: true, reserveTurn: false,
        round_id: runId, timeout_ms, codex_confirmed: speaker === 'codex' ? codex_confirmed : false,
      });
      results.push({ ...r, speaker });
      if (this.hooks.afterBaton) await this.hooks.afterBaton({ room_id, index: idx, speaker, result: r });
      if (r.status !== 'replied') break;                   // 任一异常立即停(§5.2)
      prevReply = r;
    }
    const room = this.getRoom(room_id);
    if (room.status !== 'stopped') this._setRoom(room_id, { status: 'paused' });
    return { run_id: runId, results };
  }

  // ---------- 手动重试（§5.2；不新建投递，重收回复）----------
  async retry(dispatch_id, { timeout_ms } = {}) {
    const d = this.getDispatch(dispatch_id);
    if (!d) throw new Error(`no dispatch ${dispatch_id}`);
    if (d.status === 'replied') return { status: 'replied', dispatch_id, idempotent: true };
    if (d.status === 'skipped') return { status: 'skipped', dispatch_id, abandoned: true };
    // 排除自身：被重试的这条本就未闭合、占着锁，不能让它锁死自己
    if (!this.lock.acquire(d.room_id, this._hasOpenDispatch(d.room_id, dispatch_id))) throw new LockedError(d.room_id);
    try {
      this.db.prepare(`UPDATE dispatches SET status='delivered', resolved_at=NULL WHERE dispatch_id=?`).run(dispatch_id);
      this._setRoom(d.room_id, { status: 'waiting_reply' });
      return await this._resolveReply(d.room_id, dispatch_id, d.target, timeout_ms || this.defaultTimeoutMs);
    } finally { this.lock.release(d.room_id); }
  }

  // timeout 后的迟到回复只读补收：绝不 deliver、绝不新增调用。
  async collectExisting(dispatch_id) {
    const d = this.getDispatch(dispatch_id);
    if (!d) throw new Error(`no dispatch ${dispatch_id}`);
    if (d.status === 'replied') return { status: 'replied', dispatch_id, idempotent: true };
    if (d.status === 'skipped') return { status: 'skipped', dispatch_id };
    const p = await this._adapter(d.target).poll(dispatch_id);
    if (p.state === 'replied') {
      const result = this._bindReply(d.room_id, dispatch_id, d.target, p.reply);
      this._attempt(dispatch_id, d.target, 'late_collected', 'existing reply after timeout');
      return result;
    }
    return { status: d.status, dispatch_id, pending: p.state === 'pending' };
  }

  // Lisa 显式放弃一条卡住的投递 → skipped，释放单飞锁，房间可重新主持
  abandon(dispatch_id) {
    const d = this.getDispatch(dispatch_id);
    if (!d) throw new Error(`no dispatch ${dispatch_id}`);
    if (d.status === 'replied') return { status: 'replied', dispatch_id, idempotent: true };
    if (d.status === 'skipped') return { status: 'skipped', dispatch_id, idempotent: true };
    this.db.prepare('UPDATE dispatches SET status=?, resolved_at=? WHERE dispatch_id=?').run('skipped', this._iso(), dispatch_id);
    this._attempt(dispatch_id, d.target, 'abandoned', 'lisa abandon');
    const room = this.getRoom(d.room_id);
    if (room.status !== 'stopped') this._setRoom(d.room_id, { status: 'paused' });
    return { status: 'skipped', dispatch_id };
  }

  // ---------- 重启恢复（§10；不退款、不重投）----------
  async recover() {
    const rows = this.db.prepare(`SELECT * FROM dispatches WHERE status IN (${RECOVER_SCAN.map(() => '?').join(',')})`).all(...RECOVER_SCAN);
    const summary = { checked: rows.length, collected: 0, needs_attention: 0 };
    for (const d of rows) {
      const p = await this._adapter(d.target).poll(d.dispatch_id);   // 只读，绝不 deliver
      if (p.state === 'replied') {
        this._bindReply(d.room_id, d.dispatch_id, d.target, p.reply); // 幂等·不重复扣费
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

module.exports = { Orchestrator, TARGETS, CrossRoomError };
