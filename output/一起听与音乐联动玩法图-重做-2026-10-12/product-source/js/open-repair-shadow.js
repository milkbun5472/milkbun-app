// ============================================================
// Ecosystem · RepairGate（v51.48 live）
// 机械核验“某条 open 已完成/解决/明确放弃”的逐字证据。
// 候选账本继续只存 hash；核验通过的 memory id + 结局交给 App 做行级软闭环。
// ============================================================
(function () {
  "use strict";
  const DB_NAME = "lisa_open_repair_shadow_v1", DB_VERSION = 3, CAP = 500, MAX_AGE = 14 * 86400000;
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
      req.onupgradeneeded = event => {
        // v1 曾存逐字 quote；诊断可重建，升级时直接销毁旧候选，确保正文不残留。
        if (event.oldVersion < 2 && req.result.objectStoreNames.contains("candidates")) req.result.deleteObjectStore("candidates");
        if (!req.result.objectStoreNames.contains("candidates")) req.result.createObjectStore("candidates", { keyPath: "key" });
        if (!req.result.objectStoreNames.contains("decisions")) req.result.createObjectStore("decisions", { keyPath: "oldMemoryId" });
      };
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
  function safeResolutions(valid) {
    const grouped = new Map();
    (Array.isArray(valid) ? valid : []).forEach(x => {
      if (!x || !x.oldMemoryId || !KINDS.includes(x.kind)) return;
      const id=String(x.oldMemoryId), set=grouped.get(id)||new Set(); set.add(x.kind); grouped.set(id,set);
    });
    return [...grouped.entries()].filter(([,set])=>set.size===1).map(([oldMemoryId,set])=>({oldMemoryId,kind:[...set][0]}));
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
        const safeEvidence = c.evidence.map(e => ({ messageIdHash: hash(e.messageId), quoteHash: hash(e.quote), quoteLength: e.quote.length, role: e.role }));
        store.put({ oldMemoryId: c.oldMemoryId, kind: c.kind, evidence: safeEvidence, key, charHash, firstSeenAt: prev && prev.firstSeenAt || now, lastSeenAt: now, seenCount: Number(prev && prev.seenCount || 0) + 1, status: "shadow_only" });
        await done(tx);
      }
      await trim(now);
      return {
        accepted: valid.length,
        rejected: Math.max(0, raw.length - valid.length),
        // 同一条在本轮出现两个不同结局时绝不“最后一个获胜”；留给人工冲突台。
        resolutions: safeResolutions(valid)
      };
    } catch (e) { return { accepted: 0, resolutions: [], error: "RepairGate failed" }; }
  }
  async function trim(nowValue) {
    try {
      const db = await openDB(), tx = db.transaction("candidates", "readwrite"), store = tx.objectStore("candidates"), rows = await rq(store.getAll());
      const cutoff = (Number(nowValue) || Date.now()) - MAX_AGE; rows.sort((a,b)=>Number(a.lastSeenAt||0)-Number(b.lastSeenAt||0));
      rows.filter(x=>Number(x.lastSeenAt||0)<cutoff).forEach(x=>store.delete(x.key));
      const live=rows.filter(x=>Number(x.lastSeenAt||0)>=cutoff); live.slice(0,Math.max(0,live.length-CAP)).forEach(x=>store.delete(x.key)); await done(tx);
    } catch (e) {}
  }
  function summarizeRows(inputRows) {
    const rows = Array.isArray(inputRows) ? inputRows : [];
    const byMemory = new Map();
    rows.forEach(row => {
      const id = String(row && row.oldMemoryId || "");
      if (!id) return;
      const item = byMemory.get(id) || { rows: 0, kinds: new Set(), seen: 0 };
      item.rows += 1;
      if (KINDS.includes(row.kind)) item.kinds.add(row.kind);
      item.seen += Math.max(1, Number(row.seenCount || 0));
      byMemory.set(id, item);
    });
    const groups = [...byMemory.values()];
    return {
      uniqueOpenMemories: byMemory.size,
      repeatedOpenMemories: groups.filter(x => x.rows > 1 || x.seen > 1).length,
      duplicateEvidenceRows: Math.max(0, rows.length - byMemory.size),
      repeatedObservations: Math.max(0, groups.reduce((n, x) => n + x.seen, 0) - rows.length),
      outcomeConflicts: groups.filter(x => x.kinds.size > 1).length
    };
  }
  function applyResolutions(entries, resolutions, nowValue) {
    const outcomes = new Map((Array.isArray(resolutions) ? resolutions : [])
      .filter(x => x && x.oldMemoryId && KINDS.includes(x.kind))
      .map(x => [String(x.oldMemoryId), x.kind]));
    const resolvedAt = Number(nowValue) || Date.now(); let closed = 0;
    const next = (Array.isArray(entries) ? entries : []).map(e => {
      const kind = e && outcomes.get(String(e.id));
      if (!kind || !e.open) return e;
      closed++;
      return Object.assign({}, e, {
        open: false,
        openResolvedTs: resolvedAt,
        openResolutionKind: kind,
        openResolvedBy: "repair_gate"
      });
    });
    return { entries: next, closed };
  }
  async function report() {
    try {
      const db = await openDB(), tx = db.transaction("candidates", "readonly"), rows = await rq(tx.objectStore("candidates").getAll()); await done(tx);
      const firstObservedAt=rows.length?Math.min(...rows.map(x=>Number(x.firstSeenAt)||Infinity)):null,lastObservedAt=rows.length?Math.max(...rows.map(x=>Number(x.lastSeenAt)||0)):null;
      return { candidates: rows.length,...summarizeRows(rows),firstObservedAt:Number.isFinite(firstObservedAt)?firstObservedAt:null,lastObservedAt:lastObservedAt||null,spanHours:Number.isFinite(firstObservedAt)&&lastObservedAt?Math.round((lastObservedAt-firstObservedAt)/36000)/100:0, fulfilled: rows.filter(x => x.kind === "fulfilled").length, resolved: rows.filter(x => x.kind === "resolved").length, abandoned: rows.filter(x => x.kind === "abandoned").length,
        last: rows.sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0)).slice(0, 20) };
    } catch (e) { return { error: "RepairGate 报表读取失败" }; }
  }
  async function listConflicts() {
    try {
      const db=await openDB(),tx=db.transaction(["candidates","decisions"],"readonly");
      const rows=await rq(tx.objectStore("candidates").getAll()),decisions=await rq(tx.objectStore("decisions").getAll());await done(tx);
      const decided=new Set(decisions.map(x=>String(x.oldMemoryId))),groups=new Map();
      rows.forEach(row=>{const id=String(row&&row.oldMemoryId||"");if(!id||decided.has(id)||!KINDS.includes(row.kind))return;const g=groups.get(id)||{oldMemoryId:id,kinds:{},observations:0,firstSeenAt:null,lastSeenAt:null};g.kinds[row.kind]=(g.kinds[row.kind]||0)+Math.max(1,Number(row.seenCount||0));g.observations+=Math.max(1,Number(row.seenCount||0));const f=Number(row.firstSeenAt||0),l=Number(row.lastSeenAt||0);g.firstSeenAt=!g.firstSeenAt||f<g.firstSeenAt?f:g.firstSeenAt;g.lastSeenAt=!g.lastSeenAt||l>g.lastSeenAt?l:g.lastSeenAt;groups.set(id,g);});
      return [...groups.values()].filter(g=>Object.keys(g.kinds).length>1).sort((a,b)=>b.lastSeenAt-a.lastSeenAt);
    } catch(e){return [];}
  }
  async function decideConflict(oldMemoryId, decision) {
    const allowed=["keep_open",...KINDS];if(!allowed.includes(decision))throw new Error("invalid repair conflict decision");
    const db=await openDB(),tx=db.transaction("decisions","readwrite");tx.objectStore("decisions").put({oldMemoryId:String(oldMemoryId),decision,decidedAt:Date.now()});await done(tx);return true;
  }
  async function clearAll() { try { const db = await openDB(), tx = db.transaction(["candidates","decisions"], "readwrite"); tx.objectStore("candidates").clear(); tx.objectStore("decisions").clear(); await done(tx); } catch (e) {} }
  window.OpenRepairShadow = { observe, report, listConflicts, decideConflict, clearAll, evidenceMessages, applyResolutions, _validateCandidates: validateCandidates, _summarizeRows: summarizeRows, _safeResolutions: safeResolutions };
})();
