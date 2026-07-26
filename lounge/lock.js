'use strict';
// 三方会客厅 · 单飞锁（Step 1，初审修补①）
// 施工图 §5.2 / §2bis。
// 真相 = DB 里有没有「未闭合 dispatch」——除 replied(已闭合) 与 skipped(Lisa 放弃) 外，
// dispatching/delivered/timeout/needs_attention/failed 一律继续占锁，直到 replied 或显式 abandon。
// 不看 room.status —— 因为「等待回复时 pause」会把 room.status 变 paused，但投递仍未闭合。
// 进程内 Set 只防同一 tick 重入；持久真相由 orchestrator._hasOpenDispatch 查询。

const CLOSED_DISPATCH_STATUSES = ['replied', 'skipped'];

class SingleFlight {
  constructor() { this._held = new Set(); }

  // hasOpenDispatch: 调用方用 DB 查出的布尔
  acquire(roomId, hasOpenDispatch) {
    if (this._held.has(roomId)) return false;
    if (hasOpenDispatch) return false;
    this._held.add(roomId);
    return true;
  }
  release(roomId) { this._held.delete(roomId); }
  held(roomId) { return this._held.has(roomId); }
}

class LockedError extends Error {
  constructor(roomId) { super(`room ${roomId} already has an in-flight (unclosed) dispatch`); this.code = 'LOCKED'; }
}

module.exports = { SingleFlight, LockedError, CLOSED_DISPATCH_STATUSES };
