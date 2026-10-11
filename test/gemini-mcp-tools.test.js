// 她 2026-10-11 转群友：「连好 mcp 了显示有工具还是调用不了」——Gemini 原生那条方言原来压根没带工具
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const seg = (() => { const i = eng.indexOf('  if (fmt === "gemini") {\n    // MCP 工具'), j = eng.indexOf('  const root = base.endsWith("/v1")', i); assert.ok(i > 0 && j > i, "抠不出 gemini 那段"); return eng.slice(i, j); })();

test("Gemini 那条也声明工具、跑工具、把结果接回去，回合封顶", () => {
  assert.match(seg, /if \(gTools\) gBody\.tools = gTools;/);
  assert.match(seg, /\{ functionDeclarations: _mcpTools\.map\(/);
  assert.match(seg, /for \(let _r = 0; _r < _maxRounds; _r\+\+\)/);
  assert.match(seg, /await _runTool\(c\.functionCall\.name, c\.functionCall\.args \|\| \{\}\)/);
  assert.match(seg, /functionResponse: \{ name: c\.functionCall\.name, response: \{ content:/);
  assert.match(seg, /_meta\.toolCalls = _meta\.toolCalls \|\| \[\]/, "调用记录里得看得见用了哪个工具");
});

test("递给 Gemini 的参数表洗掉它不认的那些键", () => {
  const i = seg.indexOf("    const gSchema = sch => {"), j = seg.indexOf("    const gTools = ", i);
  const gSchema = new Function(seg.slice(i, j) + "\nreturn gSchema;")();
  const out = gSchema({ $schema: "x", type: "object", additionalProperties: false, properties: { q: { type: ["string", "null"], description: "关键词", default: "" }, n: { type: "integer", minimum: 1 } }, required: ["q", "ghost"] });
  assert.deepEqual(JSON.parse(JSON.stringify(out)), { type: "object", properties: { q: { type: "string", description: "关键词" }, n: { type: "integer" } }, required: ["q"] });
  assert.deepEqual(JSON.parse(JSON.stringify(gSchema(null))), { type: "object", properties: {} });
});
