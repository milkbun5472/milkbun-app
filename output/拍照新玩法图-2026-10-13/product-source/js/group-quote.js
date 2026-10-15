(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GroupQuote = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const clean = value => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const clip = (value, max) => {
    const text = clean(value);
    return text.length > max ? text.slice(0, Math.max(1, max - 1)) + "…" : text;
  };
  const authorName = (message, meName) => {
    if (!message) return "未知作者";
    if (message.role === "user") return clean(meName) || "用户";
    if (message.role === "narration") return "旁白";
    return clean(message.senderName) || "某人";
  };
  const messageId = (message, index) => clean(message && message.mid)
    || "legacy_" + String(message && message.ts || 0) + "_" + String(index == null ? 0 : index);
  const makeSelection = (message, index, meName) => ({
    id: messageId(message, index),
    text: clean(message && message.content),
    senderId: clean(message && message.senderId) || null,
    senderName: authorName(message, meName)
  });
  function buildCatalog(messages, meName, limit) {
    const all = (Array.isArray(messages) ? messages : []).map((message, index) => ({ message, index }))
      .filter(x => x.message && !x.message.recalled && x.message.kind !== "ooc"
        && !(typeof globalThis !== "undefined" && globalThis.ChatContextFilter && globalThis.ChatContextFilter.isExcluded(x.message))
        && clean(x.message.content));
    return all.slice(-Math.max(1, Number(limit) || 50)).map((x, i) => ({
      alias: "Q" + (i + 1),
      id: messageId(x.message, x.index),
      text: clean(x.message.content),
      preview: clip(x.message.content, 96),
      senderId: clean(x.message.senderId) || null,
      senderName: authorName(x.message, meName),
      message: x.message
    }));
  }
  function resolve(item, catalog) {
    const rows = Array.isArray(catalog) ? catalog : [];
    const wanted = clean(item && item.quoteId);
    const quotedText = clean(item && item.quote);
    const quotedAuthor = clean(item && item.quoteSenderName);
    let hit = wanted ? rows.find(x => x.alias === wanted || x.id === wanted) : null;
    if (!hit && quotedText) {
      const matches = rows.filter(x => x.text === quotedText || x.preview === quotedText);
      hit = [...matches].reverse().find(x => !quotedAuthor || x.senderName === quotedAuthor) || matches[matches.length - 1];
    }
    if (hit) return { replyTo: hit.text, replyToId: hit.id, replyToSenderId: hit.senderId, replyToSenderName: hit.senderName };
    if (quotedText) return { replyTo: quotedText, replyToId: null, replyToSenderId: null, replyToSenderName: quotedAuthor || null };
    return { replyTo: null, replyToId: null, replyToSenderId: null, replyToSenderName: null };
  }
  // 界面上只摆被引用的那句原话，不写「引用 XXX：」——是谁说的代码里一直有
  // （senderId/senderName 照常带着、也照常喂给模型），界面不必再报一遍（她 2026-08-24）
  const label = value => {
    if (!value) return "";
    if (typeof value === "string") return "❝ " + value;
    return "❝ " + clean(value.text || value.replyTo);
  };
  return { clean, authorName, messageId, makeSelection, buildCatalog, resolve, label };
});
