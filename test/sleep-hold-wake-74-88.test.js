// 群里肉肉肉酱意面 2026-10-06：「前一晚来不及回的 char 都会在凌晨三四点问我醒了没」
//   睡觉是今天日程最后一段、end 没写或记成 24:00 → 原来拿 240 分钟兜底／半小时就醒。
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
const i = app.indexOf("  const sleepHoldFor = char => {"), j = app.indexOf("  const busyNowFor = char => {");
const src = app.slice(i, j);
function run({ nowM, seqs, idx, tomorrow, today }) {
  const plans = { D: today || { seqs }, D1: tomorrow };
  const f = new Function("sleepPhaseOf", "schedNowSegFor", "charLocalMin", "schedCarryNowFor", "schedulesRef", "schedLocalDayKey", "schedShiftDayKey", "SLEEP_ODDS",
    src + "\nreturn sleepHoldFor;")(() => "asleep", () => ({ disp: seqs, idx, cur: seqs[idx] }), () => nowM, () => null,
    { current: { c1: plans } }, () => "D", (k, n) => (n === 1 ? "D1" : "D"), 0.7);
  const r = f({ id: "c1" });
  return Math.round((r.endTs - Date.now()) / 60000);
}
const day = [{ time: "07:30", title: "起床" }, { time: "23:20", title: "睡觉", type: "sleep" }];
test("睡觉是最后一段、没写 end：按明天第一项醒，不是四个小时后", () => {
  const left = run({ nowM: 23 * 60 + 30, seqs: day, idx: 1, tomorrow: { seqs: [{ time: "08:00" }] } });
  assert.equal(left, 8 * 60 + 30);   // 23:30 → 08:00
});
test("end 记成 24:00 也一样，不是半小时后就醒", () => {
  const seqs = [day[0], { ...day[1], end: "24:00" }];
  assert.equal(run({ nowM: 23 * 60 + 30, seqs, idx: 1, tomorrow: { seqs: [{ time: "07:00" }] } }), 7 * 60 + 30);
});
test("明天的日程还没排：按今天早上几点起的估", () => {
  assert.equal(run({ nowM: 23 * 60, seqs: day, idx: 1 }), 8 * 60 + 30);   // 23:00 → 07:30
});
test("写清楚了 end 的照旧按 end", () => {
  const seqs = [{ time: "13:00", title: "午睡", type: "sleep", end: "14:00" }, { time: "14:00", title: "上班" }];
  assert.equal(run({ nowM: 13 * 60 + 10, seqs, idx: 0 }), 50);
});
