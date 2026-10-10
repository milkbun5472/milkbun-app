// MCP 转接（她 2026-10-09 定的 B 路）：本机起两台假 MCP（新的 Streamable HTTP、旧的 /sse），
//   再把 tools/mcp-relay-worker.js 包成一台本机服务器，让 js/mcp.js 真的经转接去连，整条链跑一遍。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const workerSrc = fs.readFileSync(path.join(ROOT, "tools/mcp-relay-worker.js"), "utf8");
const worker = new Function("module", workerSrc.replace("export default", "module.exports =") + "\nreturn module.exports;")({});

const TOOLS = [{ name: "echo", description: "原样回一句", inputSchema: { type: "object", properties: { text: { type: "string" } } } }];
const answer = (msg, sid) => {
  if (msg.method === "initialize") return { jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "fake", version: "1" } } };
  if (msg.method === "tools/list") return { jsonrpc: "2.0", id: msg.id, result: { tools: TOOLS } };
  if (msg.method === "tools/call") return { jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "回声：" + (msg.params.arguments.text || "") + (sid ? "（会话 " + sid + "）" : "") }] } };
  return null;
};
const readBody = req => new Promise(res => { let d = ""; req.on("data", c => d += c); req.on("end", () => res(d)); });
const listen = srv => new Promise(res => srv.listen(0, "127.0.0.1", () => res(srv.address().port)));

let ports = {}, servers = [];
test.before(async () => {
  // 新式：要会话号，没带对就 400（不放行跨域——正好是要转接的那种）
  const httpMcp = http.createServer(async (req, res) => {
    const msg = JSON.parse(await readBody(req) || "{}");
    if (msg.method !== "initialize" && req.headers["mcp-session-id"] !== "s-123") { res.writeHead(400); return res.end("bad session"); }
    if (!msg.id) { res.writeHead(202); return res.end(); }
    const out = answer(msg, msg.method === "initialize" ? "" : "s-123");
    res.writeHead(200, Object.assign({ "Content-Type": "application/json" }, msg.method === "initialize" ? { "Mcp-Session-Id": "s-123" } : {}));
    res.end(JSON.stringify(out));
  });
  // 旧式 /sse：GET 开长连接、先报 endpoint；POST 回 202，答案从长连接里推回去
  let stream = null;
  const sseMcp = http.createServer(async (req, res) => {
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      stream = res;
      res.write("event: endpoint\ndata: /messages?session=abc\n\n");
      return;
    }
    const msg = JSON.parse(await readBody(req) || "{}");
    res.writeHead(202); res.end("Accepted");
    const out = answer(msg, "");
    if (out && stream) stream.write("event: message\ndata: " + JSON.stringify(out) + "\n\n");
  });
  // 转接：把 Worker 的 fetch 包成一台本机服务器
  const relaySrv = http.createServer(async (req, res) => {
    const body = req.method === "POST" ? await readBody(req) : undefined;
    const r = await worker.fetch(new Request("http://relay" + req.url, { method: req.method, headers: req.headers, body: body }), {});
    res.writeHead(r.status, Object.fromEntries(r.headers.entries()));
    res.end(await r.text());
  });
  servers = [httpMcp, sseMcp, relaySrv];
  ports.http = await listen(httpMcp); ports.sse = await listen(sseMcp); ports.relay = await listen(relaySrv);
});
test.after(() => servers.forEach(s => { s.closeAllConnections && s.closeAllConnections(); s.close(); }));

function loadMcp(store) {
  const g = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, fetch: fetch };
  g.window = g;
  new Function("window", "localStorage", "fetch", "module", fs.readFileSync(path.join(ROOT, "js/mcp.js"), "utf8"))(g, g.localStorage, fetch, undefined);
  return g.MCP;
}

test("新式 /mcp 经转接：握手拿到会话号、列工具、调工具都通", async () => {
  const store = { x_mcp: JSON.stringify([{ id: "a", name: "假的", url: "http://127.0.0.1:" + ports.http + "/mcp" }]), x_mcpRelay: JSON.stringify({ url: "http://127.0.0.1:" + ports.relay + "/" }) };
  const MCP = loadMcp(store);
  const tools = await MCP.listTools(true);
  assert.deepEqual(tools.map(t => t.name), ["a__echo"]);
  const out = await MCP.callTool("a__echo", { text: "你好" });
  assert.equal(out.isError, false, out.text);
  assert.equal(out.text, "回声：你好（会话 s-123）");
});

test("旧式 /sse 经转接：连上、等 endpoint、握手、从长连接接回答案", async () => {
  const store = { x_mcp: JSON.stringify([{ id: "b", name: "旧的", url: "http://127.0.0.1:" + ports.sse + "/sse" }]), x_mcpRelay: JSON.stringify({ url: "http://127.0.0.1:" + ports.relay + "/" }) };
  const MCP = loadMcp(store);
  const names = await MCP.probe(MCP.servers()[0]);
  assert.deepEqual(names, ["echo"]);
  const out = await MCP.callTool("b__echo", { text: "旧的也行" });
  assert.equal(out.text, "回声：旧的也行", out.text);
});

test("/sse 没填转接：说清楚要先填转接，不装作连上", async () => {
  const MCP = loadMcp({ x_mcp: JSON.stringify([{ id: "b", url: "http://127.0.0.1:" + ports.sse + "/sse" }]) });
  await assert.rejects(MCP.probe(MCP.servers()[0]), /转接地址/);
});

test("转接加了口令：口令不对就拒", async () => {
  const r = await worker.fetch(new Request("http://relay/", { method: "POST", body: JSON.stringify({ url: "https://x/mcp" }), headers: { "X-Relay-Key": "wrong" } }), { RELAY_KEY: "right" });
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "*", "拒的时候也得带跨域头，不然网页那头只看得到 Load failed");
});

// 「复制转接代码」是原样复制出去的（她 2026-10-10：「怎么把我们讨论的也发上去了」）——
//   文件里只许有给贴代码的人看的使用说明，不许出现开发记录
test("转接代码里没有开发记录", () => {
  // 只查注释：代码里的协议版本号（2024-11-05）本来就长得像日期
  const comments = (workerSrc.match(/\/\/[^\n]*/g) || []).join("\n");
  assert.doesNotMatch(comments, /她|\d{4}-\d{2}-\d{2}|js\/mcp\.js|B 路/);
});
