// js/mcp.js —— MCP（Model Context Protocol）客户端。
// 她 2026-08-31 指出浏览器是能当 MCP client 的——对的：Streamable HTTP 这一档传输
// 就是 HTTP + JSON-RPC，网页发得出去。发不出去的只有 stdio 那种本地进程 MCP。
// 按协议自己实现，没有看 ai-virtual-phone 的代码（那边是 AGPL，只借思路）。
//
// 两件事必须先说清楚，它们决定了这一层能不能用：
//  ① 服务端要给 CORS 头。手机浏览器发的是跨域请求，服务端不放行就是 Load failed，
//     跟地址填没填对无关——所以错误信息里必须点名 CORS，不然她只会以为是网断了。
//  ② 走 Streamable HTTP（通常以 /mcp 结尾）。旧的 /sse 那一档要长连接加回传通道，
//     浏览器直连做不了；那种得先用 cloudflared / ngrok 之类转成公网 HTTPS。
(function () {
  "use strict";
  const PROTO = "2025-06-18";           // 协议版本；服务端会在 initialize 里回它自己认的那个
  const CACHE_KEY = "x_mcpTools";        // tools/list 的结果缓存：每轮都去列一遍太慢也没必要
  const CACHE_TTL = 30 * 60 * 1000;

  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const servers = () => (load("x_mcp", []) || []).filter(s => s && s.url);
  const enabled = () => servers().filter(s => s.on !== false);

  // 一台服务器一个会话：initialize 之后服务端可能发回 Mcp-Session-Id，后续每一发都要带上
  const sessions = {};
  // 握过手的记在这儿，不跟会话号混在一张表：原来没发会话号的服务端被塞一个 "-" 占位，
  //   后面每一发都把 "-" 当会话号带出去，认会话的服务端就回 400/404「会话无效」（她 2026-10-09 一起查出来的）。
  const shook = {};

  function rpcBody(method, params, id) {
    const b = { jsonrpc: "2.0", method: method };
    if (params) b.params = params;
    if (id != null) b.id = id;
    return JSON.stringify(b);
  }
  // 回包可能是 application/json，也可能是一段 SSE（text/event-stream）。
  // 两种都得认——只认一种的话，换一家服务端就整个哑掉。
  async function readRpc(r) { return parseRpc(String(r.headers.get("content-type") || ""), await r.text()); }
  function parseRpc(ct, text) {
    if (/text\/event-stream/i.test(ct)) {
      let last = null;
      text.split(/\r?\n/).forEach(line => {
        if (!line.startsWith("data:")) return;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") return;
        try { const j = JSON.parse(raw); if (j && (j.result || j.error)) last = j; } catch (e) {}
      });
      if (!last) throw new Error("服务端回了一段读不出结果的 SSE");
      return last;
    }
    if (!text.trim()) return null;         // 通知没有回包，正常
    try { return JSON.parse(text); } catch (e) { throw new Error("服务端回的不是 JSON：" + text.slice(0, 120)); }
  }

  // 转接（她 2026-10-09 定的 B 路）：用户自己在 Cloudflare 搭一个小转接（tools/mcp-relay-worker.js），
  //   填了地址就全部走它——服务器之间没有跨域，旧的 /sse 也由它代连。没填就照旧直连。
  const RELAY_KEY = "x_mcpRelay";
  const relay = () => { const r = load(RELAY_KEY, null); return r && /^https?:\/\//i.test(String(r.url || "")) ? r : null; };
  const isSse = url => /\/sse(\?|$)/i.test(String(url || "").split("#")[0]);
  const authOf = srv => srv.token ? (/^bearer /i.test(srv.token) ? srv.token : "Bearer " + srv.token) : "";
  async function viaRelay(rl, payload) {
    let r;
    try {
      r = await fetch(rl.url, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, rl.key ? { "X-Relay-Key": rl.key } : {}), body: JSON.stringify(payload) });
    } catch (e) { throw new Error("连不上你的转接（" + rl.url + "）：地址对不对、Worker 部署好了没？在浏览器里直接打开这个地址，应该看得到「转接在线 ✓」。"); }
    let w = null;
    try { w = await r.json(); } catch (e) {}
    if (!w) throw new Error("转接回了读不懂的东西（HTTP " + r.status + "）：多半是代码没贴全，重新复制一遍贴进去。");
    if (w.error) throw new Error(String(w.error));
    return w;
  }
  // 旧 /sse：一发里由转接连上、握手、问完——这边不用握手，也没有会话号
  async function sendSse(srv, method, params) {
    const rl = relay();
    if (!rl) throw new Error("这台是旧的 /sse 那一档，网页自己连不了——先在上面填好「转接地址」（照着教程在 Cloudflare 搭一个，免费）。");
    const j = await viaRelay(rl, { mode: "sse", url: srv.url, auth: authOf(srv), method: method, params: params || {} });
    if (j && j.error) throw new Error(String((j.error && j.error.message) || j.error || "MCP 报错"));
    return j ? j.result : null;
  }

  let _id = 0;
  async function send(srv, method, params, notify) {
    if (isSse(srv.url)) return notify ? null : sendSse(srv, method, params);
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    };
    if (srv.token) headers["Authorization"] = authOf(srv);
    if (sessions[srv.url]) headers["Mcp-Session-Id"] = sessions[srv.url];   // 只带服务端真发过来的那个
    const body = rpcBody(method, params, notify ? null : ++_id);
    const rl = relay();
    if (rl) {
      // 走转接：转接把对面的状态码、会话号、类型、正文原样带回来，下面照直连那一套认
      const w = await viaRelay(rl, { mode: "http", url: srv.url, headers: headers, body: body });
      if (w.sid) sessions[srv.url] = w.sid;
      if (w.status === 404 && sessions[srv.url] && method !== "initialize") { delete sessions[srv.url]; delete shook[srv.url]; }
      if (!(w.status >= 200 && w.status < 300)) throw new Error("这台 MCP 回了 HTTP " + w.status);
      if (notify) return null;
      const j = parseRpc(String(w.type || ""), String(w.body || ""));
      if (j && j.error) throw new Error(String((j.error && j.error.message) || "MCP 报错"));
      return j ? j.result : null;
    }
    let r;
    try {
      r = await fetch(srv.url, { method: "POST", headers: headers, body: body });
    } catch (e) {
      // 浏览器把 CORS 拒绝和网络不通报成同一个 TypeError，分不出来——所以两种可能都说，
      // 别让她对着「Load failed」猜一晚上。
      throw new Error("连不上这台 MCP（" + (srv.name || srv.url) + "）：要么服务端没放行跨域(CORS)，要么地址不对或没开。多半是跨域（服务端没回 Access-Control-Allow-Origin）——在上面填一个「转接地址」就能绕过去。");
    }
    const sid = r.headers.get("Mcp-Session-Id");
    if (sid) sessions[srv.url] = sid;
    if (r.status === 404 && sessions[srv.url] && method !== "initialize") {
      // 会话过期（服务端重启过）：协议规定回 404，客户端该重新握手。清掉，下一发自己会重握。
      delete sessions[srv.url]; delete shook[srv.url];
    }
    if (!r.ok) throw new Error("这台 MCP 回了 HTTP " + r.status + (r.status === 405 ? "（这个地址多半是旧的 /sse 那一档，不是 Streamable HTTP，网页直连不了，填好上面的「转接地址」就能连）" : ""));
    if (notify) return null;
    const j = await readRpc(r);
    if (j && j.error) throw new Error(String((j.error && j.error.message) || "MCP 报错"));
    return j ? j.result : null;
  }

  async function handshake(srv) {
    if (shook[srv.url] || isSse(srv.url)) return;   // /sse 每一发都由转接自己握手
    await send(srv, "initialize", { protocolVersion: PROTO, capabilities: {}, clientInfo: { name: "milkbun", version: "1" } });
    shook[srv.url] = true;   // 有的服务端不发会话号：记「握过了」，免得每次重握手，但不编一个假会话号
    try { await send(srv, "notifications/initialized", {}, true); } catch (e) {}
  }

  // 工具名要带上服务器前缀：两台服务器都叫 search 的时候，模型说 search 我们不知道找谁。
  const qualify = (srv, name) => (srv.id || "mcp") + "__" + name;
  const unqualify = full => { const i = String(full || "").indexOf("__"); return i < 0 ? { sid: "", name: String(full || "") } : { sid: full.slice(0, i), name: full.slice(i + 2) }; };

  async function listTools(force) {
    const cache = load(CACHE_KEY, {}) || {};
    const out = [];
    for (const srv of enabled()) {
      const c = cache[srv.url];
      if (!force && c && c.ts && Date.now() - c.ts < CACHE_TTL && Array.isArray(c.tools)) {
        c.tools.forEach(t => out.push(t));
        continue;
      }
      await handshake(srv);
      const res = await send(srv, "tools/list", {});
      const tools = ((res && res.tools) || []).map(t => ({
        name: qualify(srv, t.name),
        raw: t.name,
        server: srv.url,
        serverName: srv.name || srv.url,
        description: String(t.description || "").slice(0, 400),
        input_schema: t.inputSchema || t.input_schema || { type: "object", properties: {} }
      }));
      cache[srv.url] = { ts: Date.now(), tools: tools };
      tools.forEach(t => out.push(t));
    }
    save(CACHE_KEY, cache);
    return out;
  }

  // 调一件工具。失败【不抛】——把错误当成工具的返回喂回给模型，让TA自己说
  // 「查不到」，而不是整轮对话炸掉。她按次计费，一轮炸掉就是白扣一次。
  async function callTool(full, args) {
    const { sid, name } = unqualify(full);
    const srv = enabled().find(s => (s.id || "mcp") === sid) || enabled()[0];
    if (!srv) return { text: "（没有可用的 MCP 服务器）", isError: true };
    try {
      await handshake(srv);
      const res = await send(srv, "tools/call", { name: name, arguments: args || {} });
      const text = (((res && res.content) || []).map(b => {
        if (!b) return "";
        if (b.type === "text") return String(b.text || "");
        if (b.type === "resource" && b.resource) return String(b.resource.text || b.resource.uri || "");
        return "";
      }).filter(Boolean).join("\n")).trim();
      return { text: text || "（这次没返回内容）", isError: !!(res && res.isError) };
    } catch (e) {
      return { text: "（工具没调通：" + String((e && e.message) || e) + "）", isError: true };
    }
  }

  // 试一台：设置页那颗「测一下」按钮用，让她当场看得见通没通、有几件工具
  async function probe(srv) {
    delete sessions[srv.url]; delete shook[srv.url];
    await handshake(srv);
    const res = await send(srv, "tools/list", {});
    return ((res && res.tools) || []).map(t => t.name);
  }

  if (typeof window !== "undefined") window.MCP = {
    relay: relay, setRelay: v => { save(RELAY_KEY, v && v.url ? { url: String(v.url).trim(), key: String(v.key || "").trim() } : null); }, isSse: isSse,
    servers: servers, enabled: enabled, listTools: listTools, callTool: callTool, probe: probe,
    forget: () => { save(CACHE_KEY, {}); Object.keys(sessions).forEach(k => delete sessions[k]); Object.keys(shook).forEach(k => delete shook[k]); },
    qualify: qualify, unqualify: unqualify, PROTO: PROTO
  };
  if (typeof module === "object" && module.exports) module.exports = { qualify: qualify, unqualify: unqualify, isSse: isSse, parseRpc: parseRpc };
})();
