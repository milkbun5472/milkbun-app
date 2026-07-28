(function (root) {
  "use strict";

  const pending = new Set();

  async function afterDelivered(send, commit) {
    try {
      const delivered = await send();
      if (delivered !== true) return false;
      commit();
      return true;
    } catch (e) {
      return false;
    }
  }

  async function once(key, send, commit) {
    const lockKey = String(key || "");
    if (!lockKey || pending.has(lockKey)) return false;
    pending.add(lockKey);
    try {
      return await afterDelivered(send, commit);
    } finally {
      pending.delete(lockKey);
    }
  }

  const api = { afterDelivered, once };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.DeliveryCommit = api;
})(typeof window !== "undefined" ? window : globalThis);
