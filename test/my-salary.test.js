// 我的工资（她 2026-10-10）：每月几号自动到账，本地算
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const S = fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8");

function payRun(sal, now) {
  const src = A.slice(A.indexOf("const payMySalary = () => {"), A.indexOf("  useEffect(() => {\n    if (!loaded) return;\n    const t0 = setTimeout(payMySalary"));
  const paid = [];
  const env = { mySalaryRef: { current: sal }, changeWallet: (amt, label) => paid.push(label), setMySalaryState: () => {}, saveJSON: () => {} };
  const RealDate = Date;
  global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } };
  try { new Function("env", "with (env) { " + src + "\n payMySalary(); }")(env); } finally { global.Date = RealDate; }
  return { paid, sal: env.mySalaryRef.current };
}

test("从设好之后的下一个发薪日起算；漏的月份补上；同一个月不发两次", () => {
  const since = new Date(2026, 9, 10).getTime();           // 10 月 10 号设的，每月 15 号
  const r1 = payRun({ amount: 5000, day: 15, since, paid: {} }, new Date(2026, 9, 12).getTime());
  assert.deepEqual(r1.paid, [], "还没到 15 号");
  const r2 = payRun({ amount: 5000, day: 15, since, paid: {} }, new Date(2027, 0, 20).getTime());
  assert.deepEqual(r2.paid, ["工资到账 · 10月", "工资到账 · 11月", "工资到账 · 12月", "工资到账 · 1月"]);
  const r3 = payRun(r2.sal, new Date(2027, 0, 25).getTime());
  assert.deepEqual(r3.paid, [], "发过的月份不再发");
  const r4 = payRun({ amount: 5000, day: 5, since, paid: {} }, new Date(2026, 9, 20).getTime());
  assert.deepEqual(r4.paid, [], "设之前那个 5 号不往回补");
});

test("钱包页有那一格，流水里工资单独一类", () => {
  assert.match(S, /"data-wk": "walletsalary"/);
  assert.match(S, /const KIND_GROUPS = \[\["salary", "工资"\]/);
});
