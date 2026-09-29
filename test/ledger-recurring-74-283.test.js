// 周期账单 + 导出 CSV（她 2026-09-29「继续做功能吧宝宝周期账单和导出」）
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../js/ledger.js", "utf8");
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, a); return src.slice(i, j); };
const code = [cut("function pad(n)", "function todayStr"), cut("function shiftMonth(", "function dailyAvg"),
  cut("const ACCT_TYPES", "function summarize(")].join("\n");
const M = new Function(code + "\nreturn { runRecurring, recurNext, ledgerCSV };")();

// 从 lastMk 下个月补到这个月，只补日子已经到了的；同一个月不会记两次
const d = { txns: [], settings: { recurring: [{ id: "rent", name: "房租", type: "expense", amount: 1800, currency: "CNY", category: "居住", day: 5, startMk: "2026-07" }], accounts: [] } };
assert.strictEqual(M.runRecurring(d, new Date(2026, 8, 29)), 3);          // 7、8、9 月的 5 号都过了
assert.deepStrictEqual(d.txns.map(x => x.date).sort(), ["2026-07-05", "2026-08-05", "2026-09-05"]);
assert.ok(d.txns.every(x => x.recur === "rent" && x.note === "房租" && x.amount === 1800 && x.type === "expense"));
assert.strictEqual(d.settings.recurring[0].lastMk, "2026-09");
assert.strictEqual(M.runRecurring(d, new Date(2026, 8, 30)), 0);          // 再跑一遍不重复
// 日子没到就不记
const d2 = { txns: [], settings: { recurring: [{ id: "net", type: "expense", amount: 99, currency: "CNY", category: "日用", day: 28, startMk: "2026-10" }] } };
assert.strictEqual(M.runRecurring(d2, new Date(2026, 9, 27)), 0);
assert.strictEqual(M.runRecurring(d2, new Date(2026, 9, 28)), 1);
// 下一次：还有几天
assert.deepStrictEqual(M.recurNext(d.settings.recurring[0], new Date(2026, 9, 2)), { date: "2026-10-05", days: 3 });

// CSV：带 BOM、按日期排、转账写清楚从哪到哪、逗号和引号要转义
const csv = M.ledgerCSV({ settings: { accounts: [{ id: "deb", name: "工资卡" }, { id: "cc", name: "信用卡" }] }, txns: [
  { date: "2026-09-10", type: "transfer", amount: 500, currency: "CNY", from: "deb", to: "cc", note: "" },
  { date: "2026-09-01", type: "expense", amount: 36.5, currency: "CNY", category: "餐饮", account: "cc", note: "火锅, \"超辣\"" }] });
assert.ok(csv.startsWith("﻿日期,类型,金额,币种,分类,账户,转出,转入,备注\r\n"));
const lines = csv.slice(1).split("\r\n");
assert.strictEqual(lines[1], '2026-09-01,支出,36.5,CNY,餐饮,信用卡,,,"火锅, ""超辣"""');
assert.strictEqual(lines[2], "2026-09-10,转账,500,CNY,,,工资卡,信用卡,");

// 入口都在：「我的」两行、设置里「周期」tab、打开记账时补记、导出走 saveTextFile
assert.match(src, /grow\(6, "loop", "周期账单"/);
assert.match(src, /grow\(7, "export", "导出账单"/);
assert.match(src, /tabBtn\("recur", "周期"\)/);
assert.match(src, /const n = runRecurring\(d\);/);
assert.match(src, /window\.saveTextFile\("账本-" \+ todayStr\(\)\.replace\(\/-\/g, ""\) \+ "\.csv", ledgerCSV\(d\), "text\/csv"\)/);
console.log("ledger-recurring ok");

// 账单页顶上的本月汇总条（她 2026-09-29「就做汇总吧」）：钉在顶上；算的是眼下列出来的这些，转账不算收支
{
  const b = src.slice(src.indexOf("function BillsView("), src.indexOf("function CalView("));
  assert.match(b, /"data-ledger-billsum": true, style: \{ position: "sticky", top: 0/);
  assert.match(b, /const exp = monthTxns\.filter\(isExpense\)/);
  assert.match(b, /cell\("笔数", String\(monthTxns\.length\)/);
  console.log("ledger-billsum ok");
}
