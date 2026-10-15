// 低信息密度日常流水清理候选：只列预览，不自动改记忆。
// 调用方必须由 Lisa 逐条勾选后软归档；open / pinned / 高情绪 / 重要主题永不进入。
(function (root) {
  "use strict";
  const MIN_AGE_MS = 7 * 86400000;
  const TIME_ANCHOR = /今天|昨天|昨晚|今早|早上|上午|中午|下午|傍晚|晚上|夜里|凌晨|刚刚|刚才|这会儿|目前|现在/;
  const ROUTINE_ACTION = /吃(?:了|饭|完)|喝(?:了|水|咖啡|茶)|洗(?:了|澡|漱)|刷牙|睡(?:了|觉)|起床|上班|下班|上课|下课|通勤|回家|到家|出门|做饭|点(?:了)?外卖|收拾|打扫|健身|散步|洗衣|买菜|午休|补觉/;
  const DURABLE_SIGNAL = /记得|约好|说好|答应|承诺|未了|开环|第一次|周年|生日|纪念|礼物|爱(?:上|她|他|你|我)|恋人|关系|边界|吵架|争执|道歉|和好|害怕|难过|开心|感动|骄傲|最喜欢|很喜欢|讨厌|偏好|过敏|生病|医院|受伤|疼|旅行|温哥华|机场|到达|成功|决定|学会|完成|结果|终于|重要|秘密|梦想|愿望|搬家|入职|离职|考试|录取/;

  const state = e => e && (e.surfaceState || e.surface_state || "active");
  function inspect(e, now) {
    if (!e || !e.id || !e.text || e.source !== "auto") return { candidate: false, reason: "not_auto" };
    if (e.deleted || e.archived || state(e) !== "active") return { candidate: false, reason: "inactive" };
    if (e.open) return { candidate: false, reason: "protected_open" };
    if (e.pinned) return { candidate: false, reason: "protected_pinned" };
    if (Number(e.a || 0) > 1) return { candidate: false, reason: "emotion" };
    if (!Number(e.ts) || Number(now) - Number(e.ts) < MIN_AGE_MS) return { candidate: false, reason: "recent" };
    const text = String(e.text);
    if (DURABLE_SIGNAL.test(text)) return { candidate: false, reason: "durable_signal" };
    if (!TIME_ANCHOR.test(text) || !ROUTINE_ACTION.test(text)) return { candidate: false, reason: "not_routine" };
    return { candidate: true, reason: "dated_low_emotion_routine" };
  }

  function analyze(rows, now) {
    const at = Number(now) || Date.now(), all = Array.isArray(rows) ? rows : [];
    const reasons = {}, candidates = [];
    all.forEach(e => {
      const result = inspect(e, at);
      reasons[result.reason] = (reasons[result.reason] || 0) + 1;
      if (result.candidate) candidates.push({
        id: "routine:" + String(e.id),
        keep: null,
        archive: [e],
        matchKind: "routine_low_signal",
        confidence: "review",
        reason: result.reason
      });
    });
    candidates.sort((a, b) => Number(b.archive[0].ts || 0) - Number(a.archive[0].ts || 0));
    return { groups: candidates, stats: { total: all.length, candidates: candidates.length, protectedOpen: reasons.protected_open || 0, protectedPinned: reasons.protected_pinned || 0, durable: reasons.durable_signal || 0, recent: reasons.recent || 0 } };
  }

  const api = Object.freeze({ MIN_AGE_MS, inspect, analyze });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MemoryRoutineCleanup = api;
})(typeof window !== "undefined" ? window : globalThis);
