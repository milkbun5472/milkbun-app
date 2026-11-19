// 她 2026-11-19：「其他写长一点的地方也做一个公共处理放长一点」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
test("写长文的那几枪都用 engine 里那一份 LONG_WRITE", () => {
  const e = R("js/engine.js");
  assert.match(e, /const LONG_WRITE = Object\.freeze\(\{ timeout: 600000, stream: true \}\);/);
  assert.equal((e.match(/timeout: LONG_WRITE\.timeout/g) || []).length, 4, "单人线下两枪、群线下两枪");
  assert.match(e, /"【线下经过】\\n" \+ body \}\], \{ maxTokens: 12000, \.\.\.LONG_WRITE \}/);
  assert.match(e, /maxTokens: opts\.maxTokens \|\| 14000, \.\.\.LONG_WRITE \}/);
  assert.equal((R("js/theater.js").match(/\.\.\.LONG_WRITE \}/g) || []).length, 4);
  assert.match(R("js/trpg.js"), /maxTokens: TOK_MAX, \.\.\.LONG_WRITE \}/);
  assert.match(R("js/weekly.js"), /maxTokens: tok, \.\.\.\(typeof LONG_WRITE === "object" \? LONG_WRITE : \{\}\)/);
  assert.match(R("js/impression-core.js"), /\.\.\.\(typeof LONG_WRITE === "object" \? LONG_WRITE/);
  assert.match(R("js/fanfic-core.js"), /const FIC_WRITE_OPTS = typeof LONG_WRITE === "object" \? LONG_WRITE/);
});
test("邮票册写长的那几枪也走 LONG_WRITE；runProbe 认 stream", () => {
  const a = R("js/app.js"), e = R("js/engine.js");
  assert.match(e, /\.\.\.\(probe && probe\.stream \? \{ stream: true \} : \{\}\)/);
  ["stampshop", "stampstory", "stampdispatch", "stampduel"].forEach(t => assert.match(a, new RegExp('\\{ \\.\\.\\.LONG_WRITE, voice: true, tag: "' + t + '"'), t));
  assert.equal((a.match(/stampCtx\(char, [^)]*\), \{ \.\.\.LONG_WRITE,/g) || []).length, 4, "写卡那四枪");
});
