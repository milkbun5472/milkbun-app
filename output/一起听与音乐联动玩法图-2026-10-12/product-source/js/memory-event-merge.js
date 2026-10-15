// 旧记忆事件进展收拢：只提“计划/准备 → 已完成/取消/最终结果”候选。
// 纯机械、零模型；调用方必须预览并由 Lisa 明确确认后才能软归档过程条。
(function (root) {
  "use strict";
  const WINDOW_MS = 7 * 86400000;
  // 这里只负责找“值得让 Lisa 过目”的候选，不自动改记忆。自然聊天很少总用
  // “计划/已完成”这种工单词，所以补齐常见口语，但仍要求同角色、七天内和主题相似。
  const PLANNED = /计划|准备|打算|决定(?:要|去|吃|买|做|看|试)|约好|说好|答应|明天|今晚|等下|待会|一会儿|周末|下周|改天|之后(?:要|去|再)|(?:想|要|会|将)(?:去|吃|买|做|看|试|带|约|弄|玩|学|见)/;
  const RESOLVED = /已经|已完成|完成了|兑现|解决|取消|算了|没(?:去|吃|买|做|看|试|能|办法).*成?|改(?:成|为|吃|去|做)|换成|最终|结果|后来|实际|到达|到家|成功|结束|(?:去|吃|买|做|看|试|带|约|弄|玩|学|见)(?:了|到|完)/;
  const GENERIC_TAGS = new Set(["日常", "生活", "对话", "记忆", "自动", "重要", "关系"]);

  const norm = s => String(s || "").replace(/[\s，。、；：,.;:!！?？「」『』"'“”‘’（）()【】\-—]/g, "").toLowerCase();
  const coreNorm = s => norm(s)
    .replace(/计划|准备|打算|决定|约好|说好|答应|明天|今晚|等下|待会|一会儿|周末|下周|改天|之后|已经|已完成|完成了|兑现|解决|取消|算了|没去成|没吃成|改成|改为|换成|最终|结果|后来|实际|成功|结束/g, "")
    .replace(/^(?:lisa|用户|她|他)+/g, "");
  const grams = s => { const n = norm(s), out = new Set(); for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2)); return out; };
  const coreGrams = s => { const n = coreNorm(s), out = new Set(); for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2)); return out; };
  const similarity = (a, b) => { const x=grams(a), y=grams(b); if (!x.size || !y.size) return 0; let n=0; x.forEach(v=>{if(y.has(v))n++;}); return 2*n/(x.size+y.size); };
  const coreSimilarity = (a, b) => { const x=coreGrams(a), y=coreGrams(b); if (!x.size || !y.size) return 0; let n=0; x.forEach(v=>{if(y.has(v))n++;}); return 2*n/(x.size+y.size); };
  const evidence = e => new Set((Array.isArray(e && e.evidenceMessageIds) ? e.evidenceMessageIds : []).map(String).filter(Boolean));
  const roleKey = e => (Array.isArray(e && e.charIds) ? e.charIds.map(String).sort() : []).join("|");
  const tags = e => new Set((Array.isArray(e && e.tags) ? e.tags : []).map(String).filter(x => x && !GENERIC_TAGS.has(x)));
  const related = (a, b) => {
    if (roleKey(a) !== roleKey(b)) return false;
    const at=tags(a), bt=tags(b); let shared=false; at.forEach(x=>{if(bt.has(x))shared=true;});
    const score=similarity(a.text,b.text), core=coreSimilarity(a.text,b.text);
    const ae=evidence(a), be=evidence(b); let sameEvidence=false; ae.forEach(x=>{if(be.has(x))sameEvidence=true;});
    return sameEvidence || score >= 0.28 || core >= 0.34 || (shared && (score >= 0.12 || core >= 0.18));
  };
  const eligible = e => e && e.id && e.source === "auto" && e.text && !e.deleted && !e.archived && !e.pinned && !e.open && !e.supersedesId && !e.supersedes_id && (e.surfaceState || e.surface_state || "active") === "active";

  function scanRows(rows) {
    const list = (rows || []).filter(eligible).slice().sort((a,b)=>Number(a.ts||0)-Number(b.ts||0));
    const usedOld = new Set(), groups=[];
    for (let i=list.length-1; i>=0; i--) {
      const keep=list[i];
      if (!RESOLVED.test(String(keep.text))) continue;
      const old=[];
      for (let k=i-1; k>=0; k--) {
        const row=list[k], gap=Number(keep.ts||0)-Number(row.ts||0);
        if (gap>WINDOW_MS) break;
        if (usedOld.has(String(row.id)) || !PLANNED.test(String(row.text)) || RESOLVED.test(String(row.text))) continue;
        if (related(row, keep)) old.push(row);
      }
      if (!old.length) continue;
      old.forEach(x=>usedOld.add(String(x.id)));
      const archive=old.sort((a,b)=>Number(a.ts||0)-Number(b.ts||0));
      groups.push({ id:"event:"+String(keep.id)+":"+archive.map(x=>x.id).join("|"), keep, archive, matchKind:"event_progression", confidence:"review" });
    }
    return groups.sort((a,b)=>Number(b.keep.ts||0)-Number(a.keep.ts||0));
  }
  function analyze(rows) {
    const all=Array.isArray(rows)?rows:[], activeAuto=all.filter(e=>e&&e.id&&e.source==="auto"&&e.text&&!e.deleted&&!e.archived&&(e.surfaceState||e.surface_state||"active")==="active");
    const eligibleRows=activeAuto.filter(eligible);
    return {
      groups: scanRows(all),
      stats: {
        total: all.length,
        activeAuto: activeAuto.length,
        eligible: eligibleRows.length,
        planned: eligibleRows.filter(e=>PLANNED.test(String(e.text))).length,
        resolved: eligibleRows.filter(e=>RESOLVED.test(String(e.text))).length,
        protectedOpen: activeAuto.filter(e=>e.open).length,
        protectedPinned: activeAuto.filter(e=>e.pinned).length
      }
    };
  }
  const scan = rows => analyze(rows).groups;
  const api=Object.freeze({ WINDOW_MS, scan, analyze, related, similarity, coreSimilarity });
  if (typeof module!=="undefined" && module.exports) module.exports=api;
  if (root) root.MemoryEventMerge=api;
})(typeof window!=="undefined" ? window : globalThis);
