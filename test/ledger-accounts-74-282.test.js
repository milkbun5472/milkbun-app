// 账户（她 2026-09-29：信用卡按账单周期算；角色看不看得到余额单独一个开关；每种卡不同卡面颜色）
const assert = require("assert");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/ledger.js", "utf8");
// 照写存档的那段切：账户那组纯函数 + summarize，连同它们依赖的 pad / monthKey
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, a); return src.slice(i, j); };
const code = [cut("function pad(n)", "function todayStr"), cut("function monthKey(", "function todayKey"),
  cut("const ACCT_TYPES", "function summarize("), cut("function summarize(", "window.ledgerWidgetData")].join("\n");
const M = new Function(code + "\nreturn { acctBalance, creditState, summarize, acctType, isTransfer, isExpense };")();

const deb = { id: "deb", type: "debit", init: 1000 }, cc = { id: "cc", type: "credit", init: -200, limit: 5000, billDay: 20, dueDay: 12 };
const tx = [
  { type: "expense", amount: 880, currency: "CNY", category: "购物", date: "2026-09-09", account: "cc" },
  { type: "expense", amount: 120, currency: "CNY", category: "餐饮", date: "2026-09-25", account: "cc" },
  { type: "income", amount: 5000, currency: "CNY", category: "工资", date: "2026-09-26", account: "deb" },
  { type: "transfer", amount: 500, currency: "CNY", from: "deb", to: "cc", category: "转账", date: "2026-09-28" }
];
// 余额现算：初始 + 收入 − 支出 ± 转账
assert.strictEqual(M.acctBalance(deb, tx), 1000 + 5000 - 500);
assert.strictEqual(M.acctBalance(cc, tx), -200 - 880 - 120 + 500);
// 信用卡按周期：账单日 20 号那天欠 1080，之后还了 500 → 本期应还 580；20 号之后刷的 120 算下一期
const cs = M.creditState(cc, tx, new Date(2026, 8, 29));
assert.strictEqual(cs.billDate, "2026-09-20");
assert.strictEqual(cs.due, 580);
assert.strictEqual(cs.unbilled, 120);
assert.strictEqual(cs.owed, 700);
assert.strictEqual(cs.avail, 4300);
// 还款日 12 号 < 账单日 20 号 → 顺延到下个月
assert.strictEqual(cs.dueDate, "2026-10-12");
assert.strictEqual(cs.daysLeft, 13);
// 还够了就是 0，不是负数
assert.strictEqual(M.creditState(cc, tx.concat([{ type: "transfer", amount: 2000, from: "deb", to: "cc", date: "2026-09-29" }]), new Date(2026, 8, 29)).due, 0);
// 没到这个月的账单日 → 用上个月的
assert.strictEqual(M.creditState(cc, tx, new Date(2026, 9, 3)).billDate, "2026-09-20");
// 没设账单日 → 只有总欠款
assert.strictEqual(M.creditState({ id: "cc", init: -50 }, [], new Date()).dueDate, undefined);
// ⚠️转账不是支出：统计必须跳过它
const s = M.summarize(tx, "CNY", "2026-09");
assert.strictEqual(s.exp, 1000);
assert.strictEqual(s.inc, 5000);
assert.strictEqual(s.count, 3);
assert.ok(M.isTransfer(tx[3]) && !M.isExpense(tx[3]) && M.isExpense(tx[0]));
// 每种卡一种颜色
assert.notStrictEqual(M.acctType("credit").hue, M.acctType("debit").hue);

// 其他几处汇总也不许把转账算成花销
for (const re of [/todayExp = [^\n]*isExpense\(x\)/, /spent = monthTxns\.filter\(x => x\.date === td && isExpense\(x\)\)/, /kind === "income" \? x\.type === "income" : isExpense\(x\)/,
  /monthKey\(x\.date\) !== mk \|\| isTransfer\(x\)\) return;/, /g\.rows\.push\(x\); if \(isTransfer\(x\)\) return;/, /if \(!\(a > 0\) \|\| isTransfer\(txn\)\) return null;/]) assert.match(src, re);
// 角色看余额：只在开关打开时
assert.match(src, /const accts = d\.settings\.shareAcct \? \(d\.settings\.accounts \|\| \[\]\) : \[\];/);
// 入口：「我的」里有账户，设置里有账户 tab，记一笔有转账
assert.match(src, /grow\(1, "card", "账户"/);
assert.match(src, /tabBtn\("acct", "账户"\)/);
assert.match(src, /\["transfer", "转账"\]/);
console.log("ledger-accounts ok");
// 账户卡面对准卡套里那张卡（她 2026-09-29）：跟卡套图套在同一个框里一起歪，卡面自己再斜 8 度
assert.match(src, /"data-ledger-acctface": a\.id, style: \{ position: "absolute", left: "12\.9%", top: "19\.9%", width: "63%", height: "58%"/);
assert.match(src, /transform: "rotate\(-8deg\)"/);
// 周期账单 / 导出两行用她给的图标
["ic-recur", "ic-export"].forEach(n => assert.ok(fs.existsSync(__dirname + "/../assets/ledger/" + n + ".webp"), n));
console.log("ledger-acctface ok");
// 聊天里 TA 记账的卡：账本玻璃皮时是小票（她 2026-09-29 的票纸、回形针、RECORDED 章）；纸皮还是原来那张
{
  const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(comp, /if \(!isMemo && typeof window !== "undefined" && window\.ledgerIsGlass && window\.ledgerIsGlass\(\)\) return h\(LedgerTicketCard, \{ m \}\);/);
  assert.match(src, /window\.ledgerIsGlass = function/);
  ["rc-ticket", "rc-clip", "rc-stamp"].forEach(n => assert.ok(fs.existsSync(__dirname + "/../assets/ledger/" + n + ".webp"), n));
  console.log("ledger-ticket-card ok");
}
// 默认分类的图标不许撞（她 2026-09-29「重复的图标重画」）
{
  const m = src.match(/const lookup = (\{[^}]+\});/);
  const lk = Function("return " + m[1])();
  for (const group of [["餐饮","买菜","交通","购物","日用","居住","娱乐","游戏充值","医疗","人情","学习","其他"], ["工资","兼职","红包","报销","其他"]]) {
    const ks = group.map(n => lk[n]);
    assert.strictEqual(new Set(ks).size, ks.length, "撞图：" + group.join("、"));
  }
  assert.match(src, /h\(CandySeg, \{ items: \[\["expense", "支出分类"\], \["income", "收入分类"\]\]/);
  console.log("ledger-cat-icons ok");
}
// 记账卡是 role:"system"，单聊里不许被「系统」小框先吞掉
{
  const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  const i = comp.indexOf('if (m.kind === "recorded") return'), j = comp.lastIndexOf('return h(SysNote, { key: i, label: "系统"', i);
  assert.ok(i > 0 && j > 0);
  assert.match(comp.slice(j - 120, j), /m\.kind !== "recorded" &&/);
  console.log("recorded-not-swallowed ok");
}
