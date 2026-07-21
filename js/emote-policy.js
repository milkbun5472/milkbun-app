(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EmotePolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function canAutoSend(messages, minTurns) {
    const rows = Array.isArray(messages) ? messages : [];
    const gap = Number.isFinite(Number(minTurns)) ? Math.max(0, Number(minTurns)) : 8;
    let last = -1;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i] && rows[i].role === "assistant" && rows[i].kind === "emote") { last = i; break; }
    }
    if (last < 0) return true;
    const turns = new Set();
    for (let i = last + 1; i < rows.length; i++) {
      const m = rows[i];
      if (!m || m.role !== "assistant" || m.kind === "emote") continue;
      turns.add(m.turnId || m.id || ("row_" + i));
    }
    return turns.size >= gap;
  }
  return { canAutoSend };
});
