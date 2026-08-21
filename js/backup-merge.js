// 备份跨壳/书签导入时的聊天合并器。
// 只合并消息时间线；设置、人设等仍以导入的备份为准，避免把两套配置搅在一起。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BackupMerge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CHAT_PREFIXES = ["x_chat:", "x_gchat:"];
  const text = value => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const isChatKey = key => CHAT_PREFIXES.some(prefix => String(key || "").indexOf(prefix) === 0);
  const parseList = raw => {
    try { const value = JSON.parse(String(raw == null ? "[]" : raw)); return Array.isArray(value) ? value : []; }
    catch (_) { return []; }
  };
  const strongId = message => message && (message.ledgerKey || message.id || message.mid || message.messageId || message.cid);
  const contentIdentity = message => [
    "content", text(message && message.role), text(message && (message.senderId || message.charId)),
    text(message && message.kind), String(Number(message && (message.ts || message.created_at)) || 0),
    text(message && message.content)
  ].join("|");
  const identity = message => {
    const id = strongId(message);
    if (id != null && String(id)) return "id:" + String(id);
    // turnId 会被同一轮多个气泡共用，不能拿来当逐消息 ID。
    return contentIdentity(message);
  };

  function mergeMessageLists(current, incoming) {
    const rows = new Map(), order = [], aliases = new Map();
    const put = (message, incomingWins) => {
      if (!message || typeof message !== "object") return;
      const direct = identity(message), contentKey = contentIdentity(message);
      // 同一条可能在本机是 ledgerKey、备份里是普通 id；时间/说话人/正文完全相同也视为同一条。
      const key = rows.has(direct) ? direct : (aliases.get(contentKey) || direct);
      if (!rows.has(key)) {
        rows.set(key, message); order.push(key); aliases.set(contentKey, key); aliases.set(direct, key); return;
      }
      const previous = rows.get(key);
      // 同一条在两边都存在时，导入侧优先；同时保留本机独有的附件/状态字段。
      if (incomingWins) {
        const merged = { ...previous, ...message };
        // 内容指纹合并到一起时保留本机原身份，避免下一次账本对账又把它当新消息补回来。
        ["ledgerKey", "id", "mid", "messageId", "cid"].forEach(field => {
          if (previous[field] != null) merged[field] = previous[field];
        });
        rows.set(key, merged);
      }
      aliases.set(contentKey, key); aliases.set(direct, key);
    };
    (Array.isArray(current) ? current : []).forEach(message => put(message, false));
    (Array.isArray(incoming) ? incoming : []).forEach(message => put(message, true));
    return order.map((key, index) => ({ message: rows.get(key), index })).sort((a, b) => {
      const dt = (Number(a.message && (a.message.ts || a.message.created_at)) || 0) - (Number(b.message && (b.message.ts || b.message.created_at)) || 0);
      return dt || a.index - b.index;
    }).map(row => row.message);
  }

  function mergeChatRaw(currentRaw, incomingRaw) {
    return JSON.stringify(mergeMessageLists(parseList(currentRaw), parseList(incomingRaw)));
  }

  return { isChatKey, identity, contentIdentity, mergeMessageLists, mergeChatRaw };
});
