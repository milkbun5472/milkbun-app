// ============================================================
// Memory v2 影子脊柱（v59.74）
// 四种原语 + 一个证据闸 + 召回/拼装收据。只观察，不写真实记忆、不改 prompt。
// 落盘仅含计数、类别、布尔值与不可逆短 hash；不含聊天正文、候选正文或 query。
// ============================================================
(function () {
  "use strict";
  const DB_NAME = "lisa_memory_v2_shadow_v1";
  const DB_VERSION = 1;
  const AUDIT_VERSION = 1;
  const CAP = 1200;
  const KEEP_MS = 14 * 86400000;
  const SOFT_BUDGET = 16000;
  const PRIMITIVES = Object.freeze(["episode", "claim", "state", "hypothesis"]);
  const LANE_CAPS = Object.freeze({ rules: 2800, identity: 4000, state: 1600, episodes: 1600, claims: 2400, recent: 3600 });
  let dbPromise = null;
  let writes = 0;

  const hash = value => {
    let h = 5381;
    const s = String(value == null ? "" : value);
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  };
  const messageId = (message, index) => String((message && (message.id || message.mid)) || (message && message.ts ? "ts_" + message.ts : "idx_" + index));
  const countBy = (rows, key) => rows.reduce((out, row) => {
    const value = typeof key === "function" ? key(row) : row && row[key];
    if (value != null && value !== "") out[value] = (out[value] || 0) + 1;
    return out;
  }, {});
  const addCounts = (target, source) => Object.keys(source || {}).forEach(key => { target[key] = (target[key] || 0) + Number(source[key] || 0); });

  function routeCandidate(candidate) {
    const row = candidate || {};
    if (row.resolveOpen != null) return { primitive: "claim", subtype: "open_transition" };
    if (row.kind === "temperature") return { primitive: "state", subtype: "temperature" };
    if (row.kind === "insight") return { primitive: "hypothesis", subtype: "persona_insight" };
    if (row.kind === "promise") return { primitive: "claim", subtype: "promise" };
    if (row.kind === "relationship") return { primitive: "claim", subtype: "relationship" };
    if (row.kind === "fact") {
      const tags = Array.isArray(row.tags) ? row.tags.join("|") : "";
      return /事件|经历|里程碑|第一次|纪念/.test(tags)
        ? { primitive: "episode", subtype: "event" }
        : { primitive: "claim", subtype: "fact" };
    }
    return { primitive: "claim", subtype: "untyped" };
  }

  function inspectEvidence(candidate, messages) {
    const row = candidate || {};
    const source = Array.isArray(messages) ? messages : [];
    const byId = new Map(source.map((message, index) => [messageId(message, index), String(message && message.content || "")]));
    const ids = Array.isArray(row.evidence_message_ids) ? row.evidence_message_ids.map(String) : [];
    const quotes = Array.isArray(row.evidence_quotes) ? row.evidence_quotes.map(String) : [];
    let reason = null;
    if (!ids.length) reason = "missing_evidence";
    else if (ids.length !== quotes.length) reason = "misaligned_evidence";
    else if (quotes.some(quote => !quote.trim())) reason = "empty_quote";
    else if (ids.some(id => !byId.has(id))) reason = "unknown_message";
    else if (ids.some((id, index) => byId.get(id).indexOf(quotes[index]) < 0)) reason = "quote_mismatch";
    return { valid: reason === null, reason, count: ids.length, messageHashes: ids.map(hash) };
  }

  function inspectCandidate(candidate, messages, acceptedTexts, options) {
    const row = candidate || {};
    const route = routeCandidate(row);
    const evidence = inspectEvidence(row, messages);
    const accepted = acceptedTexts instanceof Set ? acceptedTexts : new Set((acceptedTexts || []).map(text => String(text || "").trim()));
    const isRepair = row.resolveOpen != null;
    const hasPayload = isRepair || !!String(row.text || "").trim();
    const branchValid = !options || options.branchValid !== false;
    const reasons = [];
    if (!hasPayload) reasons.push("missing_payload");
    if (!evidence.valid) reasons.push(evidence.reason);
    if (!branchValid) reasons.push("stale_branch");
    if (row.proposed_action === "reject") reasons.push("model_reject");
    let decision = "admit";
    if (reasons.length) decision = "reject";
    else if (route.primitive === "state") decision = "state_only";
    else if (route.primitive === "hypothesis") decision = "review";
    else if (isRepair) decision = "transition";
    const legacyAccepted = !isRepair && accepted.has(String(row.text || "").trim());
    return {
      primitive: route.primitive,
      subtype: route.subtype,
      decision,
      reasons,
      evidenceValid: evidence.valid,
      evidenceCount: evidence.count,
      evidenceMessageHashes: evidence.messageHashes,
      payloadHash: hash(isRepair ? "repair:" + String(row.resolveOpen) : row.text),
      branchValid,
      legacyAccepted,
      disagreement: legacyAccepted !== (decision === "admit")
    };
  }

  function classifyLane(text) {
    const first = (String(text || "").split("\n")[0] || "").slice(0, 160);
    if (/最近对话|对话连贯/.test(first)) return "recent";
    if (/记忆库|长期记忆摘要|承诺|约定|关系网/.test(first)) return "claims";
    if (/群里|线下|礼物往来|一起听|第一次|纪念|共同经历/.test(first)) return "episodes";
    if (/当前真实时间|所在地|当前位置|好感度|心情|行程|朋友圈|论坛|手机上的近况|生理期|特别日子|备忘录|记账动态|天气/.test(first)) return "state";
    if (/角色人设|长出来的自我|交谈的人|现在是恋人|情侣邀请|人格|性格/.test(first)) return "identity";
    return "rules";
  }

  function planComposition(parts, budget) {
    const source = (parts || []).map(text => String(text || ""));
    const requestedBudget = Math.max(1, Number(budget) || SOFT_BUDGET);
    const scale = requestedBudget / SOFT_BUDGET;
    const remaining = Object.fromEntries(Object.entries(LANE_CAPS).map(([lane, cap]) => [lane, Math.floor(cap * scale)]));
    const lanes = {};
    const blocks = source.map((text, index) => {
      const lane = classifyLane(text), chars = text.length;
      lanes[lane] = (lanes[lane] || 0) + chars;
      const proposedChars = Math.min(chars, Math.max(0, remaining[lane] || 0));
      remaining[lane] = Math.max(0, (remaining[lane] || 0) - proposedChars);
      return { index, lane, chars, proposedChars, trimChars: chars - proposedChars };
    });
    const totalChars = blocks.reduce((sum, block) => sum + block.chars, 0);
    const proposedChars = blocks.reduce((sum, block) => sum + block.proposedChars, 0);
    return {
      budget: requestedBudget,
      totalChars,
      proposedChars,
      pressure: totalChars > requestedBudget,
      lanes,
      blocks,
      orderPreserved: blocks.every((block, index) => block.index === index)
    };
  }

  function intentMode(queryText) {
    const query = String(queryText || "");
    if (/哪(天|次|年|月)|什么时候|原话|具体|当时|之前.*说|记不记得.*(说|做)|到底.*(说|做)/i.test(query)) return "precise";
    if (/最近|现在|这阵子|近况|今天|今晚|目前/i.test(query)) return "state";
    return "impression";
  }

  const memoryHash = entry => hash(entry && (entry.id != null ? entry.id : [entry.text, entry.ts, entry.source].join("|")));
  function makeRetrievalReceipt(input) {
    const data = input || {};
    const pinned = Array.isArray(data.pinned) ? data.pinned : [];
    const relevant = Array.isArray(data.relevant) ? data.relevant : [];
    const picked = Array.isArray(data.picked) ? data.picked : [];
    const selectedHashes = picked.map(memoryHash);
    return {
      auditVersion: AUDIT_VERSION,
      kind: "retrieval",
      t: Number(data.t) || Date.now(),
      charHash: hash(data.charId),
      source: String(data.source || "unknown").slice(0, 24),
      mode: data.mode || intentMode(data.queryText),
      candidateCount: Number(data.candidateCount) || relevant.length + pinned.length,
      pinnedCount: pinned.length,
      relevantCount: relevant.length,
      selectedCount: picked.length,
      openSelectedCount: picked.filter(entry => entry && entry.open).length,
      pinnedSelectedCount: picked.filter(entry => entry && entry.pinned).length,
      duplicateSelections: selectedHashes.length - new Set(selectedHashes).size,
      selectedHashes
    };
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("audit")) req.result.createObjectStore("audit", { keyPath: "_id", autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("memory v2 shadow open failed"));
    });
    return dbPromise;
  }
  const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  const done = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });

  async function trim(now) {
    const db = await openDB(), tx = db.transaction("audit", "readwrite"), store = tx.objectStore("audit");
    const rows = await request(store.getAll()), drop = new Set(), cutoff = now - KEEP_MS;
    rows.forEach(row => { if ((row.t || 0) < cutoff) drop.add(row._id); });
    for (let i = 0; i < rows.length && rows.length - drop.size > CAP; i++) drop.add(rows[i]._id);
    drop.forEach(key => store.delete(key));
    await done(tx);
  }

  async function append(row) {
    try {
      const db = await openDB(), tx = db.transaction("audit", "readwrite");
      tx.objectStore("audit").add(row);
      await done(tx);
      writes += 1;
      if (writes % 20 === 0) await trim(Date.now());
    } catch (e) {/* 统一影子审计绝不阻断聊天 */}
  }

  async function observeExtraction(input) {
    try {
      const data = input || {}, messages = Array.isArray(data.messages) ? data.messages : [];
      const liveMessages = Array.isArray(data.liveMessages) ? data.liveMessages : messages;
      const accepted = new Set((data.acceptedTexts || []).map(text => String(text || "").trim()));
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      const rows = candidates.map(candidate => {
        let branchValid = true;
        try {
          if (candidate && candidate.resolveOpen == null && window.RerollBranch && window.RerollBranch.candidateStillLive) branchValid = window.RerollBranch.candidateStillLive(candidate, liveMessages);
        } catch (e) { branchValid = false; }
        return inspectCandidate(candidate, messages, accepted, { branchValid });
      });
      const reasons = {};
      rows.forEach(row => row.reasons.forEach(reason => { reasons[reason] = (reasons[reason] || 0) + 1; }));
      await append({
        auditVersion: AUDIT_VERSION,
        kind: "admission",
        t: Date.now(),
        charHash: hash(data.charId),
        candidateCount: rows.length,
        routes: countBy(rows, "primitive"),
        decisions: countBy(rows, "decision"),
        reasons,
        evidenceValidCount: rows.filter(row => row.evidenceValid).length,
        legacyAcceptedCount: rows.filter(row => row.legacyAccepted).length,
        disagreementCount: rows.filter(row => row.disagreement).length,
        candidates: rows.slice(0, 30)
      });
    } catch (e) {/* 统一影子审计绝不阻断入库 */}
  }

  async function observeRetrieval(input) {
    try { await append(makeRetrievalReceipt(input)); } catch (e) {/* 统一影子审计绝不阻断召回 */}
  }

  async function observeComposition(input) {
    try {
      const data = input || {}, plan = planComposition(data.parts, data.budget);
      await append({
        auditVersion: AUDIT_VERSION,
        kind: "composition",
        t: Date.now(),
        charHash: hash(data.charId),
        budget: plan.budget,
        totalChars: plan.totalChars,
        proposedChars: plan.proposedChars,
        pressure: plan.pressure,
        lanes: plan.lanes,
        blockCount: plan.blocks.length,
        orderPreserved: plan.orderPreserved
      });
    } catch (e) {/* 统一影子审计绝不阻断上下文拼装 */}
  }

  function summarizeRows(rows) {
    const current = (rows || []).filter(row => Number(row.auditVersion) === AUDIT_VERSION);
    const admissionRows = current.filter(row => row.kind === "admission");
    const retrievalRows = current.filter(row => row.kind === "retrieval");
    const compositionRows = current.filter(row => row.kind === "composition");
    const routes = {}, decisions = {}, reasons = {}, lanes = {};
    admissionRows.forEach(row => { addCounts(routes, row.routes); addCounts(decisions, row.decisions); addCounts(reasons, row.reasons); });
    compositionRows.forEach(row => addCounts(lanes, row.lanes));
    const avg = (list, key) => list.length ? Math.round(list.reduce((sum, row) => sum + Number(row[key] || 0), 0) / list.length) : 0;
    const firstObservedAt = current.length ? Number(current[0].t) || null : null;
    const lastObservedAt = current.length ? Number(current[current.length - 1].t) || null : null;
    Object.keys(lanes).forEach(lane => { lanes[lane] = compositionRows.length ? Math.round(lanes[lane] / compositionRows.length) : 0; });
    return {
      auditVersion: AUDIT_VERSION,
      schema: "lisa-memory-v2-shadow-v1",
      mode: "shadow",
      changedLiveBehavior: false,
      containsText: false,
      primitives: PRIMITIVES.slice(),
      firstObservedAt,
      lastObservedAt,
      spanHours: firstObservedAt && lastObservedAt ? Math.round((lastObservedAt - firstObservedAt) / 36000) / 100 : 0,
      observations: current.length,
      legacySamples: (rows || []).length - current.length,
      admission: {
        batches: admissionRows.length,
        candidates: admissionRows.reduce((sum, row) => sum + Number(row.candidateCount || 0), 0),
        routes,
        decisions,
        reasons,
        evidenceValid: admissionRows.reduce((sum, row) => sum + Number(row.evidenceValidCount || 0), 0),
        legacyAccepted: admissionRows.reduce((sum, row) => sum + Number(row.legacyAcceptedCount || 0), 0),
        disagreements: admissionRows.reduce((sum, row) => sum + Number(row.disagreementCount || 0), 0)
      },
      retrieval: {
        receipts: retrievalRows.length,
        modes: countBy(retrievalRows, "mode"),
        avgCandidates: avg(retrievalRows, "candidateCount"),
        avgSelected: avg(retrievalRows, "selectedCount"),
        pinnedProtected: retrievalRows.reduce((sum, row) => sum + Number(row.pinnedSelectedCount || 0), 0),
        openProtected: retrievalRows.reduce((sum, row) => sum + Number(row.openSelectedCount || 0), 0),
        duplicateSelections: retrievalRows.reduce((sum, row) => sum + Number(row.duplicateSelections || 0), 0)
      },
      composition: {
        receipts: compositionRows.length,
        softBudget: SOFT_BUDGET,
        laneCaps: { ...LANE_CAPS },
        avgTotalChars: avg(compositionRows, "totalChars"),
        avgProposedChars: avg(compositionRows, "proposedChars"),
        pressureRate: compositionRows.length ? Math.round(compositionRows.filter(row => row.pressure).length * 100 / compositionRows.length) / 100 : 0,
        orderViolationCount: compositionRows.filter(row => row.orderPreserved === false).length,
        avgLaneChars: lanes
      }
    };
  }

  async function report(limit) {
    try {
      const db = await openDB(), tx = db.transaction("audit", "readonly"), rows = await request(tx.objectStore("audit").getAll());
      await done(tx);
      return summarizeRows(rows.slice(-(limit || 500)));
    } catch (e) { return { error: "Memory v2 统一影子审计读取失败" }; }
  }

  async function clearAll() {
    try {
      const db = await openDB(), tx = db.transaction("audit", "readwrite");
      tx.objectStore("audit").clear();
      await done(tx);
      writes = 0;
    } catch (e) {}
  }

  window.MemoryV2Shadow = Object.freeze({
    AUDIT_VERSION, PRIMITIVES, SOFT_BUDGET, LANE_CAPS,
    routeCandidate, inspectEvidence, inspectCandidate, classifyLane, planComposition, intentMode, makeRetrievalReceipt,
    observeExtraction, observeRetrieval, observeComposition, summarizeRows, report, clearAll
  });
})();
