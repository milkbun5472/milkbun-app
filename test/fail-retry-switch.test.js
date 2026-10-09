// 失败自动重试（她 2026-10-09）：设置里一个开关、默认开；每一处补打第二枪都先问它
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const eng = rd("engine.js"), app = rd("app.js"), th = rd("theater.js"), rpg = rd("trpg.js"), scr = rd("screens.js");

test("开关只有一处：engine 的 failRetryOn，默认开", () => {
  assert.match(eng, /function failRetryOn\(\) \{ try \{ return loadJSON\("x_failRetry", true\) !== false;/);
  assert.match(scr, /function FailRetryCard\(\)/);
  assert.match(scr, /saveJSON\("x_failRetry", v\)/);
  assert.match(scr, /h\(FailRetryCard, null\), h\(CallLogCard, null\)/);
});

test("每一处补打第二枪都先问开关", () => {
  assert.match(eng, /if \(!parsed && !probe\.once && failRetryOn\(\)\) \{/);
  assert.equal((eng.match(/if \(!failRetryOn\(\)\) throw e;/g) || []).length, 2, "单人线下、群线下空正文");
  assert.match(eng, /\(!beats \|\| !beats\.length\) && failRetryOn\(\)/);
  assert.match(app, /\|\| !failRetryOn\(\)\) throw firstErr;/);
  assert.match(app, /catch \(e\) \{ if \(!failRetryOn\(\)\) throw e; return await runProbe\(p, ctx, probe\); \}/);
  assert.match(app, /if \(!_hasAccept\(d\) && \(typeof failRetryOn !== "function" \|\| failRetryOn\(\)\)\) \{/);
  assert.match(th, /typeof failRetryOn === "function" && !failRetryOn\(\)\)\) return null;/);
  assert.match(rpg, /if \(!p && \(typeof failRetryOn !== "function" \|\| failRetryOn\(\)\)\) \{/);
});
