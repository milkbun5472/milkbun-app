// 主动私聊加「很高频」（她 2026-10-11 转群友：开了高频还是要等很久）：快四倍，走同一个 rateX
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/auto-refresh-policy.js");

test("很高频是第四档，倍数 4，存得上、读得回", () => {
  const f = P.FEATURES.find(x => x.id === "proactive");
  assert.deepEqual(f.rates.map(r => r.id), ["low", "mid", "high", "max", "cling"]);
  const p = P.setRate(P.normalize({}), "proactive", "max");
  assert.equal(P.rateX(p, "proactive"), 4);
  assert.ok(f.rates.find(r => r.id === "max").note);
});

// 黏人（她 2026-10-14 转群友：水课十几分钟开一次，每次都要我先发）：只管挑了它的人
test("黏人是第五档：倍数 24，底线 15 分钟；别的档底线照旧 45", () => {
  const p = P.setRate(P.normalize({}), "proactive", "cling");
  assert.equal(P.rateX(p, "proactive"), 24);
  const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
  assert.match(app, /const proactiveFloorMin = \(charId, jw\) => !jw \? 180\s*: \([^\n]*=== "cling"\) \? 15 : 45;/);
  assert.equal((app.match(/const floorMin = proactiveFloorMin\(cid, jw\);/g) || []).length, 2, "主动那一路和「卡在哪儿」那一页要用同一道底线");
  assert.ok(!/const floorMin = jw \? 45 : 180;/.test(app));
});
