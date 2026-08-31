#!/usr/bin/env node
// scripts/mcp-server.mjs —— 给 milkbun-app 用的最小 MCP 服务器（她 2026-08-31 问「MCP 服务器咋弄」）。
//
// 为什么要自己起一台：现成的托管 MCP 多半是给 Claude Desktop 那类客户端做的，
// 不给浏览器放行跨域(CORS)。手机上的 PWA 是【浏览器直连】，服务端不回
// Access-Control-Allow-Origin 就一个字都拿不到。这一份从头就是为浏览器写的。
//
// 零依赖，Node 18+ 直接跑：
//   node scripts/mcp-server.mjs
//
// 环境变量（都可不填）：
//   PORT=8790            监听端口
//   MCP_TOKEN=xxxx       访问口令。⚠️公网上必须设——不设的话谁知道地址谁都能用，
//                        烧的是你的搜索额度。设了以后在 App 的「密钥」那一栏填同一串。
//   BRAVE_KEY=xxx        Brave Search 的 key（有免费额度）
//   TAVILY_KEY=xxx       Tavily 的 key（专为 LLM 做的搜索）
//   ALLOW_ORIGIN=*       放行哪个来源，默认全放
// 三个搜索后端按 BRAVE → TAVILY → DuckDuckGo 的顺序挑第一个能用的。
// DuckDuckGo 那一路不要 key，但它是从 HTML 里抠结果的，人家改版就会失灵——
// 当兜底可以，当主力不行。
//
// 起好之后：
//   · 同一个 tailnet / 内网：地址直接填 http(s)://那台机器:8790/mcp
//   · 要走公网：套一层 HTTPS（Caddy/Nginx 反代，或 cloudflared tunnel），
//     然后填 https://你的域名/mcp。⚠️PWA 是 https 的，混不进 http 的地址。
import http from "node:http";

const PORT = Number(process.env.PORT || 8790);
const TOKEN = process.env.MCP_TOKEN || "";
const ORIGIN = process.env.ALLOW_ORIGIN || "*";
const PROTO = "2025-06-18";

const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  // 客户端会发 mcp-session-id 和 authorization，这两个不放行的话预检就挂了
  "Access-Control-Allow-Headers": "content-type, authorization, mcp-session-id, mcp-protocol-version, accept",
  // 会话号在【响应头】上，不 expose 出去浏览器读不到，于是每一发都被当成新会话
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400"
};

const strip = html => String(html || "")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, " ").trim();

async function searchBrave(q, n) {
  const r = await fetch("https://api.search.brave.com/res/v1/web/search?count=" + n + "&q=" + encodeURIComponent(q),
    { headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_KEY } });
  if (!r.ok) throw new Error("Brave 回了 HTTP " + r.status);
  const j = await r.json();
  return ((j.web && j.web.results) || []).slice(0, n).map(x => ({ title: x.title, url: x.url, snippet: strip(x.description) }));
}
async function searchTavily(q, n) {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.TAVILY_KEY, query: q, max_results: n })
  });
  if (!r.ok) throw new Error("Tavily 回了 HTTP " + r.status);
  const j = await r.json();
  return (j.results || []).slice(0, n).map(x => ({ title: x.title, url: x.url, snippet: strip(x.content) }));
}
// 不要 key 的兜底：从 DuckDuckGo 的精简版 HTML 里抠。人家一改版就失灵，别当主力。
async function searchDDG(q, n) {
  const r = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q),
    { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "zh-CN,zh;q=0.9" } });
  if (!r.ok) throw new Error("DuckDuckGo 回了 HTTP " + r.status);
  const html = await r.text();
  const out = [];
  const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,600}?class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < n) {
    let url = m[1];
    const dd = /[?&]uddg=([^&]+)/.exec(url);   // DDG 会把真链接包一层跳转
    if (dd) { try { url = decodeURIComponent(dd[1]); } catch (e) {} }
    out.push({ title: strip(m[2]), url, snippet: strip(m[3]) });
  }
  if (!out.length) throw new Error("没抠出结果——DuckDuckGo 多半改版了，建议配一个 BRAVE_KEY 或 TAVILY_KEY");
  return out;
}
const backend = () => process.env.BRAVE_KEY ? ["Brave", searchBrave]
  : process.env.TAVILY_KEY ? ["Tavily", searchTavily]
  : ["DuckDuckGo(无 key 兜底)", searchDDG];

const TOOLS = [
  {
    name: "web_search",
    description: "在互联网上搜一件事，返回几条标题、网址和摘要。需要知道最近发生了什么、或者不确定的事实时用。",
    inputSchema: { type: "object", properties: {
      query: { type: "string", description: "搜索词" },
      count: { type: "number", description: "要几条，默认 5，最多 10" }
    }, required: ["query"] }
  },
  {
    name: "fetch_url",
    description: "打开一个网址，把正文取回来（已去掉标签）。搜到一条结果想看细节时用。",
    inputSchema: { type: "object", properties: {
      url: { type: "string", description: "要打开的网址" },
      max_chars: { type: "number", description: "最多取多少字，默认 4000" }
    }, required: ["url"] }
  }
];

async function runTool(name, args) {
  if (name === "web_search") {
    const q = String((args && args.query) || "").trim();
    if (!q) return "没给搜索词。";
    const n = Math.max(1, Math.min(10, Number((args && args.count) || 5)));
    const [who, fn] = backend();
    const rs = await fn(q, n);
    return "（来源：" + who + "）\n" + rs.map((x, i) => (i + 1) + ". " + x.title + "\n   " + x.url + "\n   " + x.snippet).join("\n");
  }
  if (name === "fetch_url") {
    const u = String((args && args.url) || "").trim();
    if (!/^https?:\/\//i.test(u)) return "网址得以 http(s):// 开头。";
    const cap = Math.max(200, Math.min(20000, Number((args && args.max_chars) || 4000)));
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
    if (!r.ok) return "这个网址回了 HTTP " + r.status + "。";
    const txt = strip(await r.text());
    return txt.slice(0, cap) + (txt.length > cap ? "\n……（后面还有 " + (txt.length - cap) + " 字没取）" : "");
  }
  throw new Error("没有这件工具：" + name);
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (req.method === "GET") {   // 浏览器直接打开时给句人话，省得对着空白页猜
    res.writeHead(200, { ...cors, "content-type": "text/plain; charset=utf-8" });
    return res.end("MCP 服务器活着。把 " + (req.headers.host || "这台") + "/mcp 填进 App 的「MCP 服务器」里。\n搜索后端：" + backend()[0] + "\n口令：" + (TOKEN ? "已设" : "⚠ 没设，公网上谁都能用"));
  }
  let body = "";
  req.on("data", c => { body += c; if (body.length > 2e6) req.destroy(); });
  req.on("end", async () => {
    const json = (result, error, id) => {
      const payload = JSON.stringify(error ? { jsonrpc: "2.0", id, error } : { jsonrpc: "2.0", id, result });
      res.writeHead(200, { ...cors, "content-type": "application/json", "Mcp-Session-Id": "s1" });
      res.end(payload);
    };
    let rpc;
    try { rpc = JSON.parse(body || "{}"); } catch (e) { return json(null, { code: -32700, message: "不是合法 JSON" }, null); }
    const id = rpc.id;
    // 口令：⚠️必须在【所有方法之前】挡，不然 tools/list 这类不带副作用的照样白送出去
    if (TOKEN) {
      const got = String(req.headers.authorization || "").replace(/^bearer\s+/i, "");
      if (got !== TOKEN) { res.writeHead(401, { ...cors, "content-type": "application/json" }); return res.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32001, message: "口令不对" } })); }
    }
    try {
      if (rpc.method === "initialize") return json({ protocolVersion: PROTO, capabilities: { tools: {} }, serverInfo: { name: "milkbun-mcp", version: "1" } }, null, id);
      if (String(rpc.method || "").startsWith("notifications/")) { res.writeHead(202, cors); return res.end(); }
      if (rpc.method === "tools/list") return json({ tools: TOOLS }, null, id);
      if (rpc.method === "tools/call") {
        const nm = rpc.params && rpc.params.name;
        try {
          const text = await runTool(nm, (rpc.params && rpc.params.arguments) || {});
          return json({ content: [{ type: "text", text: String(text) }], isError: false }, null, id);
        } catch (e) {
          // 工具自己失败【不是】协议错：照常回 result，把话说给模型听，别让那一轮炸掉
          return json({ content: [{ type: "text", text: "工具没跑通：" + String((e && e.message) || e) }], isError: true }, null, id);
        }
      }
      return json(null, { code: -32601, message: "不认识这个方法：" + rpc.method }, id);
    } catch (e) {
      return json(null, { code: -32603, message: String((e && e.message) || e) }, id);
    }
  });
});
server.listen(PORT, () => {
  console.log("MCP 服务器起来了：http://0.0.0.0:" + PORT + "/mcp");
  console.log("搜索后端：" + backend()[0]);
  if (!TOKEN) console.log("⚠ 没设 MCP_TOKEN。放公网上的话谁知道地址谁都能用，烧的是你的额度——设一个再开。");
});
