const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("面具有单独的名称（只给她认），列表和角色设置里优先显示它", () => {
  assert.ok(comp.includes('name, label: label.trim().slice(0, 20), tagline'));
  assert.ok(comp.includes("(m.label || m.name || \"未命名\") + (String(primaryId"));
  assert.ok(comp.includes("name: m.label || m.name || \"未命名\" })"));
});
test("换了 TA 认的面具：今天起已排好的日程删掉重排", () => {
  const i = app.indexOf('if (String(s.maskId || "") !== String(settingsFor(activeChar.id).maskId || ""))');
  assert.ok(i > 0);
  assert.ok(app.slice(i, i + 600).includes("delSchedDays(activeChar.id, _days)"));
});
