// 取消/退款的订单不许扣钱，已经扣过的要补回来
//
// Codex 2026-08-29 审出来的：phoneOrdersOnDay 原来只看金额和日期，
// 于是「已取消」「退款成功」的订单照样从余额里扣走，而且没有任何一笔把钱补回来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

const onDay = app.match(/const phoneOrdersOnDay = \(charId, dayKey\) => \{[\s\S]*?\n  \};/)[0];
const refund = app.match(/const phoneReconcile = charId => \{[\s\S]*?\n  \};/);

test("取消/退款/退货的单不入账", () => {
  assert.match(onDay, /const DEAD = \//, "没有判死状态的规则");
  ["取消", "退款", "退货", "失败"].forEach(w =>
    assert.ok(onDay.indexOf(w) > 0, "没挡住「" + w + "」这种状态"));
  assert.match(onDay, /!alive\(o\)\) return;/, "外卖或购物哪一路没接上");
  assert.equal((onDay.match(/!alive\(o\)/g) || []).length, 2, "两路都要挡——一层写在一处，别处没跟上");
});

test("去重指纹优先用订单自己的永久 id", () => {
  // 只用「店铺+品名」的话：同一天在同一家买两次一样的东西会被当成一单少扣一次；
  // 反过来刷新时标题换个措辞又会被当成新单重扣一次。
  assert.match(onDay, /String\(o\.id \|\| o\.orderId \|\| ""\)\.trim\(\)/, "没优先用永久 id");
  assert.match(onDay, /\|\| \(String\(o\.shop \|\| ""\) \+ "\|" \+ String\(o\.title \|\| o\.main \|\| ""\) \+ "\|" \+ a\)/,
    "老数据的兜底指纹里没带金额，措辞一改就会重扣");
  // 提示词也要求模型给稳定 id，否则永远只能走兜底
  ["shopping", "takeout"].forEach(k => {
    const i = phone.indexOf("    " + k + ": {");
    const seg = phone.slice(i, phone.indexOf("\n    },\n", i));
    assert.ok(seg.indexOf("同一单以后刷新也必须是同一个 id") > 0 || seg.indexOf("钱包靠它认账") > 0,
      k + " 的推演任务没要求订单 id 稳定");
    assert.ok(seg.indexOf('\\"id\\"') > 0, k + " 的 schemaHint 里没有 id");
  });
});

test("已经扣过的钱，订单变成取消/退款时补回来", () => {
  assert.ok(refund, "找不到 phoneReconcile");
  const fn = refund[0];
  // v57.78 起 kind 是 mk() 的一个参数，不再是字面量对象里的 key
  assert.match(fn, /"refund", 1000 \+ i/, "退款没有自己的流水类型");
  assert.match(fn, /refundOf: e\.srcKey/, "退款没记是冲哪一笔的");
  assert.match(fn, /if \(!e \|\| !e\.srcKey \|\| e\.refundOf \|\| backed\[e\.srcKey\]\) return;/,
    "同一笔可能被退两次");
  // 退款是进账：mk 的第一个参数是正的 Math.abs(...)，不是负号开头
  assert.match(fn, /mk\(Math\.abs\(Number\(e\.delta\) \|\| 0\), dead\[tail\] \+ " · 退款"/, "退款该是进账（正数）");
  // 只在购物/外卖刷完之后跑——别的 app 不会产生取消单
  assert.match(app, /if \(key === "shopping" \|\| key === "takeout"\) \{/);
  // 跟归档一样是锦上添花，不能连累刷新
  const hook = app.match(/if \(key === "shopping" \|\| key === "takeout"\) \{[\s\S]{0,200}/)[0];
  assert.match(hook, /try \{/, "回冲没包 try，写坏了会把整次刷新弄挂");
});

test("不回头重算旧日期——只补差额", () => {
  // 钱包每天只结算到昨天，结过的日期不再回扫（避免反复生成日常消费）。
  // 退款走的是【新增一笔冲账】，不是把那天重算一遍。
  const fn = refund[0];
  assert.ok(fn.indexOf("applyWalletDay") < 0 && fn.indexOf("genDailySpend") < 0,
    "退款回冲不该去重算某一天，那会重新生成一天的开销");
  assert.match(fn, /ledger: \[\.\.\.rows\.reverse\(\), \.\.\.led\]/, "该是往流水里补一笔，不是改旧的那笔");
});

// ── 核账：只补差额，不整份重算 ──────────────────────────────

test("最近 30 天里漏扣的旧订单会补记上", () => {
  // 钱包每天只结算到昨天、结过的日期不再回扫。刷新手机后如果多出一张上周的旧单，
  // 那笔从来没扣过——核账把它补上（只补一笔，不去重算那一天）。
  const fn = refund[0];
  assert.match(app, /const PHONE_RECHECK_DAYS = 30;/);
  assert.match(fn, /for \(let i = 1; i <= PHONE_RECHECK_DAYS; i\+\+\)/);
  assert.match(fn, /phoneOrdersOnDay\(charId, dk\)/, "没按天去读手机上的单");
  assert.match(fn, /if \(have\[k\] \|\| dead\[/, "已经扣过的、或者已经取消的，都不许再补一笔");
  assert.match(fn, /补记/, "补记的流水没标出来是哪一天的单");
});

test("补记落在当下，不回插到旧日期——否则 running balance 会乱", () => {
  const fn = refund[0];
  assert.match(fn, /ts: Date\.now\(\) \+ i/, "补记用了旧日期的时间戳");
  assert.match(fn, /bal = r2\(bal \+ delta\)/, "余额没顺着往下算");
  // 不许去重算某一天
  assert.ok(fn.indexOf("applyWalletDay") < 0 && fn.indexOf("genDailySpend") < 0);
});

test("本月消费/单数从钱包流水求和，不用模型编的那两个数", () => {
  const ms = app.match(/const phoneMonthStatsFor = char => \{[\s\S]*?\n  \};/);
  assert.ok(ms, "找不到 phoneMonthStatsFor");
  assert.match(ms[0], /if \(!e \|\| !e\.srcKey\) return;/, "把日常开销也算进「本月网购」了");
  assert.match(ms[0], /if \(e\.refundOf\) \{[\s\S]{0,120}spend = r2\(out\[src\]\.spend - /, "退款没从本月消费里减掉");
  assert.match(ms[0], /if \(out\[k\]\.spend < 0\) out\[k\]\.spend = 0;/, "退上个月的单会让本月消费变成负数");
  // 界面以钱包为准，钱包没建档才退回模型那份
  const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
  // ⚠️v59.38：那一排「本月消费／本月订单／积分」统计块删掉了（电商「我的」页的部件），
  // 但这条不变——**同一屏不许两处说着不同的钱**。数改成一句话摆在「合起来看」里，
  // 核的还是【以钱包为准、钱包没建档才退回模型那份】这个先后。
  assert.match(phone, /const spendLine = ms\s*\n\s*\? "这一阵花掉 " \+ shopMoney\(ms\.spend\)/, "购物页没改用钱包的数");
  assert.match(phone, /: \(acc\.monthSpend != null \? "这一阵花掉 " \+ shopMoney\(acc\.monthSpend\)/, "钱包没建档时没有退回模型那份");
  assert.match(phone, /ms \? fmtMoney\(ms\.spend\) : \(acc\.monthSpend/, "外卖页没改用钱包的数");
  assert.match(phone, /这两个只是占位，界面会用钱包的真实流水覆盖它们/, "提示词没说明这两个数会被覆盖");
});
