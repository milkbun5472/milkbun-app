(function (root) {
  "use strict";

  const FORMAL_KINDS = new Set(["fact", "promise", "relationship", "insight"]);
  const MILESTONE_RE = /(我爱你|爱上你|做我的|在一起|结婚|订婚|分手|复合|成为恋人|正式交往|答应你|约好|约定|承诺|边界)/i;
  const messageId = (m, i) => String((m && (m.id || m.mid)) || (m && m.ts ? "ts_" + m.ts : "idx_" + i));

  function inspect(candidate, messages) {
    const x = candidate || {};
    const msgs = Array.isArray(messages) ? messages : [];
    const ids = Array.isArray(x.evidence_message_ids) ? x.evidence_message_ids.map(String) : [];
    const quotes = Array.isArray(x.evidence_quotes) ? x.evidence_quotes.map(v => String(v || "")) : [];
    const byId = new Map(msgs.map((m, i) => [messageId(m, i), String(m && m.content || "")]));

    if (!String(x.text || "").trim()) return { formal: false, reason: "missing_text", kind: "unknown" };
    if (!ids.length) return { formal: false, reason: "missing_ids", kind: String(x.kind || "unknown") };
    if (ids.length !== quotes.length) return { formal: false, reason: "misaligned_arrays", kind: String(x.kind || "unknown") };
    if (quotes.some(q => !q.trim())) return { formal: false, reason: "empty_quote", kind: String(x.kind || "unknown") };
    if (ids.some(id => !byId.has(id))) return { formal: false, reason: "missing_message", kind: String(x.kind || "unknown") };
    if (ids.some((id, i) => !byId.get(id).includes(quotes[i]))) return { formal: false, reason: "quote_mismatch", kind: String(x.kind || "unknown") };

    const milestone = MILESTONE_RE.test(String(x.text)) || quotes.some(q => MILESTONE_RE.test(q));
    const rawKind = String(x.kind || "unknown");
    const kind = milestone && rawKind === "temperature" ? "relationship" : rawKind;
    const proposed = String(x.proposed_action || "unknown");
    if (!FORMAL_KINDS.has(kind)) return { formal: false, reason: "non_formal_kind", kind, milestone };
    if (proposed !== "accept" && !milestone) return { formal: false, reason: "not_proposed_accept", kind, milestone };
    return { formal: true, reason: null, kind, milestone };
  }

  const api = { inspect, messageId };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MemoryExtractionGate = api;
})(typeof window !== "undefined" ? window : globalThis);
