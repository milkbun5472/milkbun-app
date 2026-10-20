// 群友 2026-10-21：智谱官网 https://open.bigmodel.cn/api/paas/v4 聊天全挂——被补成 /v4/v1/chat/completions。
const test = require("node:test");
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "../js/engine.js"), "utf8");
test("结尾已带 /v数字 的不再补 /v1；裸域名照旧补", () => {
  const f = new Function("normalizedOpenAIBase", eng.match(/function openAICompatibleRoot\(value\) \{[\s\S]*?\n\}/)[0] + ";return openAICompatibleRoot;")(x => x);
  assert.equal(f("https://open.bigmodel.cn/api/paas/v4"), "https://open.bigmodel.cn/api/paas/v4");
  assert.equal(f("https://ark.cn-beijing.volces.com/api/v3"), "https://ark.cn-beijing.volces.com/api/v3");
  assert.equal(f("https://api.x.com"), "https://api.x.com/v1");
  assert.equal(f("https://api.x.com/v1"), "https://api.x.com/v1");
  assert.equal((eng.match(/base\.endsWith\("\/v1"\) \? base : base \+ "\/v1"/g) || []).length, 0, "还有只认 /v1 的那几处");
});
