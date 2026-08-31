const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");

// 这一份【真的把服务器起起来】按协议对话，不是对着源码做字符串比对——
// MCP 服务器错在哪儿，基本都错在头和状态码上，那些只有真跑才看得见。
const SRV = path.join(__dirname, "..", "scripts", "mcp-server.mjs");
const PORT = 8793, TOKEN = "t0ken", BASE = "http://127.0.0.1:" + PORT + "/mcp";
let proc;
const rpc = async (method, params, token, id) => {
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = "Bearer " + token;
  const r = await fetch(BASE, { method: "POST", headers: h, body: JSON.stringify({ jsonrpc: "2.0", id: id == null ? 1 : id, method, params }) });
  const text = await r.text();
  return { status: r.status, headers: r.headers, body: text ? JSON.parse(text) : null };
};

test.before(async () => {
  proc = spawn(process.execPath, [SRV], { env: { ...process.env, PORT: String(PORT), MCP_TOKEN: TOKEN }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    try { await fetch("http://127.0.0.1:" + PORT + "/", { method: "GET" }); return; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error("服务器没起来");
});
test.after(() => { if (proc) proc.kill(); });

// 浏览器直连的全部关卡都在这三个头上。少一个，手机上就是一句「Load failed」。
test("预检要放行 mcp-session-id 和 authorization，还要把会话号 expose 出去", async () => {
  const r = await fetch(BASE, { method: "OPTIONS" });
  assert.equal(r.status, 204);
  assert.ok(r.headers.get("access-control-allow-origin"), "没有 Access-Control-Allow-Origin,浏览器一个字都拿不到");
  const allow = String(r.headers.get("access-control-allow-headers") || "").toLowerCase();
  ["content-type", "authorization", "mcp-session-id"].forEach(k =>
    assert.ok(allow.includes(k), "预检没放行这个请求头：" + k));
  // 会话号在【响应头】上，不 expose 浏览器就读不到，于是每一发都被当成新会话
  assert.match(String(r.headers.get("access-control-expose-headers") || "").toLowerCase(), /mcp-session-id/, "会话号没 expose 出去");
});

test("口令挡在所有方法之前——tools/list 也不许白送", async () => {
  assert.equal((await rpc("initialize", {})).status, 401, "不带口令就放进来了");
  assert.equal((await rpc("tools/list", {}, "wrong")).status, 401, "口令错了还给列工具");
  assert.equal((await rpc("tools/list", {}, TOKEN)).status, 200);
});

test("握手 → 列工具", async () => {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t" } }, TOKEN);
  assert.ok(init.body.result.protocolVersion, "没回协议版本");
  assert.ok(init.headers.get("mcp-session-id"), "没发会话号");
  const nt = await fetch(BASE, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + TOKEN }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
  assert.equal(nt.status, 202, "通知该回 202 且没有 body");
  const list = (await rpc("tools/list", {}, TOKEN)).body.result.tools;
  assert.deepEqual(list.map(t => t.name).sort(), ["fetch_url", "web_search"]);
  list.forEach(t => {
    assert.ok(t.description && t.description.length > 8, t.name + " 没有描述——模型不知道什么时候该用它");
    assert.equal(t.inputSchema.type, "object", t.name + " 的入参 schema 不对");
    assert.ok((t.inputSchema.required || []).length, t.name + " 没标哪个参数是必填");
  });
});

// 工具自己失败【不是】协议错。回成 JSON-RPC error 的话，客户端那边会当成整台服务器
// 挂了；回成带 isError 的 result，模型才能读到那句话、自己说「查不到」。
test("工具失败回的是 result 不是 error——不然那一轮对话就炸了", async () => {
  const bad = await rpc("tools/call", { name: "没有这件工具", arguments: {} }, TOKEN);
  assert.equal(bad.status, 200);
  assert.ok(!bad.body.error, "把工具失败回成协议错了");
  assert.equal(bad.body.result.isError, true, "没标成失败");
  assert.match(bad.body.result.content[0].text, /工具没跑通/, "没把话说给模型听");
});

test("入参不对就好好说话，不往外抛", async () => {
  const r = await rpc("tools/call", { name: "fetch_url", arguments: { url: "不是个网址" } }, TOKEN);
  assert.equal(r.status, 200);
  assert.ok(!r.body.error);
  assert.match(r.body.result.content[0].text, /http\(s\):\/\//, "没告诉模型该怎么改");
  const r2 = await rpc("tools/call", { name: "web_search", arguments: {} }, TOKEN);
  assert.match(r2.body.result.content[0].text, /没给搜索词/, "空搜索词没兜住");
});

test("不认识的方法回 -32601，不是 500", async () => {
  const r = await rpc("resources/list", {}, TOKEN);
  assert.equal(r.status, 200);
  assert.equal(r.body.error.code, -32601);
});

test("直接用浏览器打开时给句人话，别是空白页", async () => {
  const r = await fetch("http://127.0.0.1:" + PORT + "/", { method: "GET" });
  const t = await r.text();
  assert.match(t, /MCP 服务器活着/);
  assert.match(t, /口令：已设/, "没告诉她口令设没设——没设就是谁都能用");
});
