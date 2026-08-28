(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChatContextWindow = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // 一条消息真正会占掉多少字。⚠️不能只算 content：有几种消息把大头挂在【别的字段】上，
  // 裁完窗口之后才在拼 prompt 的地方展开——
  //   offlinelog.transcript  线下逐字记录，最多 6000 字
  //   callend.sum            通话内容摘要
  //   ccToolResultData       只读工具结果，最多 16000 字
  // 只算 content 的话，这些字一分钱不花地溜进窗口：她 2026-08-28 那个场景实测
  // 预算算出来 4940 字（上限 14000，看着还很宽裕），实际拼进 prompt 22940 字，
  // 其中 18000 字完全在预算之外。窗口不是挤掉了记录，是整个 prompt 静默超载。
  const EXTRA_COST_FIELDS = ["transcript", "sum"];
  function costOf(message) {
    if (!message) return 48;
    let n = String(message.content || "").length + 48;
    EXTRA_COST_FIELDS.forEach(function (k) { n += String(message[k] == null ? "" : message[k]).length; });
    if (message.ccToolResultData != null) {
      // 拼 prompt 那边是 JSON.stringify(...).slice(0, 16000)，这里按同一个上限估
      try { n += Math.min(16000, JSON.stringify(message.ccToolResultData).length); }
      catch (e) { n += 16000; }
    }
    return n;
  }

  function select(messages, options) {
    const list = Array.isArray(messages) ? messages : [];
    const opts = options || {};
    const maxChars = Math.max(1000, Number(opts.maxChars) || 14000);
    const maxMessages = Math.max(1, Number(opts.maxMessages) || 80);
    const picked = [];
    let chars = 0;

    // Only the prompt window is bounded. The original array and stored chat are untouched.
    for (let i = list.length - 1; i >= 0 && picked.length < maxMessages; i--) {
      const message = list[i];
      const cost = costOf(message);
      if (picked.length && chars + cost > maxChars) break;
      picked.push(message);
      chars += cost;
    }
    picked.reverse();
    return picked;
  }

  return { select: select, costOf: costOf };
});
