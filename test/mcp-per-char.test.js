const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const mcp = R("mcp.js"), app = R("app.js"), comp = R("components.js");

// 她 2026-10-11：「搞个可以分开每个人能 access 什么 mcp 不然十个服务器工具噎死模型」「先整套默认都开」
test("每个角色能关掉某几台；存的是关掉的，新接一台默认人人都有", () => {
  assert.match(mcp, /async function listTools\(force, off\)/);
  assert.match(mcp, /enabled\(\)\.filter\(x => skip\.indexOf\(sid\(x\)\) < 0\)/);
  assert.match(comp, /const \[mcpOff, setMcpOff\] = useState\(Array\.isArray\(settings\.mcpOff\)/);
  assert.match(comp, /"data-wk": "mcppick"/);
});
test("单聊、群聊两条链都按勾选递工具", () => {
  assert.match(app, /window\.MCP\.listTools\(false, _s\.mcpOff\)/, "单聊");
  assert.match(app, /window\.MCP\.listTools\(false, _gOff\)/, "群聊");
  // 群里：在场开着上网的人全关了这台，才不带
  assert.match(app, /_gOn\.every\(cs => \(cs\.mcpOff \|\| \[\]\)\.indexOf\(id\) >= 0\)/);
});
