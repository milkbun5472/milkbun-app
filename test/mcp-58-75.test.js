const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const mcp = R("mcp.js"), eng = R("engine.js"), app = R("app.js"), scr = R("screens.js"), comp = R("components.js");
const { qualify, unqualify } = require("../js/mcp.js");
const grab = (src, a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};

// 她 2026-08-31 贴了 ai-virtual-phone 的说明：浏览器能直接连 MCP。对的——
// Streamable HTTP 就是 HTTP + JSON-RPC。（照协议自己写，没抄那边的 AGPL 代码。）
test("两台服务器都叫 search 时，认得出该找谁", () => {
  const full = qualify({ id: "m_1" }, "search");
  assert.equal(full, "m_1__search");
  assert.deepEqual(unqualify(full), { sid: "m_1", name: "search" });
  // 工具名里本来就带下划线的别被切坏
  assert.deepEqual(unqualify("m_2__brave_web_search"), { sid: "m_2", name: "brave_web_search" });
  // 没前缀的也别炸
  assert.deepEqual(unqualify("search"), { sid: "", name: "search" });
  assert.match(mcp, /const qualify = \(srv, name\) => \(srv\.id \|\| "mcp"\) \+ "__" \+ name;/);
});

test("回包 JSON 和 SSE 两种都要认——只认一种,换一家服务端就整个哑掉", () => {
  const rd = grab(mcp, "  async function readRpc(r) {", "  let _id = 0;").split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.match(rd, /if \(\/text\\\/event-stream\/i\.test\(ct\)\)/, "没按 content-type 分出 SSE 那一路");
  assert.match(rd, /line\.startsWith\("data:"\)/, "SSE 那一路没按 data: 行拆");
  assert.match(rd, /if \(!text\.trim\(\)\) return null;/, "通知没有回包,这里会当成错误");
  assert.match(rd, /JSON\.parse\(text\)/, "不认普通 JSON");
});

test("握手、会话号、密钥", () => {
  assert.match(mcp, /await send\(srv, "initialize", \{ protocolVersion: PROTO/, "没握手就 tools\/list");
  assert.match(mcp, /if \(sid\) sessions\[srv\.url\] = sid;/, "服务端发的会话号没收下——后面每一发都会被当成新会话");
  assert.match(mcp, /headers\["Mcp-Session-Id"\] = sessions\[srv\.url\]/, "会话号没带回去");
  assert.match(mcp, /notifications\/initialized/, "少了握手最后那一步");
  assert.match(mcp, /"Bearer " \+ srv\.token/, "密钥没加上");
});

// 她只会看见「连不上」，得替她把两个真凶点名
test("连不上时要点名 CORS 和 /sse，不能只说失败", () => {
  const sd = grab(mcp, "  async function send(srv, method, params, notify) {", "  async function handshake(");
  assert.match(sd, /CORS/, "没点名跨域——浏览器把跨域拒绝和网络不通报成同一个错,她只会以为是网断了");
  assert.match(sd, /Access-Control-Allow-Origin/, "没说清服务端要回什么头");
  assert.match(sd, /r\.status === 405[\s\S]{0,120}Streamable HTTP/, "405 多半是旧的 \/sse，没提示她换地址");
});

test("工具调不通不许炸掉整轮——她按次计费，炸一轮就是白扣一次", () => {
  const ct = grab(mcp, "  async function callTool(full, args) {", "  async function probe(");
  assert.match(ct, /catch \(e\) \{\n      return \{ text: "（工具没调通：/, "抛出去了,整轮对话会挂");
  assert.match(ct, /isError: true/, "没告诉模型这次是失败的");
  assert.ok(!/throw /.test(ct.replace(/\/\/.*/g, "")), "调工具这一层还有往外抛的路");
});

test("工具清单缓存，不是每轮都去列一遍", () => {
  assert.match(mcp, /const CACHE_TTL = 30 \* 60 \* 1000;/);
  assert.match(mcp, /Date\.now\(\) - c\.ts < CACHE_TTL/, "缓存没设过期");
  assert.match(mcp, /forget: \(\) => \{ save\(CACHE_KEY, \{\}\)/, "改了服务器配置没法让缓存作废");
  assert.match(scr, /if \(window\.MCP\) window\.MCP\.forget\(\);/, "设置页改完没清缓存——加了新服务器半小时内都用不上");
});

test("接进两条链，而且只对开了开关的角色发", () => {
  assert.match(app, /if \(_wantWeb && window\.MCP && window\.MCP\.enabled\(\)\.length\)/, "单聊那条链没接,或者没按开关发");
  assert.match(app, /if \(_gWantWeb && window\.MCP && window\.MCP\.enabled\(\)\.length\)/, "群聊那条链没接");
  // 列工具失败不该拦住这一轮说话
  assert.match(app, /catch \(e\) \{ console\.warn\("\[mcp\] 列工具失败：", e\); \}/, "列工具失败会把整轮聊天拦掉");
  assert.match(app, /tools: _mcpT, runTool: \(n, ar\) => window\.MCP\.callTool\(n, ar\)/, "单聊没把工具和跑工具的手递进去");
  assert.match(app, /tools: _gMcpT,\n        runTool: \(n, ar\) => window\.MCP\.callTool\(n, ar\),/, "群聊没递");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(html.indexOf("js/mcp.js") > 0 && html.indexOf("js/mcp.js") < html.indexOf("js/app.js"), "mcp.js 没加载,或者在 app.js 之后才加载");
});

test("这一档要花几次调用，必须自己冒出来", () => {
  assert.match(eng, /if \(_meta\) _meta\.calls = _calls;/, "anthropic 那边没记花了几次");
  assert.match(eng, /if \(_meta\) _meta\.calls = _calls2;/, "openai 那边没记");
  assert.match(app, /\(_callMeta\.calls > 1\) \? \{ callCount: _callMeta\.calls \}/, "没挂到气泡上");
  assert.match(comp, /if \(m\.callCount > 1\) bits\.push\("这一轮花了 " \+ m\.callCount \+ " 次调用"\)/, "画面上看不见花了几次");
  assert.match(scr, /用上工具的那一轮至少花两次调用/, "设置页没把代价写出来");
});

test("带工具时不走流式——tool_calls 在 SSE 里是碎的，拼错就是调错工具", () => {
  assert.match(eng, /const wantStream = !!\(opts && opts\.stream\) && !\(_mcpTools && _mcpTools\.length\);/, "带工具还走流式");
});
