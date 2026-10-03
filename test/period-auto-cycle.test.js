// 经期周期按真实记录自动算（她 2026-09-28：不规律的人也能用）
const fs = require("fs"), assert = require("assert"), vm = require("vm");
const src = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const pick = name => { const a = src.indexOf("function " + name + "("); let d = 0, i = src.indexOf("{", a); for (; i < src.length; i++) { if (src[i] === "{") d++; else if (src[i] === "}" && --d === 0) break; } return src.slice(a, i + 1); };
const sb = { window: { ScheduleClock: { parseDayKey: k => { const [y, m, d] = String(k).split("-").map(Number); return new Date(y, m - 1, d); } } } }; vm.runInNewContext(["pKeyDate", "periodList", "periodSpanLen", "periodCycleOf"].map(pick).join("\n") + ";this.f=periodCycleOf;", sb);
let r = sb.f({ cycleLen: 28, periodLen: 5, periods: [{ start: "2026-06-01", end: "2026-06-06" }, { start: "2026-07-05", end: "2026-07-08" }, { start: "2026-08-01", end: null }] });
assert.strictEqual(r.cyc, 31); assert.strictEqual(r.cycAuto, 2); assert.strictEqual(r.len, 5); assert.strictEqual(r.lenAuto, 2);
r = sb.f({ cycleLen: 33, periodLen: 6, periods: [{ start: "2026-08-01" }] });
assert.strictEqual(r.cyc, 33); assert.strictEqual(r.cycAuto, 0); assert.strictEqual(r.len, 6);
r = sb.f({ cycleLen: 28, periods: [{ start: "2026-01-01" }, { start: "2026-06-01" }] });
assert.strictEqual(r.cycAuto, 0, "隔了五个月多半漏记，不算");
assert.ok(/const _pc = periodCycleOf\(period\), cyc = _pc\.cyc/.test(src), "月历预测用自动周期");
assert.ok(/periodCycleOf\(per\)\.cyc/.test(src), "距下次用自动周期");
// v74.640 角色看到的那一句收进了 periodPhaseNow（健康页也用它），那一处只算这一次
assert.ok(/const _pc = periodCycleOf\(period\), cyc = _pc\.cyc, pLen = periodSpanLen\(lastP, _pc\.len\);/.test(src), "角色看到的阶段也用它");
assert.ok(/const ph = periodPhaseNow\(period\);/.test(fs.readFileSync(__dirname + "/../js/app.js", "utf8")), "聊天那条走 periodPhaseNow");
console.log("period-auto-cycle ok");
