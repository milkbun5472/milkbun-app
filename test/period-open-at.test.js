// 周期短、一个月来两次（群友 2026-11-27）：之前漏记结束的那次、或者上一次早结束了，新的一天要能记成新一次的开始
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8"), app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8"), health = fs.readFileSync(path.join(__dirname, "..", "js", "health.js"), "utf8");
const src = comp.slice(comp.indexOf("const PERIOD_OPEN_MAX_DAYS"), comp.indexOf("\n}", comp.indexOf("function periodOpenAt")) + 2);
const pKeyDate = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const periodOpenAt = new Function("pKeyDate", src + "; return periodOpenAt;")(pKeyDate);
test("只看最近那一次：没结束、两周以内才算还开着", () => {
  assert.ok(periodOpenAt([{ start: "2026-11-23", end: null }], "2026-11-27"), "这次第五天，记的是结束");
  assert.equal(periodOpenAt([{ start: "2026-11-02", end: "2026-11-07" }], "2026-11-27"), null, "上一次已经结束：这天是新的一次");
  assert.equal(periodOpenAt([{ start: "2026-08-01", end: null }, { start: "2026-11-02", end: "2026-11-07" }], "2026-11-27"), null, "更早那次漏记结束也不算");
  assert.equal(periodOpenAt([{ start: "2026-10-01", end: null }], "2026-11-27"), null, "最近那次没记结束但早过去了");
});
test("三处都问同一处；月事本有「新的一次开始」那颗", () => {
  assert.match(app, /const open = mode === "start" \? null : periodOpenAt\(periods, dateKey\);/);
  assert.match(health, /periodOpenAt\(plist, legacyToday\)/);
  assert.match(comp, /onRecord\(key, "start"\)/);
});
