const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");
const match = source.match(/function detectFormat\(u\) \{[\s\S]*?\n\}/);
assert.ok(match, "detectFormat source exists");
const context = {};
vm.runInNewContext(match[0] + ";this.detectFormat=detectFormat", context);

test("subscription proxy/model identifies Anthropic without anthropic baseUrl", () => {
  assert.equal(context.detectFormat({ baseUrl: "https://bridge.invalid", proxyRef: "FABLE_MAX", model: "fable" }), "anthropic");
  assert.equal(context.detectFormat({ baseUrl: "https://bridge.invalid", model: "claude-sonnet" }), "anthropic");
});

test("callAI detects the whole route rather than baseUrl alone", () => {
  assert.match(source, /async function callAI[\s\S]*?const fmt = detectFormat\(p\)/);
});

test("legacy URL format detection remains compatible", () => {
  assert.equal(context.detectFormat("https://api.anthropic.com"), "anthropic");
  assert.equal(context.detectFormat("https://generativelanguage.googleapis.com"), "gemini");
  assert.equal(context.detectFormat("https://api.openai.com"), "openai");
});
