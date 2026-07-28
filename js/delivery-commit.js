(function (root) {
  "use strict";

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

  const api = { afterDelivered };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.DeliveryCommit = api;
})(typeof window !== "undefined" ? window : globalThis);
