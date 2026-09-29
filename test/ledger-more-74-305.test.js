// 她 2026-09-29「1-5 全部都做」：存钱目标、分类预算、多币种折合、退款/AA、年度回顾
const assert = require("assert");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/ledger.js", "utf8");
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, a); return src.slice(i, j); };
const code = [cut("function pad(n)", "function todayStr"), cut("function monthKey(", "function todayKey"), cut("function shiftMonth(", "function dailyAvg"),
  cut("const ACCT_TYPES", "function summarize("), cut("function summarize(", "window.ledgerWidgetData")].join("\n");
const M = new Function(code + "\nreturn { netAmt, refundSum, summarize, convertTotal, goalState, catBudgetOf, yearStats, acctBalance };")();

// 4. 退款挂在原来那笔上：支出按净额算，不算收入，账户也退回
const tx = [
  { id: "a", type: "expense", amount: 120, currency: "CNY", category: "餐饮", date: "2026-09-10", account: "cc", refunds: [{ amount: 40 }] },
  { id: "b", type: "expense", amount: 880, currency: "CNY", category: "购物", date: "2026-03-02" },
  { id: "c", type: "income", amount: 5000, currency: "CNY", category: "工资", date: "2026-09-01" },
  { id: "d", type: "expense", amount: 20, currency: "CAD", category: "餐饮", date: "2026-09-05" },
  { id: "e", type: "transfer", amount: 500, currency: "CNY", from: "x", to: "cc", date: "2026-09-06" }];
assert.strictEqual(M.netAmt(tx[0]), 80);
assert.strictEqual(M.netAmt({ type: "expense", amount: 10, refunds: [{ amount: 99 }] }), 0);   // 退多了也不变负
const s = M.summarize(tx, "CNY", "2026-09");
assert.strictEqual(s.exp, 80); assert.strictEqual(s.inc, 5000);
assert.strictEqual(M.acctBalance({ id: "cc", init: 0 }, tx), -80 + 500);

// 3. 折合：主币 CAD，1 CNY = 0.2 CAD；没填汇率的币种单独报出来
const set = { currencies: [{ code: "CNY" }, { code: "CAD" }, { code: "JPY" }], baseCur: "CAD", rates: { CNY: 0.2 } };
assert.deepStrictEqual(M.convertTotal(tx, set, "2026-09", "expense"), { base: "CAD", sum: 36, missing: [] });
assert.deepStrictEqual(M.convertTotal(tx.concat([{ type: "expense", amount: 100, currency: "JPY", date: "2026-09-02" }]), set, "2026-09", "expense").missing, ["JPY"]);
assert.strictEqual(M.convertTotal(tx, { currencies: set.currencies }, "2026-09", "expense"), null);   // 没设主币就不出

// 1. 存钱目标：存取只在目标自己身上；按截止日算每月该存多少
const g = { target: 6000, due: "2027-01-31", log: [{ amount: 1500 }, { amount: 300 }, { amount: -0 }] };
const gs = M.goalState(g, new Date(2026, 8, 29));
assert.strictEqual(gs.saved, 1800); assert.strictEqual(gs.left, 4200); assert.strictEqual(gs.done, false);
assert.strictEqual(gs.perMonth, 840);   // 124 天 → 5 个月
assert.strictEqual(M.goalState({ target: 100, log: [{ amount: 120 }] }).done, true);

// 2. 分类预算按币种存
assert.strictEqual(M.catBudgetOf({ catBudgets: { CNY: { 购物: 800 } } }, "CNY", "购物"), 800);
assert.strictEqual(M.catBudgetOf({ catBudgets: { CNY: { 购物: 800 } } }, "CAD", "购物"), 0);

// 5. 年度：净额、不算转账、最贵一笔、最省和最能花的月
const y = M.yearStats(tx, "CNY", 2026);
assert.strictEqual(y.exp, 960); assert.strictEqual(y.count, 3);
assert.strictEqual(y.biggest.id, "b"); assert.strictEqual(y.priciest, "2026-03"); assert.strictEqual(y.cheapest, "2026-09");
assert.strictEqual(y.catList[0].name, "购物");

// 入口和页面都接上了
for (const re of [/grow\(8, "goal", "存钱目标"/, /grow\(9, "year", "年度回顾"/, /top\.k === "goals"\) over = h\(GoalsView/, /top\.k === "year"\) over = h\(YearView/,
  /"data-ledger-refund": true/, /"data-ledger-catlimit": c\.name/, /"data-ledger-converted": true/, /"data-ledger-setlimit": c\.name/, /"data-ledger-rate": c\.code/,
  /callAI\(props\.active, sys, \[\{ role: "user", content: "开始。" \}\], \{ maxTokens: 14000 \}\)/]) assert.match(src, re);
console.log("ledger-more ok");
