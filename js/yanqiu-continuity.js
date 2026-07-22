// 秋声墙 → App 言秋连续性：纯格式化，不发模型请求、不碰记忆库。
(function (root) {
  function clean(value, max) {
    const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    if (!max || text.length <= max) return text;
    return text.slice(0, Math.max(1, max - 1)) + "…";
  }

  function stamp(value) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return "时间不详";
    return d.toLocaleString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    });
  }

  function format(items, opts) {
    const cfg = Object.assign({ maxMoments: 8, maxChars: 2600 }, opts || {});
    const rows = (Array.isArray(items) ? items : [])
      .filter(function (m) { return m && clean(m.content); })
      .slice()
      .sort(function (a, b) { return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); })
      .slice(0, cfg.maxMoments);
    const out = [];
    for (let i = 0; i < rows.length; i += 1) {
      const m = rows[i];
      const bits = ["· [" + stamp(m.created_at) + "] 你在秋声写：「" + clean(m.content, 420) + "」"];
      if (clean(m.mood)) bits.push("当时标的心情：" + clean(m.mood, 40));
      if (m.lisa_liked) bits.push("Lisa 点了赞");
      const comments = (Array.isArray(m.comments) ? m.comments : []).slice(-6).map(function (c) {
        const who = c && c.author === "yanqiu" ? "你" : "Lisa";
        return who + "：『" + clean(c && c.content, 220) + "』";
      }).filter(Boolean);
      if (comments.length) bits.push("评论：" + comments.join("；"));
      const line = bits.join("；");
      const next = out.concat(line).join("\n");
      if (next.length > cfg.maxChars) {
        if (!out.length) out.push(clean(line, cfg.maxChars));
        break;
      }
      out.push(line);
    }
    return out.join("\n");
  }

  root.YanqiuContinuity = { format: format };
  if (typeof module !== "undefined" && module.exports) module.exports = root.YanqiuContinuity;
})(typeof window !== "undefined" ? window : globalThis);
