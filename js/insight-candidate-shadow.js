// ============================================================
// InsightCapture · 独立洞察候选结构 shadow（v49.32）
// 复用现有记忆抽取的 insight 分类，旁路检查结论/推导/转折/原始金句；
// 不保存正文、不写正式记忆/洞察表、不增加 AI 请求。
// ============================================================
(function () {
  "use strict";
  const DB_NAME = "lisa_insight_candidate_shadow_v1", DB_VERSION = 1, CAP = 500, KEEP_MS = 14 * 86400000, AUDIT_VERSION = 2;
  let dbPromise = null;
  const hash = value => { let h = 5381; const s = String(value == null ? "" : value); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
  const messageId = (m, i) => String((m && (m.id || m.mid)) || (m && m.ts ? "ts_" + m.ts : "idx_" + i));
  // 转折必须是“理解发生了改变”，不能再拿普通因果词「所以/因此」冒充。
  const turnCue = text => /原来|不是.{0,40}而是|才发现|后来才|直到.{0,40}才|起初.{0,80}后来|从.{0,40}变成|重新理解|改口|意识到|终于明白|这才明白|没想到/i.test(String(text || ""));
  const reasoningCue = text => /因为|所以|因此|意味着|说明|可见|之所以|源于|导致|推得|由此|让我明白|让.{0,40}意识到/i.test(String(text || ""));
  const normalized = text => String(text || "").trim().replace(/\s+/g," ").replace(/[。！？!?；;，,]/g,"");

  function structureCandidate(candidate, messages, acceptedTexts) {
    const msgs = Array.isArray(messages) ? messages : [], byId = new Map(msgs.map((m, i) => [messageId(m, i), m]));
    const ids = Array.isArray(candidate && candidate.evidence_message_ids) ? candidate.evidence_message_ids.map(String) : [];
    const quotes = Array.isArray(candidate && candidate.evidence_quotes) ? candidate.evidence_quotes.map(String) : [];
    const aligned = ids.length > 0 && ids.length === quotes.length;
    const quoteValid = aligned && ids.every((id, i) => byId.has(id) && quotes[i].trim().length > 0 && String(byId.get(id).content || "").includes(quotes[i]));
    const roles = new Set(ids.map(id => byId.get(id) && byId.get(id).role).filter(Boolean));
    const conclusion=String(candidate && candidate.text || "").trim(),combined = [conclusion].concat(quotes).join(" ");
    const conclusionPresent = conclusion.length >= 12;
    const conclusionSynthesized = conclusionPresent && !quotes.some(q=>normalized(q)===normalized(conclusion));
    const derivationPresent = reasoningCue(combined);
    const turningPointPresent = turnCue(combined);
    const originalQuotePresent = quoteValid && quotes.length > 0;
    const strictReady = conclusionPresent && conclusionSynthesized && originalQuotePresent && derivationPresent && turningPointPresent;
    const accepted = new Set((acceptedTexts || []).map(x => String(x || "").trim()));
    const leakedIntoMemory=accepted.has(conclusion),missing=[];
    if(!conclusionPresent)missing.push("conclusion");if(conclusionPresent&&!conclusionSynthesized)missing.push("synthesis");if(!originalQuotePresent)missing.push("quote");if(!derivationPresent)missing.push("derivation");if(!turningPointPresent)missing.push("turning_point");
    return { auditVersion:AUDIT_VERSION,candidateHash: hash(candidate && candidate.text), conclusionPresent,conclusionSynthesized, derivationPresent, turningPointPresent,
      originalQuotePresent, quoteValid, evidenceCount: ids.length, roleCount: roles.size, ready:strictReady,strictReady,missing,
      leakedIntoMemory,unsafeOrdinaryLeak:leakedIntoMemory&&!strictReady,messageIdHashes: ids.map(hash) };
  }
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("batches")) req.result.createObjectStore("batches", { keyPath: "_id", autoIncrement: true }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("insight candidate shadow open failed"));
    });
    return dbPromise;
  }
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = tx => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
  async function observeBatch(input) {
    try {
      const candidates = (input && input.candidates || []).filter(x => x && x.kind === "insight" && x.text);
      if (!candidates.length) return;
      const rows = candidates.map(x => structureCandidate(x, input && input.messages, input && input.acceptedTexts));
      const now = Date.now(), db = await openDB(), tx = db.transaction("batches", "readwrite"), store = tx.objectStore("batches");
      store.add({ auditVersion:AUDIT_VERSION,t: now, c: hash(input && input.charId), count: rows.length, rows }); await done(tx);
      if (Math.random() < 0.1) {
        const tx2 = db.transaction("batches", "readwrite"), s2 = tx2.objectStore("batches"), all = await rq(s2.getAll());
        all.filter(x => x.t < now - KEEP_MS).forEach(x => s2.delete(x._id));
        all.slice(0, Math.max(0, all.length - CAP)).forEach(x => s2.delete(x._id)); await done(tx2);
      }
    } catch (e) {/* 洞察旁路不能影响记忆抽取 */}
  }
  async function report(n) {
    try {
      const db = await openDB(), tx = db.transaction("batches", "readonly"), all = await rq(tx.objectStore("batches").getAll()); await done(tx);
      const selected=all.slice(-(n || 200)),legacySamples=selected.filter(x=>Number(x.auditVersion||1)<AUDIT_VERSION).length,batches=selected.filter(x=>Number(x.auditVersion||1)===AUDIT_VERSION),rows = batches.flatMap(x => x.rows || []),missingReasons={};
      rows.flatMap(x=>x.missing||[]).forEach(reason=>{missingReasons[reason]=(missingReasons[reason]||0)+1;});
      const rate = key => rows.length ? Math.round(rows.filter(x => x[key]).length * 100 / rows.length) / 100 : 0;
      const firstObservedAt=batches.length?Number(batches[0].t)||null:null,lastObservedAt=batches.length?Number(batches[batches.length-1].t)||null:null;
      return { auditVersion:AUDIT_VERSION,legacySamples,batches: batches.length,firstObservedAt,lastObservedAt,spanHours:firstObservedAt&&lastObservedAt?Math.round((lastObservedAt-firstObservedAt)/36000)/100:0, candidates: rows.length, readyRate: rate("strictReady"), validQuoteRate: rate("quoteValid"),
        derivationRate: rate("derivationPresent"), turningPointRate: rate("turningPointPresent"),
        synthesisRate:rate("conclusionSynthesized"),ordinaryMemoryLeakRate: rate("leakedIntoMemory"),unsafeOrdinaryLeakRate:rate("unsafeOrdinaryLeak"),missingReasons,last: rows.slice(-10) };
    } catch (e) { return { error: "独立洞察候选审计读取失败" }; }
  }
  async function clearAll() { try { const db = await openDB(), tx = db.transaction("batches", "readwrite"); tx.objectStore("batches").clear(); await done(tx); } catch (e) {} }
  window.InsightCandidateShadow = { structureCandidate, observeBatch, report, clearAll };
})();
