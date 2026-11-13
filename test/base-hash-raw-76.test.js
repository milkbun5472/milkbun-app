const test = require("node:test"); const assert = require("node:assert");
const E = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const i = E.indexOf("function oaRootOf"), j = E.indexOf("function nativeHttpHandler");
const oaRootOf = new Function(E.slice(i, E.indexOf("function openAICompatibleRoot")) + "; return oaRootOf;")();
test("接口地址结尾写 # 就原样用，不补 /v1", () => {
  assert.equal(oaRootOf("https://x.com/api/relay#"), "https://x.com/api/relay");
  assert.equal(oaRootOf("https://x.com/api/relay"), "https://x.com/api/relay/v1");
  assert.equal(oaRootOf("https://open.bigmodel.cn/api/paas/v4"), "https://open.bigmodel.cn/api/paas/v4");
  assert.ok(!/\/v\\d\+\$\/i\.test\(base\) \? base : base \+ "\/v1"/.test(E), "还有一份自己拼 /v1 的");
  assert.ok(j > i);
});
