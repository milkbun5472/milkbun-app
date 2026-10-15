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
  // ── 线下逐字记录：【存的是全的，喂回去的只是尾巴】（她 2026-09-14 转来的反馈）──
  // 有人报「线下聊得长，总结之后完整经过只有 5k 字，丢了一半」。查下来病根是
  // **两件事被焊在了一起**：①她点开要回看的完整经过 ②喂回模型的那一段。
  // 后者必须有上限（不然一条消息能把整个 prompt 吃掉，见上面那段注释），
  // 可前者凭什么截？原来在【写的时候】就只留了最后 6000 字，前半段从此没了。
  // 现在：存全的，上限只在【喂回去的那一刻】按这儿这一份切。
  // ⚠️通话那一路（callTranscriptForOnline）本来就是这么做的——记录存全的、注入时才切尾巴。
  //   线下这一路当初漏跟了，于是同一个形状活成两种行为。
  const TRANSCRIPT_FED_CAP = 6000;
  function transcriptTail(text, cap) {
    const s = String(text == null ? "" : text);
    const limit = Math.max(500, Number(cap) || TRANSCRIPT_FED_CAP);
    if (s.length <= limit) return s;
    const cut = s.slice(s.length - limit);
    const nl = cut.indexOf("\n");                 // 别从半句话中间切进去
    return (nl >= 0 ? cut.slice(nl + 1) : cut);
  }
  function costOf(message) {
    if (!message) return 48;
    let n = String(message.content || "").length + 48;
    EXTRA_COST_FIELDS.forEach(function (k) {
      const len = String(message[k] == null ? "" : message[k]).length;
      // ⚠️transcript 现在存的是全文，可真正拼进 prompt 的只有尾巴那一段——
      //   按全文记账会把这条消息挤出窗口（存得越全、她越读不到上下文，正好反了）。
      n += (k === "transcript") ? Math.min(TRANSCRIPT_FED_CAP, len) : len;
    });
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

  return { select: select, costOf: costOf, transcriptTail: transcriptTail, TRANSCRIPT_FED_CAP: TRANSCRIPT_FED_CAP };
});
