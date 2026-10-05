const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const hl = fs.readFileSync(__dirname + "/../js/health.js", "utf8");
test("健康卡有自己的样子：逐样一行、今天吃到几成、点了进健康", () => {
  assert.ok(/if \(isHealth\) return h\(HealthRecordCard, \{ m \}\);/.test(comp));
  const card = comp.slice(comp.indexOf("function HealthRecordCard("), comp.indexOf("function RecordedCard("));
  assert.ok(/window\.healthGoApp/.test(card) && /H\.dayTotals\(d, m\.day\)/.test(card));
  assert.ok(/rows: _hx\.rows, day: _hx\.day/.test(app), "卡上带着逐样的记录");
  assert.ok(/rows: done, day: today/.test(hl));
  assert.ok(/window\.healthGoApp = \(\) => \{ setScreen\("health"\); \};/.test(app));
});
