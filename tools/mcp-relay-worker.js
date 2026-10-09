// 秋秋机 · MCP 转接（贴进 Cloudflare Worker 用；她 2026-10-09 定的 B 路：谁用谁搭，不碰她的服务器）
//
// 为什么要它：手机浏览器直连 MCP，对方没放行跨域（CORS）就是「Load failed」；
//   旧的 /sse 那一档要一条长连接收回包，网页也接不住。服务器之间没有跨域这回事，
//   所以让这个小转接替手机去连，回来的东西原样交给秋秋机。
//
// 两种用法（秋秋机自己会挑，不用管）：
//   mode "http"：新的 Streamable HTTP（地址多半 /mcp 结尾）——照原样转一发，会话号带回来。
//   mode "sse" ：旧的 /sse——这一发里自己连上、握手、问完、拿到答案就断开。
//
// ⚠️这一份同时是秋秋机设置页「复制转接代码」那颗键复制出去的原文（js/mcp.js 去取 tools/mcp-relay-worker.js），改这里两边一起变。
// ⚠️想加口令：在 Cloudflare 这个 Worker 的「设置 → 变量」里加一个 RELAY_KEY，秋秋机那边填一样的。
//   不加也能用，只是别人知道这个地址也能借它转发。
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Relay-Key",
  "Access-Control-Max-Age": "86400"
};
const reply = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json" }, CORS) });
const WAIT_MS = 25000;

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return reply({ ok: true, hello: "秋秋机 MCP 转接在线 ✓" });
    const key = env && env.RELAY_KEY;
    if (key && req.headers.get("X-Relay-Key") !== key) return reply({ error: "转接口令不对" }, 403);
    let b;
    try { b = await req.json(); } catch (e) { return reply({ error: "发给转接的不是 JSON" }, 400); }
    if (!/^https?:\/\//i.test(String((b && b.url) || ""))) return reply({ error: "MCP 地址不对" }, 400);
    try {
      if (b.mode === "sse") return reply(await sseCall(b));
      const r = await fetch(b.url, { method: "POST", headers: b.headers || {}, body: b.body || "" });
      return reply({ status: r.status, sid: r.headers.get("Mcp-Session-Id") || "", type: r.headers.get("content-type") || "", body: await r.text() });
    } catch (e) {
      return reply({ error: "转接去连那台 MCP 失败：" + String((e && e.message) || e) }, 502);
    }
  }
};

// 旧 /sse：连上 → 等它报「消息往哪儿发」(endpoint) → 握手 → 问那一句 → 从长连接里接回答 → 断开
async function sseCall(b) {
  const ctl = new AbortController();
  let timer;
  const late = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("等了 " + WAIT_MS / 1000 + " 秒那台 MCP 还没回")), WAIT_MS); });
  const auth = b.auth ? { Authorization: b.auth } : {};
  try {
    const r = await Promise.race([fetch(b.url, { headers: Object.assign({ Accept: "text/event-stream" }, auth), signal: ctl.signal }), late]);
    if (!r.ok || !r.body) throw new Error("SSE 连不上：HTTP " + r.status);
    const waiting = {};
    let gotEndpoint;
    const endpointP = new Promise(res => { gotEndpoint = res; });
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "";
    const onEvent = raw => {
      let ev = "message", data = "";
      raw.split(/\r?\n/).forEach(l => {
        if (l.startsWith("event:")) ev = l.slice(6).trim();
        else if (l.startsWith("data:")) data += l.slice(5).trim();
      });
      if (ev === "endpoint") { gotEndpoint(data); return; }
      if (!data) return;
      try { const j = JSON.parse(data); if (j && j.id != null && waiting[j.id]) waiting[j.id](j); } catch (e) {}
    };
    (async () => {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let m;
        while ((m = /\r?\n\r?\n/.exec(buf))) { onEvent(buf.slice(0, m.index)); buf = buf.slice(m.index + m[0].length); }
      }
    })().catch(() => {});
    const ep = new URL(await Promise.race([endpointP, late]), b.url);
    new URL(b.url).searchParams.forEach((v, k) => { if (!ep.searchParams.has(k)) ep.searchParams.set(k, v); });   // ?key=xxx 这种别丢
    const post = msg => fetch(ep.toString(), { method: "POST", headers: Object.assign({ "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, auth), body: JSON.stringify(msg) });
    const ask = async (id, method, params) => {
      const answer = new Promise(res => { waiting[id] = res; });
      const pr = await post({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
      if (!pr.ok) throw new Error(method + " 被那台 MCP 拒了：HTTP " + pr.status);
      // 有的服务端不走长连接，直接在这一发的回包里答了
      const t = await pr.text();
      try { const j = JSON.parse(t); if (j && j.id === id) return j; } catch (e) {}
      return Promise.race([answer, late]);
    };
    await ask(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "milkbun-relay", version: "1" } });
    await post({ jsonrpc: "2.0", method: "notifications/initialized" }).catch(() => {});
    return await ask(2, b.method, b.params);
  } finally {
    clearTimeout(timer);
    ctl.abort();
  }
}
