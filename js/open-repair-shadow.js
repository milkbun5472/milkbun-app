// ============================================================
// Ecosystem · RepairGate P2-1（v49.27）
// 只收集“某条 open 可能已完成/解决/明确放弃”的逐字证据候选。
// 不关闭 open、不写云表、不注入聊天；候选仅存本机 IndexedDB。
// ============================================================
(function () {
  "use strict";
  const DB_NAME = "lisa_open_repair_shadow_v1", DB_VERSION = 1;
  const KINDS = ["fulfilled", "resolved", "abandoned"];
  let dbPromise = null;
  const clean = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
  const hash = value => { let h = 5381; const s = String(value == null ? "" : value); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
  const messageId = (m, i) => clean((m && (m.id || m.mid)) || (m && m.ts ? "ts_" + m.ts : "idx_" + i), 160);
  function evidenceMessages(messages) {
    return (Array.isArray(messages) ? messages : []).filter(m => m && m.content && (m.role === "assistant" || m.role === "user") && !m.recalled && !["ooc", "system", "offlinelog", "thought", "thinking"].includes(m.kind))
      .map((m, i) => ({ id: messageId(m, i), role: m.role, text: String(m.content) }));
  }
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("candidates")) req.result.createObjectStore("candidates", { keyPath: "key" }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("repair shadow open failed"));
    });
    return dbPromise;
  }
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = tx => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
  function validateCandidates(raw, opens, messages) {
    const msgs = evidenceMessages(messages), byId = new Map(msgs.map(m => [m.id, m]));
    return (Array.isArray(raw) ? raw : []).map(c => {
      const digits = clean(c && c.resolveOpen, 30).replace(/[^0-9]/g, ""), n = digits ? parseInt(digits, 10) : NaN;
      const old = n >= 1 && n <= opens.length ? opens[n - 1] : null;
      const kind = clean(c && c.repair_kind, 20);
      if (!old || !old.id || !KINDS.includes(kind)) return null;
      const ids = Array.isArray(c.evidence_message_ids) ? c.evidence_message_ids : [];
      const quotes = Array.isArray(c.evidence_quotes) ? c.evidence_quotes : [];
      if (!ids.length || ids.length !== quotes.length) return null;
      const evidence = ids.slice(0, 3).map((id, i) => {
        const mid = clean(id, 160), quote = clean(quotes[i], 180), source = byId.get(mid);
        return source && quote && source.text.indexOf(quote) >= 0 ? { messageId: mid, quote, role: source.role } : null;
      }).filter(Boolean);
      if (!evidence.length || evidence.length !== Math.min(3, ids.length)) return null;
      return { oldMemoryId: String(old.id), kind, evidence };
    }).filter(Boolean);
  }
  async function observe(input) {
    try {
      const opens = Array.isArray(input && input.openEntries) ? input.openEntries : [];
      const raw = Array.isArray(input && input.candidates) ? input.candidates : [];
      const valid = validateCandidates(raw, opens, input && input.messages);
      const db = await openDB(), now = Date.now(), charHash = hash(input && input.charId);
      for (const c of valid) {
        const key = charHash + "|" + c.oldMemoryId + "|" + hash(c.evidence.map(e => e.messageId + e.quote).join("|"));
        const tx = db.transaction("candidates", "readwrite"), store = tx.objectStore("candidates"), prev = await rq(store.get(key));
        store.put({ ...c, key, charHash, firstSeenAt: prev && prev.firstSeenAt || now, lastSeenAt: now, seenCount: Number(prev && prev.seenCount || 0) + 1, status: "shadow_only" });
        await done(tx);
      }
      return { accepted: valid.length, rejected: Math.max(0, raw.length - valid.length) };
    } catch (e) { return { accepted: 0, error: "RepairGate shadow failed" }; }
  }
  async function report() {
    try {
      const db = await openDB(), tx = db.transaction("candidates", "readonly"), rows = await rq(tx.objectStore("candidates").getAll()); await done(tx);
      return { candidates: rows.length, fulfilled: rows.filter(x => x.kind === "fulfilled").length, resolved: rows.filter(x => x.kind === "resolved").length, abandoned: rows.filter(x => x.kind === "abandoned").length,
        last: rows.sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0)).slice(0, 20) };
    } catch (e) { return { error: "RepairGate 报表读取失败" }; }
  }
  async function clearAll() { try { const db = await openDB(), tx = db.transaction("candidates", "readwrite"); tx.objectStore("candidates").clear(); await done(tx); } catch (e) {} }
  window.OpenRepairShadow = { observe, report, clearAll, evidenceMessages, _validateCandidates: validateCandidates };
})();
