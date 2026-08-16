// 重 Roll 分支回滚的纯机械规则：证据归属 + 实时状态回退。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RerollBranch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const arr = x => Array.isArray(x) ? x : [];
  const evidenceId = (m, i) => String((m && (m.id || m.mid)) || (m && m.ts ? "ts_" + m.ts : "idx_" + (i || 0)));
  const evidenceIds = item => arr(item && item.evidence_message_ids).map(String).filter(Boolean);

  function candidateStillLive(item, liveMessages) {
    const ids = evidenceIds(item);
    if (!ids.length) return false;
    const live = new Set(arr(liveMessages).map(evidenceId));
    return ids.every(id => live.has(id));
  }

  // 重 Roll 是开一条新分支：保留目标回复之前的历史，目标回复及其所有后文一起退出有效时间线。
  // turnId 只用来向前找到同批拆泡的首泡，绝不能只删同 turn 而留下依赖旧回答的尾巴。
  function truncateChatBranch(messages,targetIndex,turnId) {
    const before=arr(messages),idx=Math.floor(Number(targetIndex));
    if(idx<0||idx>=before.length)return {after:before.slice(),removed:[],start:-1,turnIds:[]};
    let start=idx;
    if(turnId)while(start>0&&String(before[start-1]&&before[start-1].turnId||"")===String(turnId))start--;
    const removed=before.slice(start),turnIds=[];
    removed.forEach(m=>{const id=String(m&&m.turnId||"");if(id&&!turnIds.includes(id))turnIds.push(id);});
    return {after:before.slice(0,start),removed,start,turnIds};
  }

  // 只有证据【全部】来自同一个角色回复 turn，才允许该 turn 的 reroll 撤销这条记忆。
  // 用户原话也参与证据的事实仍成立，不跟着角色旧说法一起消失。
  function journalAssignments(entries, sourceMessages) {
    const byEvidence = new Map(arr(sourceMessages).map((m, i) => [evidenceId(m, i), m]));
    const out = {};
    arr(entries).forEach(entry => {
      const ids = arr(entry && entry.evidenceMessageIds).map(String).filter(Boolean);
      const messages = ids.map(id => byEvidence.get(id)).filter(Boolean);
      if (!ids.length || messages.length !== ids.length || messages.some(m => m.role !== "assistant" || !m.turnId)) return;
      const turns = new Set(messages.map(m => String(m.turnId)));
      if (turns.size !== 1) return;
      const turn = Array.from(turns)[0];
      (out[turn] = out[turn] || []).push(String(entry.id));
    });
    return out;
  }

  function rollbackState(current, history, turnId, options) {
    const clean = arr(history).filter(row => String(row && row.turnId || "") !== String(turnId || ""));
    const legacyLatest = options && options.legacyLatest && current && !current.turnId;
    if (legacyLatest) {
      // v49.75 前历史没有 turnId：只允许“最新角色回合”退一格，绝不猜更早分支。
      const legacyHistory = arr(history).slice(1), prevLegacy = legacyHistory[0];
      const legacyState = prevLegacy ? { thought: prevLegacy.thought, mood: prevLegacy.mood, wearing: prevLegacy.wearing, action: prevLegacy.action, ts: prevLegacy.ts, turnId: prevLegacy.turnId || null, affinityBefore: prevLegacy.affinityBefore } : null;
      if (legacyState && prevLegacy.wearingUpdatedAt != null) legacyState.wearingUpdatedAt = prevLegacy.wearingUpdatedAt;
      if (legacyState && prevLegacy.actionUpdatedAt != null) legacyState.actionUpdatedAt = prevLegacy.actionUpdatedAt;
      return { state: legacyState, history: legacyHistory };
    }
    if (!current || String(current.turnId || "") !== String(turnId || "")) return { state: current || null, history: clean };
    const prev = clean[0];
    if (!prev) return { state: null, history: clean };
    const restoredState = { thought: prev.thought, mood: prev.mood, wearing: prev.wearing, action: prev.action, ts: prev.ts, turnId: prev.turnId || null, affinityBefore: prev.affinityBefore };
    if (prev.wearingUpdatedAt != null) restoredState.wearingUpdatedAt = prev.wearingUpdatedAt;
    if (prev.actionUpdatedAt != null) restoredState.actionUpdatedAt = prev.actionUpdatedAt;
    return { state: restoredState, history: clean };
  }

  return { evidenceId, evidenceIds, candidateStillLive, truncateChatBranch,journalAssignments, rollbackState };
});
