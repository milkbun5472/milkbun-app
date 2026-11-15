const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8"), comp = fs.readFileSync("js/components.js", "utf8");
test("配角能放锁脸参考照，转正时原样留着", () => {
  assert.ok(comp.includes('"data-wk": "npcref"') && comp.includes("onSetRef(cur.id, { refPhoto: v })"));
  assert.ok(app.includes("onSetNpcRef: (id, patch) =>") && comp.includes("onSetRef: onSetNpcRef"));
  const promo = app.slice(app.indexOf("onPromoteNpc: id =>"), app.indexOf("onSetNpcMoments"));
  assert.ok(!/refPhoto/.test(promo), "转正不该动参考照");
  assert.ok(fs.readFileSync("js/theme-studio.js", "utf8").includes('["npcref",'));
});
