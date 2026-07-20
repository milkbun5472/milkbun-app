(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AmbientMaterial = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const textOf = m => String((m && m.content) || "").replace(/\s+/g, " ").trim();
  const valid = m => !!(m && !m.recalled && m.kind !== "ooc" && m.kind !== "system" && m.role !== "system" && textOf(m));
  const who = (m, userName, charName) => {
    if (m.role === "user" || m.role === "narration") return m.role === "narration" ? "场景" : userName;
    return m.senderName || charName || "角色";
  };
  const pushMessages = (out, messages, source, userName, charName, sinceTs) => {
    (messages || []).forEach(m => {
      if (!valid(m) || Number(m.ts || 0) <= sinceTs) return;
      out.push({ ts: Number(m.ts) || 0, source, speaker: who(m, userName, charName), text: textOf(m) });
    });
  };
  const collect = (charId, data, opts) => {
    data = data || {}; opts = opts || {};
    const out = [], sinceTs = Number(opts.sinceTs) || 0;
    const userName = opts.userName || "用户", charName = opts.charName || "角色";
    pushMessages(out, (data.chats || {})[charId], "私聊", userName, charName, sinceTs);
    ((data.offlines || {})[charId] || []).forEach(s => pushMessages(out, s && s.msgs, "单人线下", userName, charName, sinceTs));
    (data.groups || []).filter(g => (g.memberIds || []).includes(charId)).forEach(g => {
      const groupName = g.name ? "群聊·" + g.name : "群聊";
      pushMessages(out, (data.groupChats || {})[g.id], groupName, userName, charName, sinceTs);
      ((data.groupOfflines || {})[g.id] || []).forEach(s => pushMessages(out, s && s.msgs, "群线下·" + (g.name || "群聊"), userName, charName, sinceTs));
    });
    out.sort((a, b) => a.ts - b.ts);
    return out.slice(-Math.max(1, Number(opts.limit) || 20));
  };
  const format = rows => (rows || []).map(x => "【" + x.source + "】" + x.speaker + "：" + x.text).join("\n");
  return { collect, format };
});
