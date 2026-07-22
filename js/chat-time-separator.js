(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChatTimeSeparator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const GAP_MS = 30 * 60 * 1000;
  const dayKey = ts => { const d = new Date(ts); return Number.isFinite(d.getTime()) ? [d.getFullYear(), d.getMonth(), d.getDate()].join("-") : ""; };
  function shouldShow(previous, current) {
    const a = Number(previous && previous.ts), b = Number(current && current.ts);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return false;
    if (previous.turnId && current.turnId && previous.turnId === current.turnId) return false;
    return dayKey(a) !== dayKey(b) || b - a >= GAP_MS;
  }
  function label(ts, nowValue) {
    const d = new Date(Number(ts)), now = new Date(Number(nowValue) || Date.now());
    if (!Number.isFinite(d.getTime())) return "";
    const p = n => String(n).padStart(2, "0"), hm = p(d.getHours()) + ":" + p(d.getMinutes());
    const todayKey = dayKey(now.getTime());
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (dayKey(d.getTime()) === todayKey) return hm;
    if (dayKey(d.getTime()) === dayKey(yesterday.getTime())) return "昨天 " + hm;
    return (d.getFullYear() === now.getFullYear() ? "" : d.getFullYear() + "年") + (d.getMonth() + 1) + "月" + d.getDate() + "日 " + hm;
  }
  function previousTimed(messages, index) {
    for (let i = index - 1; i >= 0; i--) if (messages[i] && Number.isFinite(Number(messages[i].ts))) return messages[i];
    return null;
  }
  return { GAP_MS, shouldShow, label, previousTimed };
});
