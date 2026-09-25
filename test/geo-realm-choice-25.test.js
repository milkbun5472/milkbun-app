const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Map = require("../js/map.js");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = read("app.js"), engine = read("engine.js"), screens = read("screens.js");

// 桩照写入方：pinWorld 写 pins[charId]=node（她自己的 id 是 __me），doRequestGeo 写 {lat,lng,label}
const world = { id: "w1", name: "银冠王国", regions: [{ name: "王都", terrain: "平原", nodes: [{ name: "白塔街" }] }], pins: { __me: "白塔街" } };
const realGeo = { lat: 49.9, lng: -97.1, label: "温尼伯 · 加拿大" };

test("pinWorld 的写法还是 pins[charId] = node", () => {
  assert.match(app, /if \(node\) pins\[charId\] = node; else delete pins\[charId\];/);
});

test("选了架空世界：位置是那个世界里她钉的点，不带现实城市", () => {
  const r = Map.userRealm({ geoAware: true, geoRealm: "w1" }, realGeo, [world]);
  assert.equal(r.kind, "world");
  assert.equal(r.label, "银冠王国·白塔街");
  assert.ok(!JSON.stringify(r).includes("温尼伯"));
});

test("选的是现实定位 / 没选过：照旧用现实定位", () => {
  assert.equal(Map.userRealm({ geoAware: true, geoRealm: "real" }, realGeo, [world]).kind, "real");
  assert.equal(Map.userRealm({ geoAware: true }, realGeo, [world]).geo, realGeo);
});

test("选中的世界被删了：不说她在哪，也不退回现实城市", () => {
  assert.equal(Map.userRealm({ geoAware: true, geoRealm: "gone" }, realGeo, [world]), null);
});

test("位置感知关着：什么都不给", () => {
  assert.equal(Map.userRealm({ geoAware: false, geoRealm: "w1" }, realGeo, [world]), null);
});

test("app 里用到她位置的地方都走 realGeo / geoForPrompt，不再直接读 prefs.geoAware && geo", () => {
  assert.doesNotMatch(app, /prefs\.geoAware \? geo : null/);
  assert.doesNotMatch(app, /prefs\.geoAware && geo && typeof geo\.lat === "number"/);
  assert.doesNotMatch(app, /_prefs\.geoAware \? loadJSON\("x_geo"/);
  assert.equal((app.match(/geo: geoForPrompt\(\)/g) || []).length, 1);
  assert.match(app, /ctx\.geo = geoForPrompt\(\);/);
});

test("提示词里架空世界那一句不提现实，日记也按世界盖戳", () => {
  assert.match(engine, /geo && geo\.realm === "world"/);
  const i = engine.indexOf("async function fetchLocalEnv("), j = engine.indexOf("const mine = geoNow();", i);
  assert.ok(i > 0 && j > i, "抠不出 fetchLocalEnv");
  assert.match(engine.slice(i, j), /rl\.kind === "world"/);
});

test("设置里是二选一，不是关掉", () => {
  const i = screens.indexOf("function SenseConfig("), j = screens.indexOf("\nfunction ", i + 10);
  assert.ok(i > 0 && j > i);
  const s = screens.slice(i, j);
  assert.match(s, /\[\{ id: "real", name: "现实定位" \}\]\.concat\(wl\)/);
  assert.match(s, /save\(\{ \.\.\.p, geoRealm: w\.id \}\)/);
});
