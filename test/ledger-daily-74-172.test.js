// 记账：日均支出＋流水按天分组（群里反馈 2026-09-27「记账那里可以添加一个每日花费吗」）
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "ledger.js"), "utf8");
const grab = n => { const i = src.indexOf("function " + n + "("); let d = 0, j = src.indexOf("{", i); for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) break; } return src.slice(i, j + 1); };
const { dailyAvg, groupByDay, dayLabel } = new Function("const pad=n=>String(n).padStart(2,'0');" + grab("fmtDay") + grab("dailyAvg") + grab("groupByDay") + grab("dayLabel") + "return {dailyAvg,groupByDay,dayLabel};")();
const today = new Date(2026, 8, 27);
assert.deepEqual(dailyAvg(648, "2026-09", today), { days: 27, avg: 24 });        // 这个月按已过去的天数
assert.equal(dailyAvg(310, "2026-08", today).days, 31);                          // 过完的月份按整月
assert.equal(dailyAvg(100, "2026-10", today), null);                             // 未来的月份不算
const g = groupByDay([{ date: "2026-09-05", amount: 648 }, { date: "2026-09-26", amount: 10 }, { date: "2026-09-26", amount: 5, type: "income" }]);
assert.deepEqual(g.map(x => [x.date, x.exp, x.inc, x.rows.length]), [["2026-09-26", 10, 5, 2], ["2026-09-05", 648, 0, 1]]);
assert.equal(dayLabel("2026-09-26", today), "昨天 9月26日 周六");
assert.equal(dayLabel("2026-09-27", today), "今天 9月27日 周日");
assert.match(src, /data-ledger-daily/); assert.match(src, /groupByDay\(monthTxns\)/);
console.log("ledger daily ok");
// v74.173 月预算
{ const { budgetState } = new Function(grab("budgetState") + "return {budgetState};")();
  const today = new Date(2026, 8, 27);
  const b = budgetState(2000, 1513.95, "2026-09", today);
  assert.equal(b.left.toFixed(2), "486.05"); assert.equal(b.daysLeft, 4); assert.equal(b.perDay.toFixed(2), "121.51");
  assert.equal(budgetState(0, 10, "2026-09", today), null, "没设就不出卡");
  assert.equal(budgetState(100, 150, "2026-08", today).perDay, null, "过完的月份不算每天可花");
  assert.ok(budgetState(100, 150, "2026-09", today).left < 0, "超了照实是负数");
  assert.match(src, /budgets: \{ \.\.\.\(data\.settings\.budgets \|\| \{\}\), \[code\]: v \}/);
  assert.match(src, /requestAppPrompt\("每月预算"/);
  console.log("ledger budget ok"); }
// v74.174 今天实际花了多少
assert.match(src, /row\("今天花了", todayExp/);
assert.match(src, /const allow = \(bs\.left \+ spent\) \/ bs\.daysLeft;/);
console.log("ledger today ok");
