// 周期账单能选每周／每两周（群友 2026-10-15「想要一周一周进帐」，她：「收入支出都搞可以选周期」）
const test = require("node:test");
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../js/ledger.js", "utf8");
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, a); return src.slice(i, j); };
const code = [cut("function pad(n)", "function todayStr"), cut("function shiftMonth(", "function dailyAvg"),
  cut("const ACCT_TYPES", "function summarize(")].join("\n");
const M = new Function(code + "\nreturn { runRecurring, recurNext, recurWeekStart };")();
test("每周：从起点一周一笔补到今天，重跑不重复；每两周隔一周", () => {
  const d = { txns: [], settings: { recurring: [{ id: "w", type: "income", amount: 300, currency: "CNY", category: "兼职", every: "week", wd: 5, startDate: "2026-09-04" }] } };
  assert.strictEqual(M.runRecurring(d, new Date(2026, 8, 25)), 4);
  assert.deepStrictEqual(d.txns.map(x => x.date).sort(), ["2026-09-04", "2026-09-11", "2026-09-18", "2026-09-25"]);
  assert.ok(d.txns.every(x => x.type === "income"));
  assert.strictEqual(M.runRecurring(d, new Date(2026, 8, 26)), 0);
  assert.deepStrictEqual(M.recurNext(d.settings.recurring[0], new Date(2026, 8, 30)), { date: "2026-10-02", days: 2 });
  const b = { txns: [], settings: { recurring: [{ id: "b", type: "expense", amount: 50, currency: "CNY", category: "日用", every: "2week", wd: 1, startDate: "2026-09-07" }] } };
  assert.strictEqual(M.runRecurring(b, new Date(2026, 9, 5)), 3);
  assert.deepStrictEqual(b.txns.map(x => x.date).sort(), ["2026-09-07", "2026-09-21", "2026-10-05"]);
});
test("新建每周：起点是今天或之后最近的那个周几，不倒补", () => {
  assert.strictEqual(M.recurWeekStart(4, new Date(2026, 9, 15)), "2026-10-15");   // 周四选周四＝今天
  assert.strictEqual(M.recurWeekStart(1, new Date(2026, 9, 15)), "2026-10-19");
});
test("编辑页有「多久一次」，每周时换成选周几", () => {
  assert.ok(/label\("多久一次"\)/.test(src) && /label\("每周几"\)/.test(src));
});
test("一打开 App 就补：开机读完存档补一次、切回前台再补；存档没读出来不动", () => {
  const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
  assert.ok(/window\.ledgerCatchUp \? window\.ledgerCatchUp\(\)/.test(app) && /visibilitychange", vis/.test(app));
  const i = src.indexOf("window.ledgerCatchUp = function"), seg = src.slice(i, i + 400);
  assert.ok(/if \(!raw \|\| !raw\.settings/.test(seg));
});
