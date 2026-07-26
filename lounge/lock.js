'use strict';
// 三方会客厅 · 单飞锁（Step 1，优先级①）
// 施工图 §5.2「一个 dispatch 未闭合前不发下一棒」/ §2bis 生产协议「单飞锁」
// 一房间同一时刻至多一个未闭合投递(dispatching/waiting_reply)。
// 进程内 Set 防同 tick 重入 + DB status 做持久真相(重启后由 status 判定)。

const INFLIGHT_STATUSES = new Set(['dispatching', 'waiting_reply']);

class SingleFlight {
  constructor() { this._held = new Set(); }

  isInflightStatus(status) { return INFLIGHT_STATUSES.has(status); }

  // 尝试为房间上锁；已被本进程持有或 DB 状态在飞行中 → 失败
  acquire(roomId, dbStatus) {
    if (this._held.has(roomId)) return false;
    if (this.isInflightStatus(dbStatus)) return false;
    this._held.add(roomId);
    return true;
  }

  release(roomId) { this._held.delete(roomId); }
  held(roomId) { return this._held.has(roomId); }
}

class LockedError extends Error {
  constructor(roomId) { super(`room ${roomId} already has an in-flight dispatch`); this.code = 'LOCKED'; }
}

module.exports = { SingleFlight, LockedError, INFLIGHT_STATUSES };
