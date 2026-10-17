const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const mcp = fs.readFileSync(__dirname + "/../js/mcp.js", "utf8"), as = fs.readFileSync(__dirname + "/../js/assistant.js", "utf8");
test("MCP 记每台这次开机通没通，并导出 status", () => {
  assert.match(mcp, /status: status/);
  assert.equal((mcp.match(/note\(srv, e\)/g) || []).length, 3);
  assert.match(mcp, /填了令牌: !!s\.token/);
  assert.doesNotMatch(mcp, /localStorage\.setItem\("x_mcpErr/);
});
test("秋秋聊到 mcp 才带 MCP现状", () => {
  assert.match(as, /\/mcp\|MCP\|转接[^\n]*MCP现状: window\.MCP\.status\(\)/);
  assert.match(as, /MCP怎么看/);
});
