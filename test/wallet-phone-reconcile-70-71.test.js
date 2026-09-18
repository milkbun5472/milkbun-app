// 她 2026-09-18：「钱包的日常消费里面为什么没有购物，然后看看查手机的外卖能不能跟钱包对上」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// ── ① 钱包这一屏：手机上的单本来一处都不显示 ──────────────────
// applyWalletDay 把外卖/网购落成 kind:"order"（带 srcKey），日常推演落成 kind:"daily"。
// 钱包屏原来两处都只筛 "daily"：那些钱从余额里扣掉了，却既不在列表里、
// 也不算进本月花费——剩余可用因此永远偏高。
test("日常消费和本月花费都要把手机上那几单算进去", () => {
  assert.match(screens, /const SPEND_KINDS = \["daily", "order"\];/);
  assert.match(screens, /const dailyEntries = ledger\.filter\(isSpend\);/);
  assert.match(screens, /ledger\.filter\(e => isSpend\(e\) && inMonth\(e\.ts\)\)/);
  assert.ok(!/ledger\.filter\(e => e\.kind === "daily"\)/.test(screens), "又只筛 daily 了");
  // 退款那几笔 delta 是正的（钱退回来），求和时要减掉而不是加上
  assert.match(screens, /\.reduce\(\(a, e\) => a - Number\(e\.delta \|\| 0\), 0\)/, "退款被当成又花了一笔");
  assert.ok(!/isSpend[\s\S]{0,80}Math\.abs\(e\.delta\)\), 0\)/.test(screens));
  // 列表里认得出哪几条是手机上真下过的单
  assert.match(screens, /e\.kind === "order" \? h\("span"/);
});

// ── ② 查手机那两栏的数，是从钱包账本里数出来的 ────────────────
const statsOf = ledger => {
  const i = app.indexOf("  const phoneMonthStatsFor = char => {");
  const src = app.slice(i, app.indexOf("  const genDailySpend =", i));
  const ctx = { charWalletRef: { current: { c1: { init: true, ledger } } }, r2: n => Math.round(n * 100) / 100 };
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.__o = phoneMonthStatsFor({ id: 'c1' });", ctx);
  return ctx.__o;
};
const now = Date.now();
const row = (src, key, delta, extra) => Object.assign({ ts: now, delta, srcKey: "2026-09-18|" + src + "|" + key, kind: "order" }, extra || {});

test("查手机的外卖/网购跟钱包对得上：数的就是钱包那本账", () => {
  const led = [row("takeout", "a", -38), row("takeout", "b", -52), row("shopping", "c", -260)];
  const o = statsOf(led);
  assert.equal(o.takeout.spend, 90);
  assert.equal(o.takeout.orders, 2);
  assert.equal(o.shopping.spend, 260);
  // 钱包那一屏对同一批账的合计（本月花费里手机那部分）
  const walletSide = led.filter(e => e.kind === "order").reduce((a, e) => a - e.delta, 0);
  assert.equal(walletSide, o.takeout.spend + o.shopping.spend, "两边对不上就是各数各的");
});

test("退了款的单，两边都得把钱减回去", () => {
  const o = statsOf([row("takeout", "a", -38), row("takeout", "a", 38, { refundOf: "2026-09-18|takeout|a" })]);
  assert.equal(o.takeout.spend, 0);
  // 上个月的单这个月退 → 别显示负的消费
  assert.equal(statsOf([row("shopping", "z", 200, { refundOf: "x" })]).shopping.spend, 0);
});

test("没有 srcKey 的（模型推演的日常消费）不许混进查手机那两栏", () => {
  const o = statsOf([{ ts: now, delta: -18, kind: "daily", label: "路边买的包子" }]);
  assert.equal(o.takeout.spend, 0);
  assert.equal(o.shopping.spend, 0);
});

// ── ③ 唯一会对不上的地方：一天封顶几单 ────────────────────────
// phoneOrdersOnDay 末尾那个 slice 决定【一天最多认几单】。超出的那几单
// 手机上看得见、钱包里一分不扣，而且 phoneReconcile 用的是同一个函数，
// 所以它也永远补不上——这是两边唯一真会对不上的口子。
test("一天认几单的封顶要够高，不然手机上看得见的单钱包里不扣", () => {
  const i = app.indexOf("  const phoneOrdersOnDay = (charId, dayKey) => {");
  const seg = app.slice(i, app.indexOf("  // ── 核账", i));
  const m = seg.match(/return out\.slice\(0, (\d+)\);/);
  assert.ok(m, "封顶那一行没了");
  assert.ok(Number(m[1]) >= 20, "封到 " + m[1] + " 单：购物多的那一天会漏扣，而核账走的是同一个函数，补不回来");
  // 核账确实走同一个函数（所以封顶改一处就够）
  assert.match(app, /phoneOrdersOnDay\(charId, dk\)\.forEach\(b =>/);
});
