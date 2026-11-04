// 架空世界天气跟着虚拟时间（她 2026-11-04 转群友）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
test("天气页、天气卡、日记戳、给他看的天气都照钟上的那一刻算", () => {
  assert.match(R("engine.js"), /function worldWxNow\(id\) \{ try \{ return new Date\(vclockMap\(Date\.now\(\), id == null \? null : id\)\);/);
  assert.match(R("components.js"), /const now = worldWxNow\(null\);/);
  assert.match(R("components.js"), /WorldWeather\.dayOf\(source\.seed, source\.terrain, worldWxNow\(null\)\)/);
  assert.match(R("app.js"), /WorldWeather\.dayOf\(r\.world\.id \+ "\|" \+ \(r\.node \|\| ""\), r\.terrain, worldWxNow\(charId\)\)/);
  assert.ok(!/WorldWeather\.dayOf\([^)]*new Date\(\)\)/.test(R("components.js") + R("app.js") + R("engine.js")), "不许再按现实今天算架空世界");
});
