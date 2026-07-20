(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StoragePolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const LOCAL_LIMIT = 5 * 1024 * 1024;
  function chatKeep(bytes, limit) {
    const cap = Number(limit) > 0 ? Number(limit) : LOCAL_LIMIT;
    const ratio = Math.max(0, Number(bytes) || 0) / cap;
    if (ratio >= 0.9) return 80;
    if (ratio >= 0.8) return 120;
    return 200;
  }
  return { LOCAL_LIMIT, chatKeep };
});
