const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../" + f, "utf8");
test("线下「只写一遍」：设置存 writeOnce → 场次带上 → 关掉人设风险那一道先写后改", () => {
  const C = R("js/components.js"), A = R("js/app.js"), E = R("js/engine.js");
  assert.match(C, /useState\(!!os\.writeOnce\)/); assert.match(C, /writeOnce: sOnce/);
  assert.match(A, /writeOnce: !!osFor\(charId\)\.writeOnce/);
  assert.match(E, /!session\.writeOnce && !!archetypePerformanceRisk/);
});
