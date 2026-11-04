// 「Load failed / Failed to fetch」只说明这一枪没打出去，说不出是哪一种。
// 原来一口咬定「写得太长」，群里有人照着调「最低字数」调了半天（2026-11-03）。
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const a = src.indexOf("function isNetFail(");
const b = src.indexOf("async function fetchT(", a);
assert.ok(a > 0 && b > a, "抠不出 isNetFail / netFailMsg");
const api = new Function(src.slice(a, b) + "; return { isNetFail, netFailMsg };")();

test("认得出这一族报错，别的错不碰", () => {
  for (const m of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource"]) {
    assert.ok(api.isNetFail(new Error(m)), m);
  }
  assert.ok(!api.isNetFail(new Error("429 Too Many Requests")));
  assert.ok(!api.isNetFail(new Error("请求超时，请重试（模型或网络太慢）")));
});

test("三种成因都说到，不把话说死在「写太长」上", () => {
  const m = api.netFailMsg(new Error("Failed to fetch"));
  assert.ok(m.includes("最低字数"), "没提长请求被掐断");
  assert.ok(m.includes("跨域预检"), "没提预检失败被记住那一种");
  assert.ok(/十几分钟|自己就好/.test(m), "没说这种会自己好");
  assert.ok(m.includes("原始报错：Failed to fetch"), "没带原始报错");
  assert.ok(!/^连接中断了（Load failed）。多半是/.test(m), "又把话说死成单一原因了");
});

test("fetchT 和拉模型列表走同一段话，不各写一份", () => {
  const f = src.indexOf("async function fetchT(");
  assert.ok(src.slice(f, src.indexOf("\n}\n", f)).includes("netFailMsg(e)"), "fetchT 没用公共那段");
  const g = src.indexOf("async function fetchModelList(p)");
  assert.ok(g > 0 && src.slice(g, src.indexOf("async function fetchModelListRaw", g)).includes("netFailMsg(e)"),
    "拉模型列表还在裸抛英文 Failed to fetch");
  assert.strictEqual(src.split("多半是这次要写得太长").length - 1, 0, "旧那句断言式的话还留着");
});
