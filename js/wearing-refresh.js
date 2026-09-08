(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WearingRefresh = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const clean = value => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function scheduleKey(brief, dayKey) {
    if (!brief) return "";
    return [clean(dayKey), clean(brief.time), clean(brief.title), clean(brief.location), clean(brief.type), brief.dev ? "1" : "0"].join("|");
  }

  // 用户提及动作不等于角色已经行动。实际换装由回复协议记录，
  // 此处只负责已知状态缺失、刷新未完成和日程切换的确定性检查。

  function evaluate(input) {
    const nowKey = clean(input && input.scheduleKey);
    const acknowledgedKey = clean(input && input.acknowledgedKey);
    const pending = !!(input && input.pending);
    const scheduleChanged = !!nowKey && nowKey !== acknowledgedKey;
    const missing = !(input && input.hasWearing);
    const required = pending || missing || scheduleChanged;
    let reason = "";
    if (pending) reason = "上轮换装刷新尚未完成";
    else if (missing) reason = "当前穿着尚未建档";
    else if (scheduleChanged) reason = acknowledgedKey ? "行程已切换" : "当前行程尚未确认穿着";
    return { required, reason, scheduleChanged, scheduleKey: nowKey };
  }

  return { scheduleKey, evaluate };
});
