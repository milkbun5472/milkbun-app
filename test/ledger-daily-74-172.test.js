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
