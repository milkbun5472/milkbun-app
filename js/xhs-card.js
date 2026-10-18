// 小红书分享卡（她 2026-10-17：「连了什么 mcp 然后发小红书帖子给他，不止是显示链接而是那种小红书卡」）
//   她从小红书「分享 → 复制链接」贴进来的那一段，发出去就是一张小红书卡：
//   标题、作者先从分享文案里读（不联网、不花钱）；接了 MCP 的话，再找一件能读网页的工具补上封面和正文。
//   补不上也不要紧，卡照样是卡，TA 照样看得到链接、自己想用工具也能去读。
(function () {
  const S = x => String(x == null ? "" : x).trim();
  const URL_RE = /https?:\/\/(?:www\.)?(?:xhslink\.com|xiaohongshu\.com)\/[^\s，,。！!）)」]+/i;

  // 分享文案的两种样子：「【标题 - 作者 | 小红书 - 你的生活指南】… 链接」和「标题 正文开头… 链接，复制本条信息，打开【小红书】App查看精彩内容！」
  function parse(text) {
    const t = S(text), m = t.match(URL_RE);
    if (!m) return null;
    const url = m[0];
    let title = "", author = "";
    const br = t.match(/【([^】]*?)\s*\|\s*小红书[^】]*】/);
    if (br) {
      const seg = br[1], k = seg.lastIndexOf(" - ");
      if (k > 0) { title = seg.slice(0, k); author = seg.slice(k + 3); } else title = seg;
    } else {
      title = t.slice(0, m.index).replace(/^\s*\d+\s+/, "").replace(/复制本条信息[\s\S]*$/, "");
    }
    const rest = t.slice(m.index + url.length).replace(/^[，,\s]*复制本条信息[\s\S]*$/, "").replace(/^[，,\s]*复制后打开[\s\S]*$/, "");
    title = S(title).replace(/\s+[A-Za-z0-9]{6,}\s*$/, "").replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]\s*$/, "");
    return { url: url, title: S(title).slice(0, 80), author: S(author).slice(0, 30), note: S(rest).slice(0, 200) };
  }

  // 挑一件能读这条链接的工具：名字带小红书的优先，其次是抓网页那一类；参数里得有个放链接的格子
  function pickTool(tools) {
    const urlArg = t => {
      const p = (t.input_schema && t.input_schema.properties) || {};
      return Object.keys(p).find(k => /url|link|href|address/i.test(k)) || "";
    };
    const ok = (t, re) => re.test(t.raw || t.name) && urlArg(t);
    const tool = (tools || []).find(t => ok(t, /xhs|xiaohongshu|rednote|redbook/i)) || (tools || []).find(t => ok(t, /fetch|scrape|crawl|browse|read_?url|read_?page|web_?read|get_?page|jina/i));
    return tool ? { tool: tool, arg: urlArg(tool) } : null;
  }
  // 从工具回来的东西里抠出标题、封面、正文：网页原文就读 og 标签，Markdown 就读标题行和第一张小红书的图
  function digest(raw) {
    const s = String(raw || "");
    const meta = k => { const m = s.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]*content=["\']([^"\']+)', "i")) || s.match(new RegExp('content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']' + k + '["\']', "i")); return m ? m[1] : ""; };
    const img = meta("og:image") || ((s.match(/https?:\/\/[^\s"'()<>]*(?:xhscdn|sns-webpic|sns-img)[^\s"'()<>]*/i) || [])[0] || "");
    const title = meta("og:title") || ((s.match(/^\s*(?:Title:|#)\s*(.+)$/m) || [])[1] || "");
    let desc = meta("og:description") || meta("description");
    if (!desc && !/<html/i.test(s)) desc = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/^\s*(?:Title:|URL Source:|Markdown Content:|#).*$/gm, "").replace(/\s+/g, " ");
    return { cover: /^https?:/.test(img) ? img.replace(/&amp;/g, "&") : "", title: S(title).replace(/\s*-\s*小红书.*$/, "").slice(0, 80), desc: S(desc).slice(0, 300) };
  }
  async function enrich(url, off) {
    const M = window.MCP;
    if (!M || !M.enabled || !M.enabled().length) return null;
    let tools = [];
    try { tools = await M.listTools(false, off); } catch (e) { return null; }
    const pk = pickTool(tools);
    if (!pk) return null;
    const r = await M.callTool(pk.tool.name, { [pk.arg]: url });
    if (!r || r.isError) return null;
    const d = digest(r.text);
    return d.cover || d.title || d.desc ? d : null;
  }
  // TA 那头读到的那一句：卡上有什么，就一五一十摆给TA
  const modelText = (raw, x) => S(raw) + (x && (x.desc || x.cover) ? "\n[这条小红书笔记" + (x.title ? "《" + x.title + "》" : "") + (x.author ? "，作者 " + x.author : "") + (x.desc ? "，正文：" + x.desc : "") + "]" : "");

  function XhsCard({ m, isU }) {
    const h = React.createElement, t = (typeof useTheme === "function" ? useTheme() : {}) || {};
    const FB = typeof F_BODY !== "undefined" ? F_BODY : "inherit";
    const x = m.xhs || {};
    const open = () => { try { window.open(x.url, "_blank"); } catch (e) {} };
    return h("div", { className: "py-1 flex " + (isU ? "justify-end" : "justify-start") },
      h("div", { "data-wk": "card", "data-kind": "xhsshare", role: "link", onClick: open, style: { width: 220, borderRadius: 14, overflow: "hidden", background: "#fff", border: "1px solid " + (t.line || "#eee"), boxShadow: "0 4px 14px rgba(40,30,20,.08)", cursor: "pointer" } },
        x.cover ? h("img", { src: x.cover, alt: "", referrerPolicy: "no-referrer", style: { display: "block", width: "100%", aspectRatio: "3 / 4", maxHeight: 260, objectFit: "cover", background: "#f4f1ee" } }) : null,
        h("div", { style: { padding: "10px 12px 11px" } },
          h("div", { style: { fontFamily: FB, fontSize: 14, fontWeight: 600, lineHeight: 1.45, color: "#222", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, x.title || "一篇小红书笔记"),
          x.desc ? h("div", { style: { fontFamily: FB, fontSize: 12, lineHeight: 1.6, color: "#666", marginTop: 5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } }, x.desc) : null,
          h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9, fontFamily: FB, fontSize: 11, color: "#999" } },
            h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 } }, x.author || ""),
            h("span", { style: { background: "#ff2442", color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: 1 } }, "小红书")))));
  }
  if (typeof window !== "undefined") { window.XhsCard = XhsCard; window.XhsLink =  { parse: parse, pickTool: pickTool, digest: digest, enrich: enrich, modelText: modelText }; }
  if (typeof module === "object" && module.exports) module.exports = { parse: parse, pickTool: pickTool, digest: digest, modelText: modelText };
})();
