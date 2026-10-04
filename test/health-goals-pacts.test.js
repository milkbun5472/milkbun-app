const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const hl = fs.readFileSync(__dirname + "/../js/health.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("健康：目标补齐、立约、每周小结、小习惯都接上了", () => {
  assert.ok(/goal: \{ kcal: 1800, water: 8, kg: null, sleepH: null, bedBy: null, steps: null, sportWeek: null \}/.test(hl));
  assert.ok(/function pactDays\(d, p, today\)/.test(hl) && /function weekFacts\(d, endDay\)/.test(hl) && /function weightEta\(d\)/.test(hl));
  // 约的那一行不看「谁看着」开没开
  const nf = hl.slice(hl.indexOf("function noteFor("), hl.indexOf("function noteForWatch("));
  assert.ok(/pactLine\(load\(\), charId/.test(nf));
  // 约满了、每周一，都走饭点来问那一条现成的主动链，一约一次、一周一次
  assert.ok(/meal: "pact-" \+ due\.id/.test(hl) && /meal: "weekly-" \+ monday/.test(hl));
  assert.ok(/reported: true/.test(hl) && /last: meal\.slice\(7\)/.test(hl));
  assert.ok(/health: \{ meal: hn\.label, line: hn\.line, tail: hn\.tail \}/.test(app));
  assert.ok(/window\.HealthCtx\.habitDue \? window\.HealthCtx\.habitDue\(\)/.test(app));
  // 「这周」那段话只有一份
  assert.strictEqual((hl.match(/"这一周（"/g) || []).length, 1);
});
