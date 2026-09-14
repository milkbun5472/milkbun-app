(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.InteractionClock = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const tsOf = function (m) { const n = Number(m && m.ts); return Number.isFinite(n) ? n : 0; };
  const maxMsgs = function (msgs, ok) { return (Array.isArray(msgs) ? msgs : []).reduce(function (best, m) { return !ok || ok(m) ? Math.max(best, tsOf(m)) : best; }, 0); };
  const maxSessions = function (sessions, ok) { return (Array.isArray(sessions) ? sessions : []).reduce(function (best, s) { return Math.max(best, Number(s && s.startTs) || 0, Number(s && s.endTs) || 0, maxMsgs(s && s.msgs, ok)); }, 0); };
  // 旁观群不算「她理过TA」（她 2026-09-14 报：在旁观群推了两句剧情，私聊那边的想我就清零了）。
  // ⚠️旁观群里她【不在场】：那是两个角色自己的事，她的字是【旁白】不是搭话。
  //   拿它当「有人理了TA」，语义正好是反的——她越是在旁边看他俩演，他越不想她。
  //   判据两头都要问：roomKind 记在群自己身上，spectate 记在 x_groupSettings 里（app.js 9307 同一条）。
  const watchingOnly = function (g, data) {
    if (!g) return false;
    if (g.roomKind === "spectate") return true;
    const gs = (data && data.groupSettings) || {};
    return !!(gs[g.id] && gs[g.id].spectate);
  };
  function latestSharedTs(charId, data) {
    data = data || {};
    let best = maxSessions((data.offlines || {})[charId], function (m) { return m && (m.role === "user" || m.role === "narration" || m.role === "assistant"); });
    (Array.isArray(data.groups) ? data.groups : []).forEach(function (g) {
      if (!g || !(g.memberIds || []).includes(charId)) return;
      const relevant = function (m) { return m && m.kind !== "ooc" && (m.role === "user" || m.role === "narration" || m.senderId === charId); };
      best = Math.max(best, maxMsgs((data.groupChats || {})[g.id], relevant));
      best = Math.max(best, maxSessions((data.groupOfflines || {})[g.id], relevant));
    });
    return best;
  }
  // 只认 Lisa/用户真的开过口；角色自己在群里发言不能冒充“被 Lisa 理过”。
  function latestUserSharedTs(charId, data) {
    data = data || {};
    const fromUser = function (m) { return m && m.kind !== "ooc" && (m.role === "user" || m.role === "narration"); };
    let best = maxSessions((data.offlines || {})[charId], fromUser);
    (Array.isArray(data.groups) ? data.groups : []).forEach(function (g) {
      if (!g || !(g.memberIds || []).includes(charId)) return;
      if (watchingOnly(g, data)) return;                 // 她在旁边看，不是在跟TA说话
      best = Math.max(best, maxMsgs((data.groupChats || {})[g.id], fromUser));
      best = Math.max(best, maxSessions((data.groupOfflines || {})[g.id], fromUser));
    });
    return best;
  }
  function isTogetherNow(charId, data, now) {
    data = data || {}; now = Number(now) || Date.now();
    return (Array.isArray(data.groups) ? data.groups : []).some(function (g) {
      if (!g || !(g.memberIds || []).includes(charId)) return false;
      if (watchingOnly(g, data)) return false;           // 他俩在一起，不是她和他在一起
      if (data.activeGroupId && data.activeGroupId === g.id) return true;
      return (Array.isArray((data.groupOfflines || {})[g.id]) ? data.groupOfflines[g.id] : []).some(function (s) {
        return s && !s.endTs && now - (Number(s.startTs) || 0) < 8 * 60 * 60 * 1000;
      });
    });
  }
  // 这一场线下【还在进行】吗？——注意这跟「线下浮层开着」是两件事：
  // 下拉回线上群只收浮层，那一场并没有结束。判据是场次本身：没写 endTs、已经演过至少一拍、
  // 而且开场不超过 8 小时（跟 isTogetherNow 同一个上限，免得一场忘了结束的线下把东西永远关死）。
  const OFFLINE_LIVE_MS = 8 * 60 * 60 * 1000;
  function offlineSceneLive(sessions, now) {
    now = Number(now) || Date.now();
    return (Array.isArray(sessions) ? sessions : []).some(function (s) {
      return s && !s.endTs && ((s.msgs || []).length > 0) && (now - (Number(s.startTs) || 0) < OFFLINE_LIVE_MS);
    });
  }
  return { watchingOnly: watchingOnly, latestSharedTs: latestSharedTs, latestUserSharedTs: latestUserSharedTs, isTogetherNow: isTogetherNow,
    offlineSceneLive: offlineSceneLive };
});
