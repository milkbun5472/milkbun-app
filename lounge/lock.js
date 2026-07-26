'use strict';
// 三方会客厅 · 单飞锁（Step 1，初审修补①）
// 施工图 §5.2 / §2bis。
// 真相 = DB 里有没有「未闭合 dispatch」(status IN dispatching/delivered)，
// 不再看 room.status —— 因为「等待回复时 pause」会把 room.status 变 paused，
// 但投递其实仍未闭合，此时手动再投必须被 LOCKED。
// 进程内 Set 只防同一 tick 重入；持久真相靠未闭合 dispatch 查询。

const OPEN_DISPATCH_STATUSES = ['dispatching', 'delivered'];

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

module.exports = { SingleFlight, LockedError, OPEN_DISPATCH_STATUSES };
