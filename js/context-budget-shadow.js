// ============================================================
// 玄参 Persona Hub · 统一上下文预算（v51.51）
// 先 shadow 丈量；通过观察期后只按原 bundle 顺序裁长度，不调用 AI。
// ============================================================
(function () {
  "use strict";
  const DB_NAME = "lisa_context_budget_shadow_v1", DB_VERSION = 1, CAP = 500, KEEP_MS = 14 * 86400000, AUDIT_VERSION = 2;
  const SOFT_BUDGET = 12000;
  // 总和恰好 12k。身份根基获得最大份额；bundle 原顺序是铁律，绝不按类别重排。
  const CATEGORY_CAPS = Object.freeze({
    rules:2200, identity_relation:3800, lore:1400, memory:1500,
    live_state:1100, shared_history:900, recent_chat:1100
  });
  const lastByChar = new Map();
  let dbPromise = null;
  const hash = value => { let h = 5381; const s = String(value == null ? "" : value); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };

  function classify(text) {
    const s = String(text || ""), first = (s.split("\n")[0] || "").slice(0, 120);
    if (/最近对话/.test(first)) return "recent_chat";
    if (/记忆库|长期记忆摘要/.test(first)) return "memory";
    if (/角色人设|长出来的自我|交谈的人|关系网|现在是恋人|情侣邀请/.test(first)) return "identity_relation";
    if (/世界书/.test(first)) return "lore";
    if (/群里|线下|礼物往来|一起听/.test(first)) return "shared_history";
    if (/当前真实时间|所在地|当前位置|好感度|心情|行程|朋友圈|论坛|手机上的近况|生理期|特别日子|备忘录|记账动态/.test(first)) return "live_state";
    return "rules";
  }
  function measure(parts) {
    const categories = {}, blocks = [];
    (parts || []).forEach(text => {
      const category = classify(text), chars = String(text || "").length;
      categories[category] = (categories[category] || 0) + chars;
      blocks.push({ index:blocks.length, category, chars });
    });
    const totalChars = blocks.reduce((n, x) => n + x.chars, 0);
    const largest = Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0] || null;
    return { totalChars, categories, blocks: blocks.length, blockList:blocks, largest, pressure: totalChars > SOFT_BUDGET };
  }
  // 按原 block 顺序消耗各类别额度，绝不重排。
  function propose(measured) {
    const c = measured.categories || {};
    const caps = {...CATEGORY_CAPS}, overflow = {}, proposed = {}, remaining={...caps};
    Object.keys(c).forEach(k => {
      const cap = Number(caps[k])||0;
      proposed[k] = Math.min(c[k], cap);
      overflow[k] = Math.max(0, c[k] - cap);
    });
    const sourceBlocks=Array.isArray(measured.blockList)?measured.blockList:[];
    const blockPlan=sourceBlocks.map((block,index)=>{
      const category=block.category,chars=Math.max(0,Number(block.chars)||0),keep=Math.min(chars,Math.max(0,remaining[category]||0));
      remaining[category]=Math.max(0,(remaining[category]||0)-keep);
      return {index:Number.isFinite(Number(block.index))?Number(block.index):index,category,chars,proposedChars:keep,trimChars:chars-keep};
    });
    const proposedTotal = blockPlan.reduce((n,x)=>n+x.proposedChars,0);
    return { caps, overflow, proposed, blockPlan, orderPreserved:blockPlan.every((x,i)=>x.index===(sourceBlocks[i]&&sourceBlocks[i].index)), proposedTotal, wouldStillPressure: proposedTotal > SOFT_BUDGET };
  }
  const TRIM_MARK = "…（已按上下文预算截短）";
  function trimBlock(text, category, limit) {
    const raw=String(text||""),max=Math.max(0,Math.floor(Number(limit)||0));
    if (!max) return "";
    if (raw.length<=max) return raw;
    if (max<=TRIM_MARK.length+8) return raw.slice(0,max);
    // 最近对话的时间方向和其他材料相反：标题留下，正文保留最新尾巴，不能只留下最旧几句。
    if (category==="recent_chat") {
      const cut=raw.indexOf("\n"),head=cut>=0?raw.slice(0,cut+1):"",room=max-head.length-TRIM_MARK.length-1;
      if (room>8) return head+TRIM_MARK+"\n"+raw.slice(-room);
    }
    return raw.slice(0,max-TRIM_MARK.length)+TRIM_MARK;
  }
  function apply(parts) {
    const source=(parts||[]).map(x=>String(x||"")),measured=measure(source);
    // 没有总压时保持逐字一致，不为了“整齐”白白砍材料。
    if (!measured.pressure) return source.slice();
    const plan=propose(measured).blockPlan;
    return source.map((text,i)=>trimBlock(text,plan[i]&&plan[i].category,plan[i]&&plan[i].proposedChars)).filter(Boolean);
  }
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("audits")) req.result.createObjectStore("audits", { keyPath: "_id", autoIncrement: true }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("context budget shadow open failed"));
    });
    return dbPromise;
  }
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = tx => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
  async function observeBundle(input) {
    try {
      const now = Date.now(), c = hash(input && input.charId), last = lastByChar.get(c) || 0;
      if (now - last < 60000) return;
      lastByChar.set(c, now);
      const measured = measure(input && input.parts), proposal = propose(measured);
      const db = await openDB(), tx = db.transaction("audits", "readwrite"), store = tx.objectStore("audits");
      store.add({ auditVersion:AUDIT_VERSION,t: now, c, totalChars: measured.totalChars, categories: measured.categories, blocks: measured.blocks,
        largest: measured.largest, pressure: measured.pressure, proposedTotal: proposal.proposedTotal, overflow: proposal.overflow,
        wouldStillPressure: proposal.wouldStillPressure,orderPreserved:proposal.orderPreserved });
      await done(tx);
      if (Math.random() < 0.08) {
        const tx2 = db.transaction("audits", "readwrite"), s2 = tx2.objectStore("audits"), rows = await rq(s2.getAll());
        rows.filter(x => x.t < now - KEEP_MS).forEach(x => s2.delete(x._id));
        rows.slice(0, Math.max(0, rows.length - CAP)).forEach(x => s2.delete(x._id)); await done(tx2);
      }
    } catch (e) {/* 预算审计绝不阻断聊天 */}
  }
  async function report(n) {
    try {
      const db = await openDB(), tx = db.transaction("audits", "readonly"), all = await rq(tx.objectStore("audits").getAll()); await done(tx);
      const selected=all.slice(-(n || 200)),legacySamples=selected.filter(x=>Number(x.auditVersion||1)<AUDIT_VERSION).length,rows=selected.filter(x=>Number(x.auditVersion||1)===AUDIT_VERSION), categoryChars = {}, largest = {};
      rows.forEach(x => {
        Object.keys(x.categories || {}).forEach(k => { categoryChars[k] = (categoryChars[k] || 0) + x.categories[k]; });
        if (x.largest) largest[x.largest] = (largest[x.largest] || 0) + 1;
      });
      const avg = key => rows.length ? Math.round(rows.reduce((sum, x) => sum + (x[key] || 0), 0) / rows.length) : 0;
      Object.keys(categoryChars).forEach(k => { categoryChars[k] = rows.length ? Math.round(categoryChars[k] / rows.length) : 0; });
      const firstObservedAt=rows.length?Number(rows[0].t)||null:null,lastObservedAt=rows.length?Number(rows[rows.length-1].t)||null:null;
      return { auditVersion:AUDIT_VERSION,legacySamples,audits: rows.length,firstObservedAt,lastObservedAt,spanHours:firstObservedAt&&lastObservedAt?Math.round((lastObservedAt-firstObservedAt)/36000)/100:0, softBudget: SOFT_BUDGET, categoryCaps:{...CATEGORY_CAPS},avgTotalChars: avg("totalChars"), avgProposedChars: avg("proposedTotal"),
        pressureRate: rows.length ? Math.round(rows.filter(x => x.pressure).length * 100 / rows.length) / 100 : 0,
        proposedPressureRate:rows.length?Math.round(rows.filter(x=>x.wouldStillPressure).length*100/rows.length)/100:0,
        orderViolationCount:rows.filter(x=>x.orderPreserved===false).length,
        avgCategoryChars: categoryChars, largestCategory: largest, last: rows.slice(-5) };
    } catch (e) { return { error: "统一候选预算审计读取失败" }; }
  }
  async function clearAll() { try { const db = await openDB(), tx = db.transaction("audits", "readwrite"); tx.objectStore("audits").clear(); await done(tx); } catch (e) {} }
  window.ContextBudgetShadow = { AUDIT_VERSION,SOFT_BUDGET,CATEGORY_CAPS,classify, measure, propose, apply, observeBundle, report, clearAll };
})();
