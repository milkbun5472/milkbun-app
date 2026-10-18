// 架空世界的天气跟着一座现实城市；天气卡可以按架空那边发（她 2026-10-17）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const WW = require("../js/world-weather.js");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");

test("跟上了：今天就是那座城的真实天气，别的世界、别的日子照旧", () => {
  const real = { t: 12, code: 63, dayCode: 63, hi: 14, lo: 9 };
  const plain = WW.dayOf("w2|集市", "荒漠", new Date());
  WW.setFollow(id => id === "w1" ? real : null);
  const d = WW.dayOf("w1|渡口", "荒漠", new Date());
  assert.equal(d.code, 63); assert.equal(d.t, 12); assert.equal(d.hi, 14); assert.equal(d.lo, 9);
  assert.deepEqual(WW.dayOf("w2|集市", "荒漠", new Date()), plain);
  const tmr = new Date(Date.now() + 86400000 * 2);
  assert.notEqual(WW.dayOf("w1|渡口", "荒漠", tmr).hi === 14 && WW.dayOf("w1|渡口", "荒漠", tmr).code === 63, true);
  WW.setFollow(null);
});

test("天气卡按架空发时不带现实地名；开关有挂点", () => {
  const app = read("app.js"), comp = read("components.js"), ts = read("theme-studio.js");
  assert.match(app, /wxShareCfg\(\)\.cardFrom === "world"/);
  assert.match(app, /WorldWeather\.setFollow\(/);
  assert.match(comp, /function WorldWxFollowBox/);
  assert.match(comp, /saveJSON\("x_worldWxFollow"/);
  for (const k of ["wxsharecardfrom", "worldwxfollow"]) assert.ok(ts.includes('["' + k + '"'), k + " 没登记");
});
