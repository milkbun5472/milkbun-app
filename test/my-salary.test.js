// 固定进出（她 2026-10-10）：工资、零花钱、房租……每月／每周／每年，本地算
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const S = fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8");

function run(list, now) {
  const src = A.slice(A.indexOf("  const WEEK_ZH = "), A.indexOf("  useEffect(() => {\n    if (!loaded) return;\n    const t0 = setTimeout(payMyRecur"));
  const paid = [];
  const env = { myRecurRef: { current: list }, changeWallet: (amt, label) => paid.push([amt, label]), saveMyRecur: l => { env.myRecurRef.current = l; } };
  const RealDate = Date;
  global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } };
  try { new Function("env", "with (env) { " + src + "\n payMyRecur(); }")(env); } finally { global.Date = RealDate; }
  return { paid, list: env.myRecurRef.current };
}
const since = new Date(2026, 9, 10).getTime();

test("每月：设之后的下一次起算，漏的补上，同一次不记两遍", () => {
  const r = run([{ id: "a", name: "工资", amount: 5000, dir: "in", freq: "month", day: 15, since, paid: {} }], new Date(2027, 0, 20).getTime());
  assert.deepEqual(r.paid.map(x => x[1]), ["工资到账 · 10月", "工资到账 · 11月", "工资到账 · 12月", "工资到账 · 1月"]);
  assert.deepEqual(run(r.list, new Date(2027, 0, 25).getTime()).paid, []);
});

test("每周、每年、支出", () => {
  const w = run([{ id: "b", name: "零花钱", amount: 100, dir: "in", freq: "week", day: 5, since, paid: {} }], new Date(2026, 9, 31).getTime());
  assert.equal(w.paid.length, 3, "10/16、10/23、10/30 三个周五");
  const y = run([{ id: "c", name: "年费", amount: 300, dir: "out", freq: "year", month: 3, day: 1, since, paid: {} }], new Date(2028, 3, 1).getTime());
  assert.deepEqual(y.paid, [[-300, "年费 · 2027年"], [-300, "年费 · 2028年"]]);
});

test("老的「工资」那一格并进来；钱包页两栏", () => {
  assert.match(A, /const old = loadJSON\("x_mySalary", null\);/);
  assert.match(S, /"data-wk": "walletrecur"/);
  assert.match(S, /const KIND_GROUPS = \[\["salary", "固定进账"\], \["recur_out", "固定支出"\]/);
});
