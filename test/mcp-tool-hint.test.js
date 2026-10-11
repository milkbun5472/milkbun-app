// 她 2026-10-11：「我加了 firecrawl 他也不用」——工具递过去了，提示词里却一个字没提
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("有工具才加一段【你手上的工具】，列名字、说什么时候用；单聊两枪和群聊都带", () => {
  const i = app.indexOf("  const mcpToolHint = tools => {"), j = app.indexOf("  const mcpListFailed", i);
  assert.ok(i > 0 && j > i);
  const hint = new Function(app.slice(i, j) + "\nreturn mcpToolHint;")();
  assert.equal(hint(null), ""); assert.equal(hint([]), "");
  const s = hint([{ name: "fc__firecrawl_scrape", description: "Scrape a single URL" }]);
  assert.match(s, /【你手上的工具】/); assert.match(s, /fc__firecrawl_scrape（Scrape a single URL）/); assert.match(s, /先用工具查到，再照上面的格式回话/);
  assert.match(app, /callAI\(_route, system \+ mcpToolHint\(_mcpT\), aiMessages,/);
  assert.match(app, /callAI\(_route, system \+ mcpToolHint\(_mcpT\), retryMessages,/);
  assert.match(app, /callAI\(active, system \+ mcpToolHint\(_gMcpT\), \[\{/);
});
