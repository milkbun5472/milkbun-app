'use strict';
// 三方会客厅 · Codex Adapter（Step 3）
// 指定旧 thread → 官方 CLI resume --json → 单次 stdout spool → 最终可见 agent_message。
// 默认强制 DB 持久化；没有每次明确确认标记，绝不启动真实 Codex 调用。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { realClock } = require('../clock');
const { classifyCodexJsonl } = require('./codex-jsonl');
const { createCodexCliRunner } = require('./codex-runner');

const DEFAULT_SPOOL_DIR = path.join(os.homedir(), 'Library/Application Support/LisaLounge/codex-spool');

class CodexAdapter {
  constructor({
    db, runner = createCodexCliRunner(), threadHealth = null,
    clock = realClock(), spoolDir = DEFAULT_SPOOL_DIR, ephemeral = false,
  } = {}) {
    if (!db && !ephemeral) throw new Error('CodexAdapter 需要传入 Orchestrator 使用的同一个 db；测试请显式 ephemeral:true');
    if (!runner || typeof runner.start !== 'function') throw new Error('CodexAdapter 需要 runner.start');
    if (typeof threadHealth !== 'function' && !ephemeral) {
      throw new Error('CodexAdapter 生产模式需要 threadHealth(threadId)，禁止静默跳过任务运行状态检查');
    }
    this.name = 'codex';
    this.db = db || null;
    this.runner = runner;
    this.threadHealth = threadHealth || (async () => ({ exists: true, running: false }));
    this.clock = clock;
    this.spoolDir = spoolDir;
    this._st = new Map();
  }

  _iso() { return new Date(this.clock.now()).toISOString(); }
  _spool(dispatchId) { return path.join(this.spoolDir, `${dispatchId}.jsonl`); }

  _persist(st) {
    if (!this.db) return;
    this.db.prepare(`INSERT OR REPLACE INTO codex_dispatch_state
      (dispatch_id,thread_id,spool_path,pid,state,started_at,updated_at) VALUES(?,?,?,?,?,?,?)`)
      .run(st.dispatch_id, st.threadId, st.spoolPath, st.pid || null, st.state, st.startedAt, this._iso());
  }

  _load(dispatchId) {
    if (this._st.has(dispatchId)) return this._st.get(dispatchId);
    if (!this.db) return null;
    const row = this.db.prepare('SELECT * FROM codex_dispatch_state WHERE dispatch_id=?').get(dispatchId);
    if (!row) return null;
    const st = {
      dispatch_id: dispatchId, threadId: row.thread_id, spoolPath: row.spool_path,
      pid: row.pid, state: row.state, startedAt: row.started_at,
    };
    this._st.set(dispatchId, st);
    return st;
  }

  async preflight(envelope) {
    if (envelope.codex_confirmed !== true) {
      throw Object.assign(new Error('Codex 本轮尚未由 Lisa 明确确认'), { code: 'CODEX_CONFIRM_REQUIRED' });
    }
    const threadId = envelope.codex_thread_id;
    if (!threadId) throw Object.assign(new Error('deliver 缺 codex_thread_id'), { code: 'NO_THREAD' });
    if (typeof this.runner.exists === 'function' && !this.runner.exists()) {
      throw Object.assign(new Error('Codex CLI 不存在'), { code: 'CODEX_CLI_MISSING' });
    }

    const health = await this.threadHealth(threadId);
    if (health && health.exists === false) throw Object.assign(new Error('Codex task 不存在'), { code: 'THREAD_NOT_FOUND' });
    if (health && health.running) throw Object.assign(new Error('Codex task 正在运行，禁止并发续接'), { code: 'THREAD_BUSY' });
    return { ok: true };
  }

  async deliver(envelope) {
    await this.preflight(envelope);                 // 外呼前二次检查，防检查后状态变化
    const threadId = envelope.codex_thread_id;
    const st = {
      dispatch_id: envelope.dispatch_id,
      threadId,
      spoolPath: this._spool(envelope.dispatch_id),
      pid: null,
      state: 'prepared',
      startedAt: this._iso(),
    };
    this._persist(st);                    // 外呼前持久化 spool/thread
    this._st.set(envelope.dispatch_id, st);

    const started = await this.runner.start({ threadId, prompt: envelope.content, spoolPath: st.spoolPath });
    st.pid = started && started.pid;
    st.state = 'running';
    this._persist(st);
    return { accepted: true, dispatch_id: envelope.dispatch_id };
  }

  async poll(dispatchId) {
    const st = this._load(dispatchId);
    if (!st) return { state: 'pending' };
    let text = '';
    try { text = fs.readFileSync(st.spoolPath, 'utf8'); } catch { return { state: 'pending' }; }
    const result = classifyCodexJsonl(text, st.threadId);
    if (result.state === 'replied') result.reply.cursor_end = `codex@${dispatchId}`;
    if (result.state === 'replied' || result.state === 'empty' || result.state === 'error' || result.state === 'intrusion') {
      st.state = result.state === 'replied' || result.state === 'empty' ? 'completed' : 'failed';
      this._persist(st);
    }
    return result;
  }

  async getHealth(threadId) {
    const cli = typeof this.runner.exists === 'function' ? this.runner.exists() : true;
    if (!cli) return { online: false, running: false, error: 'codex_cli_missing' };
    try {
      const h = await this.threadHealth(threadId);
      return { online: h.exists !== false, running: !!h.running, threadId };
    } catch (e) {
      return { online: false, running: false, error: (e && e.message) || String(e) };
    }
  }
}

module.exports = { CodexAdapter, DEFAULT_SPOOL_DIR };
