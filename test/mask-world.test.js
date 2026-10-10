// 不同的面具在不同的世界（群友 2026-10-10）：面具自带「在哪个世界」，认这张面具的角色按它来
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const comp = fs.readFileSync(require.resolve("../js/components.js"), "utf8");
const { userRealm } = require("../js/map.js");

test("面具选了世界就覆盖设置；没选跟着设置", () => {
  const i = app.indexOf("  const realmPrefsFor = charId => {"), j = app.indexOf("  const myRealm = charId =>");
  const masks = { a: { geoRealm: "w1" }, b: {} };
  const f = new Function("prefs", "profileFor", app.slice(i, j) + "\nreturn realmPrefsFor;")({ geoAware: false, geoRealm: "real" }, id => masks[id]);
  const worlds = [{ id: "w1", name: "雾港", pins: { __me: "码头" }, regions: [] }];
  const ra = userRealm(f("a"), null, worlds);
  assert.equal(ra.kind, "world");
  assert.equal(ra.label, "雾港·码头");
  assert.equal(userRealm(f("b"), null, worlds), null, "面具没选、设置里位置感知又关着：不说她在哪");
  assert.equal(userRealm(f(null), null, worlds), null);
});
test("提示词里问的是这个角色眼里她在哪；面具表单里有这一栏", () => {
  assert.match(app, /geo: geoForPrompt\(char\.id\),/);
  assert.match(app, /ctx\.geo = geoForPrompt\(char\.id\); \}/);
  assert.match(comp, /photoOutfit: photoOutfit\.trim\(\), geoRealm: geoRealm \|\| ""/);
  assert.match(comp, /"data-wk": "maskworld"/);
});
