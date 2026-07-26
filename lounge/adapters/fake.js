'use strict';
// 三方会客厅 · Fake Adapter（Step 1）
// 施工图 §1 红线 + §12 第1步「用两个假 Adapter 跑测试」。
// 绝不调用 send_message / codex exec resume / 任何真实模型。
// 只做两件事：① 记录投递(计数，供"重复投递不重复"断言) ② 按脚本回放 poll 状态。

class FakeAdapter {
  constructor(name) {
    this.name = name;                 // 'cc' | 'codex'
    this._deliverByDispatch = new Map(); // dispatch_id -> count
    this._deliverByTarget = new Map();   // `${message_id}|${target}` -> count
    this._script = new Map();            // dispatch_id -> [states...] (FIFO 消费)
    this._seeded = new Map();            // dispatch_id -> reply (重启前对方已答/预置)
    this._online = true;
    this._running = false;
    this.delivered = [];                 // 捕获收到的信封(验证正文=自然内容,无机器元数据)
  }

  // ---- 测试编排 ----
  // states: 依次返回的 poll 结果，如 ['pending','replied'] 或 ['pending','pending',...]
  program(dispatchId, states) { this._script.set(dispatchId, states.slice()); }
  // 预置一条"已存在的回复"：poll 立即 replied，且不需要 deliver（模拟崩溃前对方已答）
  seedReply(dispatchId, reply) { this._seeded.set(dispatchId, reply); }
  deliverCount(dispatchId) { return this._deliverByDispatch.get(dispatchId) || 0; }
  targetDeliverCount(messageId, target) { return this._deliverByTarget.get(`${messageId}|${target}`) || 0; }
  totalDelivers() { let n = 0; for (const v of this._deliverByDispatch.values()) n += v; return n; }
  setHealth({ online, running }) { if (online !== undefined) this._online = online; if (running !== undefined) this._running = running; }

  // ---- Adapter 契约（§7.1 / §7.2 的 Step1 假实现）----
  async deliver(envelope) {
    if (!this._online) { throw Object.assign(new Error('adapter offline'), { code: 'OFFLINE' }); }
    this.delivered.push(envelope);
    const id = envelope.dispatch_id;
    this._deliverByDispatch.set(id, (this._deliverByDispatch.get(id) || 0) + 1);
    const key = `${envelope.message_id}|${envelope.target}`;
    this._deliverByTarget.set(key, (this._deliverByTarget.get(key) || 0) + 1);
    return { accepted: true, dispatch_id: id };
  }

  // 返回 { state:'pending'|'replied'|'empty'|'intrusion', reply? }
  async poll(dispatchId) {
    if (this._seeded.has(dispatchId)) {
      return { state: 'replied', reply: this._seeded.get(dispatchId) };
    }
    const q = this._script.get(dispatchId);
    let state = 'replied';
    if (q && q.length) state = q.shift();
    if (state === 'replied') {
      return {
        state,
        reply: {
          content: `【fake:${this.name}】可见回复`,   // 不嵌 dispatch_id，避免与"正文无元数据"断言混淆
          bubbles: 1,
          cursor_end: `cur_${dispatchId}`,
        },
      };
    }
    return { state };
  }

  async getHealth() { return { online: this._online, running: this._running }; }
}

module.exports = { FakeAdapter };
