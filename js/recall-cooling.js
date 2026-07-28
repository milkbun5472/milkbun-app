(function (root) {
  "use strict";

  function seedNumber(value) {
    let h = 2166136261;
    const s = String(value == null ? "" : value);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function random01(state) {
    let x = state.value || 0x9e3779b9;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state.value = x >>> 0;
    return state.value / 4294967296;
  }

  function tieShuffle(scored, top1, limit, seed) {
    if (seed == null || !top1) return { scored, windowSize: 0 };
    const head = scored.find(x => x.e === top1);
    const tail = scored.filter(x => x.e !== top1);
    if (!head || tail.length < 2) return { scored: head ? [head].concat(tail) : scored, windowSize: Math.min(1, tail.length) };
    const max = tail[0].s;
    const cap = Math.max(0, limit - 1);
    const windowSize = tail.slice(0, cap).filter(x => x.s >= max * 0.95).length;
    if (windowSize < 2) return { scored: [head].concat(tail), windowSize };
    const win = tail.slice(0, windowSize), state = { value: seedNumber(seed) };
    for (let i = win.length - 1; i > 0; i--) {
      const j = Math.floor(random01(state) * (i + 1));
      [win[i], win[j]] = [win[j], win[i]];
    }
    return { scored: [head].concat(win, tail.slice(windowSize)), windowSize };
  }

  function select(input) {
    const pool = Array.isArray(input && input.pool) ? input.pool : [];
    const relevant = Array.isArray(input && input.relevant) ? input.relevant : [];
    const limit = Math.max(1, Number(input && input.limit) || 6);
    const isCooling = input && typeof input.isCooling === "function" ? input.isCooling : () => false;
    const top1 = relevant[0] || null;
    const cooled = [];
    let rescored = pool.map(x => {
      if (x && x.e !== top1 && !x.e.open && isCooling(x.e.id)) {
        cooled.push({ id: x.e.id, reason: "cooldown" });
        return { e: x.e, s: x.s * 0.25 };
      }
      return x;
    }).sort((a, b) => b.s - a.s);
    const tied = tieShuffle(rescored, top1, limit, input && input.tieSeed);
    rescored = tied.scored;
    let proposed = rescored.slice(0, limit).map(x => x.e);
    if (top1 && proposed[0] !== top1) proposed = [top1].concat(proposed.filter(e => e !== top1)).slice(0, limit);
    const baseIds = relevant.map(e => e.id), proposedIds = proposed.map(e => e.id);
    return {
      proposed,
      cooled,
      repeats: relevant.filter(e => e !== top1 && !e.open && isCooling(e.id)).length,
      replaced: baseIds.filter(id => !proposedIds.includes(id)).length,
      tieWindowSize: tied.windowSize
    };
  }

  const api = { select, seedNumber };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.RecallCooling = api;
})(typeof window !== "undefined" ? window : globalThis);
