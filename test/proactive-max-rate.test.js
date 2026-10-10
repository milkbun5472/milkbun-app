// 主动私聊加「很高频」（她 2026-10-11 转群友：开了高频还是要等很久）：快四倍，走同一个 rateX
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/auto-refresh-policy.js");

test("很高频是第四档，倍数 4，存得上、读得回", () => {
  const f = P.FEATURES.find(x => x.id === "proactive");
  assert.deepEqual(f.rates.map(r => r.id), ["low", "mid", "high", "max"]);
  const p = P.setRate(P.normalize({}), "proactive", "max");
  assert.equal(P.rateX(p, "proactive"), 4);
  assert.ok(f.rates.find(r => r.id === "max").note);
});
