// 旧记忆事件进展收拢：只提“计划/准备 → 已完成/取消/最终结果”候选。
// 纯机械、零模型；调用方必须预览并由 Lisa 明确确认后才能软归档过程条。
(function (root) {
  "use strict";
  const WINDOW_MS = 7 * 86400000;
  const PLANNED = /计划|准备|打算|约好|说好|答应|明天|今晚|之后|待会|要去|想去|会去|将去/;
  const RESOLVED = /已经|已完成|完成了|兑现|解决|取消|没去成|没吃成|改成|改为|最终|结果|后来|实际|到达|吃了|买了|做完|结束/;
  const GENERIC_TAGS = new Set(["日常", "生活", "对话", "记忆", "自动", "重要", "关系"]);

  const norm = s => String(s || "").replace(/[\s，。、；：,.;:!！?？「」『』"'“”‘’（）()【】\-—]/g, "").toLowerCase();
  const grams = s => { const n = norm(s), out = new Set(); for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2)); return out; };
  const similarity = (a, b) => { const x=grams(a), y=grams(b); if (!x.size || !y.size) return 0; let n=0; x.forEach(v=>{if(y.has(v))n++;}); return 2*n/(x.size+y.size); };
  const roleKey = e => (Array.isArray(e && e.charIds) ? e.charIds.map(String).sort() : []).join("|");
  const tags = e => new Set((Array.isArray(e && e.tags) ? e.tags : []).map(String).filter(x => x && !GENERIC_TAGS.has(x)));
  const related = (a, b) => {
    if (roleKey(a) !== roleKey(b)) return false;
    const at=tags(a), bt=tags(b); let shared=false; at.forEach(x=>{if(bt.has(x))shared=true;});
    const score=similarity(a.text,b.text);
    return score >= 0.28 || (shared && score >= 0.12);
  };
  const eligible = e => e && e.id && e.source === "auto" && e.text && !e.deleted && !e.archived && !e.pinned && !e.open && !e.supersedesId && !e.supersedes_id && (e.surfaceState || e.surface_state || "active") === "active";

  function scan(rows) {
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
  const api=Object.freeze({ WINDOW_MS, scan, related, similarity });
  if (typeof module!=="undefined" && module.exports) module.exports=api;
  if (root) root.MemoryEventMerge=api;
})(typeof window!=="undefined" ? window : globalThis);
