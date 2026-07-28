(function (root) {
  "use strict";

  function select(input) {
    const pool = Array.isArray(input && input.pool) ? input.pool : [];
    const relevant = Array.isArray(input && input.relevant) ? input.relevant : [];
    const limit = Math.max(1, Number(input && input.limit) || 6);
    const isCooling = input && typeof input.isCooling === "function" ? input.isCooling : () => false;
    const top1 = relevant[0] || null;
    const cooled = [];
    const rescored = pool.map(x => {
      if (x && x.e !== top1 && !x.e.open && isCooling(x.e.id)) {
        cooled.push({ id: x.e.id, reason: "cooldown" });
        return { e: x.e, s: x.s * 0.25 };
      }
      return x;
    }).sort((a, b) => b.s - a.s);
    let proposed = rescored.slice(0, limit).map(x => x.e);
    if (top1 && proposed[0] !== top1) proposed = [top1].concat(proposed.filter(e => e !== top1)).slice(0, limit);
    const baseIds = relevant.map(e => e.id), proposedIds = proposed.map(e => e.id);
    return {
      proposed,
      cooled,
      repeats: relevant.filter(e => e !== top1 && !e.open && isCooling(e.id)).length,
      replaced: baseIds.filter(id => !proposedIds.includes(id)).length
    };
  }

  const api = { select };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.RecallCooling = api;
})(typeof window !== "undefined" ? window : globalThis);
