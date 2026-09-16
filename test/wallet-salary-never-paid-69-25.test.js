// 她 2026-09-16：「还有钱包每月收入都没有到账。。他们现在都是负数的钱了」。
//
// 一条病因解释了她说的两件事：
//   `baseBalance` 抠不出来有三级兜底（重试 → 从月收入反推 → 带随机的默认值），
//   可 `monthlyIncome` / `fixedMonthly` 一级兜底都没有——抠不出来就是 0，
//   而 initCharWallet 即使整份档案是 null 也照样把钱包标成 init:true 建起来。
// 这种钱包：1 号那笔 inc = 0 − 0 = 0，`if (inc)` 为假 → 一笔都不记
//   （「每月收入都没有到账」是字面意义上的真），
//   日常消费却照样天天扣 → 余额单调往下 → 「他们现在都是负数的钱了」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const cut = (a, b) => { const i = app.indexOf(a), j = app.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return app.slice(i, j); };
// ⚠️只数【代码】：病历注释里会逐字引用 kind 名（"monthly"），
//   连注释一起数的话，写得越清楚的注释越容易把自己的断言搞红（v69.16 栽过一次）。
const strip = t => t.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
// walletMoneyFloor 抠出来真跑——它是这次的地板，不能只 grep 一眼
const floorSrc = cut("  const walletMoneyFloor = (prof, base, dailyMonthly) =>", "  const initCharWallet = async char =>");
const numClean = v => (typeof v === "number" ? (isFinite(v) ? v : 0) : (Number(String(v == null ? "" : v).replace(/[,，\s¥￥$元]/g, "")) || 0));
const walletMoneyFloor = new Function("numClean", floorSrc + "\nreturn walletMoneyFloor;")(numClean);

test("月收入和固定支出都不许推出 0——0 的钱包永远发不出工资", () => {
  // 整份档案没了（她那批坏钱包就是这种）
  for (let i = 0; i < 200; i++) {
    const r = walletMoneyFloor(null, 0, 0);
    assert.ok(r.monthlyIncome > 0, "月收入推成了 0");
    assert.ok(r.fixedMonthly > 0, "固定支出推成了 0");
  }
});

test("有分项收入就用合计，不凭空推", () => {
  const r = walletMoneyFloor({ incomes: [{ amount: 7000 }, { amount: 1500 }] }, 0, 0);
  assert.equal(r.monthlyIncome, 8500);
});

test("只有存款时从存款反推，用的是建钱包那头同一组系数", () => {
  // 那头是「存款 ≈ 月收入 × 1.5~4.5」，这里反过来除同一组数
  for (let i = 0; i < 200; i++) {
    const r = walletMoneyFloor({}, 45000, 0);
    assert.ok(r.monthlyIncome >= 45000 / 4.5 - 1 && r.monthlyIncome <= 45000 / 1.5 + 1,
      "反推落在区间外：" + r.monthlyIncome);
  }
});

// ⚠️第一版只保证「两栏不是 0」，跑一遍才发现根本不够：推出月收入 2978、固定支出 1155，
//   看着挺正常，可这个人每天还在吃喝交通上花一百多＝一个月三千多，
//   于是每个月净亏一千几——补发四个月，余额还是负的。
//   **这条链上有三样在花钱：固定支出、日常消费、手机上下的单**，
//   而原来只让收入跟固定支出比过一次。
test("收入要收得住【固定支出 + 日常吃喝】，不然补多少个月都还是负的", () => {
  for (let i = 0; i < 400; i++) {
    const dailyMonthly = 1500 + Math.round(Math.random() * 4000);
    const r = walletMoneyFloor({ incomes: [] }, 8200, dailyMonthly);
    assert.ok(r.monthlyIncome - r.fixedMonthly - dailyMonthly > 0,
      "净收支还是负的：收入 " + r.monthlyIncome + " 固定 " + r.fixedMonthly + " 日常 " + dailyMonthly);
    // 松固定支出可以，松到 0 就又犯了上面那条——话费水电总是要交的
    assert.ok(r.fixedMonthly > 0, "固定支出被压成 0 了");
  }
});

test("余下多少是个区间，不是一个数（掷约束别掷答案）", () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const r = walletMoneyFloor({ incomes: [] }, 8200, 3000);
    seen.add(r.monthlyIncome - r.fixedMonthly - 3000);
  }
  assert.ok(seen.size > 50, "每次都余下同一个数＝把「该攒多少」也替角色定死了");
});

test("不传日常消费时只保证两栏不是 0，不去动收入", () => {
  const r = walletMoneyFloor({ monthlyIncome: 9000, fixedMonthly: 8000 }, 0);
  assert.equal(r.monthlyIncome, 9000, "没给日常消费就别擅自抬收入");
  assert.equal(r.fixedMonthly, 8000);
});

test("固定支出是收入的一截，不是一个写死的数（掷区间不掷答案）", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const r = walletMoneyFloor({ monthlyIncome: 10000 }, 0, 0);
    assert.ok(r.fixedMonthly >= 3500 && r.fixedMonthly <= 6000, "比例跑飞了：" + r.fixedMonthly);
    seen.add(r.fixedMonthly);
  }
  assert.ok(seen.size > 20, "每次都推出同一个数＝写死了");
});

test("两处建钱包共用这一份地板，没人再写 `? numClean(...) : 0`", () => {
  assert.match(app, /\.\.\.walletMoneyFloor\(prof, base\),/, "首开那处没搬");
  assert.match(app, /\.\.\.walletMoneyFloor\(\{\s*\n\s*monthlyIncome: numClean\(prof\.monthlyIncome\) \|\| cur\.monthlyIncome \|\| 0,/, "重刷那处没搬");
  assert.ok(!/monthlyIncome: prof \? numClean\(prof\.monthlyIncome\) : 0/.test(app), "首开那处还留着会推出 0 的老写法");
});

// ── 1 号那两笔 ──────────────────────────────────────────────
test("工资和固定支出拆成两笔，工资那一笔单独站着", () => {
  const seg = strip(cut("      if (isFirst) {", "      // 手机上真下过的单子"));
  assert.match(seg, /chron\.push\(mk\(inc, "工资到账", "monthly"/);
  assert.match(seg, /chron\.push\(mk\(-fix, "每月固定支出 · 房租水电这些", "monthlyfix"/);
  // 老的净额写法不许留着：净额小或为负时，账本上根本看不出工资进来过
  assert.ok(!/月度收支 · 工资到账 − 固定支出/.test(app));
  // ⚠️对账靠 kind：monthly 只能是工资那一笔，不然补发会把月数数成两倍
  assert.equal((seg.match(/"monthly"/g) || []).length, 1);
});

// ── 存量修复：数账本，不拍脑袋 ────────────────────────────────
test("补发是【对账】出来的：应发几次减实发几次", () => {
  const seg = cut("  const healWalletPay = char =>", "  const catchUpWallet = async char =>");
  assert.match(seg, /const paid = \(rec\.ledger \|\| \[\]\)\.filter\(e => e && e\.kind === "monthly"\)\.length;/);
  assert.match(seg, /const miss = due - paid;/);
  assert.match(seg, /if \(miss <= 0\) return;/);
  assert.match(seg, /const delta = r2\(miss \* \(inc - fix\)\);/);
  // 天然幂等：补完差额归零，不另存「修过了」的标记（标记会和真相不同步）
  assert.ok(!/healedPay|walletHealed/.test(app), "又另存了一个会和真相不同步的标记");
  // 坏数据别把这里变成死循环
  assert.match(seg, /due < 120/);
});

test("「他过日子花多少」是数账本数出来的，不是猜的", () => {
  const seg = cut("  const healWalletPay = char =>", "  const catchUpWallet = async char =>");
  // 只数日常和手机上的单：转账、固定支出那些不是「过日子」
  assert.match(seg, /e\.kind === "daily" \|\| e\.kind === "order"/);
  assert.match(seg, /Number\(e\.delta\) < 0/, "把退款那种正数也当成花销了");
  // 按账本真实跨度折算成一个月，不是拿笔数乘一个系数
  assert.match(seg, /dailyMonthly = Math\.round\(total \/ spanDays \* 30\);/);
});

test("两样都是 0 的老钱包要【就地】补地板，不能早退等她去重刷", () => {
  const seg = cut("  const healWalletPay = char =>", "  const catchUpWallet = async char =>");
  assert.match(seg, /const floor = walletMoneyFloor\(\{ incomes: rec\.incomes \|\| \[\] \}, base, dailyMonthly\);/);
  // 早退必须排在补地板【之后】，否则她那批坏钱包永远等不到修
  assert.ok(seg.indexOf("const floor = walletMoneyFloor") < seg.indexOf("if (!inc && !fix) return;"),
    "又在补地板之前早退了");
});

test("体检挂在早退【前面】：补账已经补到昨天的钱包照样可能欠着工资", () => {
  const seg = cut("  const catchUpWallet = async char =>", "  // 转账：联动我的钱包");
  assert.ok(seg.indexOf("healWalletPay(char);") < seg.indexOf("if (lastKey >= cutoffKey) return;"),
    "体检排在早退后面＝大多数时候根本不跑");
});
