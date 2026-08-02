(function (root) {
  "use strict";

  const FORMAL_KINDS = new Set(["fact", "promise", "relationship", "insight"]);
  const MILESTONE_RE = /(我爱你|爱上你|做我的|在一起|结婚|订婚|分手|复合|成为恋人|正式交往|答应你|约好|约定|承诺|边界)/i;
  const INSIGHT_TURN_RE = /原来|不是.{0,40}而是|才发现|后来才|直到.{0,40}才(?:发现|明白|意识到)|(?:以前|起初).{0,60}(?:以为|认为|觉得).{0,80}(?:后来|现在|如今)|重新理解|改变了看法|不再认为|意识到|终于明白|这才明白/i;
  const INSIGHT_REASON_RE = /因为|所以|因此|意味着|说明|可见|之所以|源于|导致|推得|由此|让我明白|让.{0,40}意识到/i;
  const messageId = (m, i) => String((m && (m.id || m.mid)) || (m && m.ts ? "ts_" + m.ts : "idx_" + i));
  const normalizedText = text => String(text || "").trim().replace(/\s+/g, " ").replace(/[。！？!?；;，,]/g, "");

  // 模型偶尔会抄坏消息 ID，但逐字 quote 仍真实存在。仅当 quote 在本轮
  // 恰好唯一命中一条消息时机械纠正 ID；零命中/多命中都维持原样交给闸拒绝。
  function normalizeEvidence(candidate, messages) {
    const x = candidate || {}, msgs = Array.isArray(messages) ? messages : [];
    const ids = Array.isArray(x.evidence_message_ids) ? x.evidence_message_ids.map(String) : [];
    const quotes = Array.isArray(x.evidence_quotes) ? x.evidence_quotes.map(v => String(v || "")) : [];
    if (!ids.length || ids.length !== quotes.length || quotes.some(q => !q.trim())) return x;
    const rows = msgs.map((m, i) => ({ id: messageId(m, i), text: String(m && m.content || "") }));
    const byId = new Map(rows.map(r => [r.id, r.text]));
    let changed = false;
    const repaired = ids.map((id, i) => {
      if (byId.has(id) && byId.get(id).includes(quotes[i])) return id;
      const hits = rows.filter(r => r.text.includes(quotes[i]));
      if (hits.length !== 1) return id;
      changed = true;
      return hits[0].id;
    });
    return changed ? Object.assign({}, x, { evidence_message_ids: repaired }) : x;
  }

  function inspect(candidate, messages) {
    const x = normalizeEvidence(candidate, messages);
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
    if (kind === "insight") {
      const evidenceText = quotes.join(" ");
      const synthesized = String(x.text || "").trim().length >= 12 && !quotes.some(q => normalizedText(q) === normalizedText(x.text));
      const evidencePair = new Set(ids).size >= 2 && quotes.length >= 2;
      if (!synthesized || !evidencePair || !INSIGHT_REASON_RE.test(evidenceText) || !INSIGHT_TURN_RE.test(evidenceText)) {
        return { formal: false, reason: "insight_structure_incomplete", kind, milestone };
      }
    }
    return { formal: true, reason: null, kind, milestone };
  }

  const api = { inspect, messageId, normalizeEvidence };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MemoryExtractionGate = api;
})(typeof window !== "undefined" ? window : globalThis);
