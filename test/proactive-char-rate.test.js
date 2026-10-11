// 主动私聊的档每人能单独挑（她 2026-10-11）：没挑过跟总的，挑了用自己的，清空回去跟总的
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const P = require("../js/auto-refresh-policy.js");

test("没挑过跟总的；挑了用自己的；清空回去跟总的；乱填的档不认", () => {
  let p = P.setRate(P.normalize({}), "proactive", "high");
  assert.equal(P.rateX(p, "proactive", "c1"), 2);
  p = P.setCharRate(p, "proactive", "c1", "max");
  assert.equal(P.rateX(p, "proactive", "c1"), 4);
  assert.equal(P.rateX(p, "proactive", "c2"), 2);
  assert.equal(P.rateX(p, "proactive"), 2);
  p = P.setCharRate(p, "proactive", "c1", "");
  assert.equal(P.rateX(p, "proactive", "c1"), 2);
  assert.deepEqual(P.normalize({ features: { proactive: { charRates: { c3: "zzz", c4: "low" } } } }).features.proactive.charRates, { c4: "low" });
});
test("想念的钟、冷却都按这个人的档走；聊天设置里有那一排并存回去", () => {
  const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
  const cmp = fs.readFileSync(require.resolve("../js/components.js"), "utf8");
  assert.doesNotMatch(app, /proactiveX\(\)/);
  assert.match(app, /const _px = proactiveX\(char\.id\);/);
  assert.match(app, /const _cool = 25 \* 60000 \/ proactiveX\(cid\);/);
  assert.match(app, /setCharRate\(autoRefreshRef\.current, "proactive", activeChar\.id, s\.proactiveRate\)/);
  assert.match(cmp, /"data-wk": "proactiverate"/);
  assert.match(cmp, /proactive,\n      proactiveRate,/);
  assert.match(cmp, /minHeight: 40, borderRadius: 999/);
});
