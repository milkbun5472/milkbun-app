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

  function intentReason(text) {
    const source = clean(text);
    if (!source || /(?:昨天|前天|以前|上次|那天|曾经).{0,10}(?:出门|回家|洗澡|睡觉|起床|运动|跑步|晨跑|健身|游泳|训练|上班|上课)/.test(source)) return "";
    const rules = [
      [/(?:换衣|换身|换上|穿上|脱下|脱掉|穿什么|换什么衣服)/, "明确换装"],
      [/(?:准备|马上|现在|待会|一会|等会|要|该|得|去|一起)?(?:出门|出发|赴约|约会)/, "准备出门"],
      [/(?:去|准备|马上|现在|待会|一会|等会|要|该|得).{0,6}(?:上班|公司|工作室|学校|上课|开会|见客户)/, "工作或上课"],
      [/(?:回家|到家|进门|刚回来|回来了)/, "回到家"],
      [/(?:去|准备|马上|现在|待会|一会|等会|要|该|得)?(?:洗澡|冲澡|泡澡)/, "洗澡"],
      [/(?:去|准备|马上|现在|待会|一会|等会|要|该|得)?(?:睡觉|上床|起床|起了|刚醒|睡醒)/, "睡眠切换"],
      [/(?:去|准备|马上|现在|待会|一会|等会|要|该|得)?(?:跑步|晨跑|健身|游泳|训练|运动)/, "运动"],
      [/(?:下班|放学|收工)/, "结束工作或上课"]
    ];
    const hit = rules.find(([re]) => re.test(source));
    return hit ? hit[1] : "";
  }

  function evaluate(input) {
    const nowKey = clean(input && input.scheduleKey);
    const acknowledgedKey = clean(input && input.acknowledgedKey);
    const pending = !!(input && input.pending);
    const intent = intentReason(input && input.latestUserText);
    const scheduleChanged = !!nowKey && nowKey !== acknowledgedKey;
    const missing = !(input && input.hasWearing);
    const required = pending || missing || scheduleChanged || !!intent;
    let reason = "";
    if (pending) reason = "上轮换装刷新尚未完成";
    else if (missing) reason = "当前穿着尚未建档";
    else if (scheduleChanged) reason = acknowledgedKey ? "行程已切换" : "当前行程尚未确认穿着";
    else reason = intent;
    return { required, reason, scheduleChanged, intent, scheduleKey: nowKey };
  }

  return { scheduleKey, intentReason, evaluate };
});
