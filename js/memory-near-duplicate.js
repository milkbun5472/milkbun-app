// 自动记忆近邻去重：只拦同角色、近时段、同一事件的换句话重复。
// 计划→完成、取消/纠正、数字发生变化都属于新进展，必须放行。
(function (root) {
  "use strict";

  const WINDOW_MS = 72 * 60 * 60 * 1000;
  const PLANNED = /计划|准备|打算|约好|说好|约定|答应|将会|之后要|明天要|今晚要/;
  const RESOLVED = /已经|已完成|完成了|兑现|解决|取消|失败|没去成|改成|改为|最终|结果是/;

  function normalize(text) {
    return String(text || "").replace(/[\s，。、；：,.;:!！?？「」『』"'“”‘’（）()【】\-—]/g, "").toLowerCase();
  }
  function grams(text) {
    const s = normalize(text), out = new Set();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  }
  function similarity(a, b) {
    const x = grams(a), y = grams(b);
    if (!x.size || !y.size) return 0;
    let shared = 0;
    x.forEach(g => { if (y.has(g)) shared++; });
    return (2 * shared) / (x.size + y.size);
  }
  function sameRole(a, b) {
    const x = Array.isArray(a) ? a.filter(Boolean).map(String) : [];
    const y = Array.isArray(b) ? b.filter(Boolean).map(String) : [];
    if (!x.length || !y.length) return !x.length && !y.length;
    return x.some(id => y.includes(id));
  }
  function numberSignature(text) {
    return (String(text || "").match(/\d+(?:\.\d+)?%?/g) || []).sort().join("|");
  }
  function phase(text) {
    const planned = PLANNED.test(String(text || ""));
    const resolved = RESOLVED.test(String(text || ""));
    return resolved ? "resolved" : (planned ? "planned" : "fact");
  }
  function evidenceOverlap(a, b) {
    const x = new Set(Array.isArray(a) ? a.map(String) : []);
    const y = new Set(Array.isArray(b) ? b.map(String) : []);
    if (!x.size || !y.size) return 0;
    let shared = 0;
    x.forEach(id => { if (y.has(id)) shared++; });
    return shared / Math.min(x.size, y.size);
  }
  function evaluate(candidate, existing, now) {
    const a = candidate || {}, b = existing || {};
    if (!a.text || !b.text || (b.surfaceState || "active") !== "active" || b.archived) return { duplicate: false, reason: "ineligible" };
    if (!sameRole(a.charIds, b.charIds)) return { duplicate: false, reason: "different_role" };
    const at = Number(a.ts || now || Date.now()), bt = Number(b.ts || 0);
    if (!bt || Math.abs(at - bt) > WINDOW_MS) return { duplicate: false, reason: "outside_window" };
    const aNums = numberSignature(a.text), bNums = numberSignature(b.text);
    if (aNums !== bNums && (aNums || bNums)) return { duplicate: false, reason: "changed_numbers" };
    if (phase(a.text) !== phase(b.text)) return { duplicate: false, reason: "event_progressed" };
    const score = similarity(a.text, b.text);
    const evidence = evidenceOverlap(a.evidenceMessageIds, b.evidenceMessageIds);
    if (score >= 0.78) return { duplicate: true, reason: "near_text", score, evidence };
    if (score >= 0.45 && evidence >= 0.5) return { duplicate: true, reason: "same_evidence", score, evidence };
    return { duplicate: false, reason: "distinct", score, evidence };
  }
  function find(candidate, pool, now) {
    return (pool || []).find(row => evaluate(candidate, row, now).duplicate) || null;
  }
  function scan(rows) {
    const source = (rows || []).filter(x => x && x.id && x.source === "auto" && x.text && !x.archived && !x.pinned && !x.open && !x.supersedesId && !x.supersedes_id && (x.surfaceState || "active") === "active");
    const parent = new Map(source.map(x => [String(x.id), String(x.id)]));
    const rootOf = id => { let p = parent.get(id); while (p && p !== parent.get(p)) p = parent.get(p); return p || id; };
    const join = (a, b) => { const x = rootOf(a), y = rootOf(b); if (x !== y) parent.set(y, x); };
    const sorted = source.slice().sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
    for (let i = 0; i < sorted.length; i++) {
      for (let k = i - 1; k >= 0; k--) {
        if (Number(sorted[i].ts || 0) - Number(sorted[k].ts || 0) > WINDOW_MS) break;
        if (evaluate(sorted[i], sorted[k], sorted[i].ts).duplicate) join(String(sorted[i].id), String(sorted[k].id));
      }
    }
    const buckets = new Map();
    source.forEach(x => { const r = rootOf(String(x.id)); if (!buckets.has(r)) buckets.set(r, []); buckets.get(r).push(x); });
    return [...buckets.values()].filter(g => g.length > 1).map(g => {
      const ordered = g.slice().sort((a, b) => {
        const ae = (a.evidenceMessageIds || []).length, be = (b.evidenceMessageIds || []).length;
        return (String(b.text).length + be * 16 + Number(b.a || 0) * 2) - (String(a.text).length + ae * 16 + Number(a.a || 0) * 2) || Number(b.ts || 0) - Number(a.ts || 0);
      });
      const keep = ordered[0], archive = ordered.slice(1);
      const scores = archive.map(x => evaluate(x, keep, x.ts)).filter(x => x.duplicate);
      return { id: ordered.map(x => String(x.id)).sort().join("|"), keep, archive, confidence: scores.some(x => x.reason === "near_text" && x.score >= 0.85) ? "high" : "review" };
    }).sort((a, b) => Number(b.keep.ts || 0) - Number(a.keep.ts || 0));
  }

  const api = Object.freeze({ WINDOW_MS, normalize, similarity, evaluate, find, scan });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MemoryNearDuplicate = api;
})(typeof window !== "undefined" ? window : globalThis);
