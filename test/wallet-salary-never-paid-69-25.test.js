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
  // ⚠️v70.59 整段搬去 applyWalletMonthly：原来它写在 applyWalletDay 里，
  //   而那个函数第一句就 `await genDailySpend`（一枪 API）——工资虽然是本地算术，
  //   却挂在那一枪后面，没配 API / 那一枪失败 / 开关关着就不到账
  //   （她 2026-09-18：「能不能也改成跑本地到了日期自动加一笔进去」）。
  const seg = strip(cut("  const applyWalletMonthly = char =>", "  const healWalletPay = char =>"));
  assert.match(seg, /rows\.push\(mk2\(inc, "工资到账", "monthly"/);
  assert.match(seg, /rows\.push\(mk2\(-fix, "每月固定支出 · 房租水电这些", "monthlyfix"/);
  assert.ok(!/月度收支 · 工资到账 − 固定支出/.test(app));
  assert.equal((seg.match(/"monthly"/g) || []).length, 1, "monthly 只能是工资那一笔");
  // 搬走了就不许在原地留一份：两处各记一笔＝双倍工资
  const day = cut("  const applyWalletDay = async (char, dayKey) =>", "  // 每天自动补一次账");
  assert.ok(!/"工资到账"/.test(day), "applyWalletDay 里那份没删干净");
  assert.ok(!/isFirst/.test(day), "isFirst 还留着");
  // 这一条【不打枪】：它整个函数里不许出现 await / runProbe
  assert.ok(!/await |runProbe/.test(seg), "月结又开始打 API 了，那就白搬了");
});

// ── 存量修复：数账本，不拍脑袋 ────────────────────────────────
// ⚠️v70.59 换口径。原来那版数的是【笔数】：
//     const paid = ledger.filter(e => e.kind === "monthly").length;
//   可它自己补发时写的是【一笔覆盖 N 个月】的账，kind 也是 monthly。于是欠 3 个月：
//     第一次 paid=0 → 补 3 个月；第二次 paid=1 → 又补 2 个月；第三次 paid=2 → 又补 1 个月。
//   一共发了 6 个月，该发 3 个月，而且每翻一次钱包就再多发一轮。
//   现在每笔盖 monthKey，数的是【哪几个月发过】，一个月只许有一笔。
test("去重认【哪几个月】，不认【几笔】", () => {
  const seg = cut("  const applyWalletMonthly = char =>", "  const healWalletPay = char =>");
  assert.match(seg, /if \(!paid\[mk\] && cur\.getTime\(\) > healUntil\)/);
  assert.match(seg, /monthKey: mk/);
  assert.ok(!/\.filter\(e => e && e\.kind === "monthly"\)\.length/.test(app), "又按笔数数了——那会重复发");
  // 天然幂等：账本自己就是那张表，不另存「修过了」的标记（标记会和真相不同步）
  assert.ok(!/healedPay|walletHealed/.test(app), "又另存了一个会和真相不同步的标记");
  assert.match(seg, /guard < 120/, "坏数据会变成死循环");
});

// 她 2026-09-18 定的是【不倒扣】；对称地，也不许趁这次重构把说不清的月份重发一遍。
test("老的「补记 N 个月」那种笔一律当成已付到那一刻，宁可少补不许重复发", () => {
  const seg = cut("  const walletPaidMonths = rec =>", "  const applyWalletMonthly = char =>");
  assert.match(seg, /if \(\/\^补记\/\.test\(String\(e\.label \|\| ""\)\)\) healUntil = Math\.max\(healUntil, Number\(e\.ts\) \|\| 0\);/);
  assert.match(seg, /if \(e\.monthKey\) \{ paid\[e\.monthKey\] = 1; return; \}/, "新笔认自己的 monthKey");
  assert.match(seg, /else paid\[monthKeyOf\(e\.ts\)\] = 1;/, "老的 1 号那笔按它的时间归月");
  // 不倒扣：全库不许出现把钱扣回去的更正笔。
  // ⚠️只看【代码】——注释里当然会提到「不倒扣」这三个字（写的就是这条规矩本身）。
  const code = app.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  assert.ok(!/多记了|倒扣|冲正/.test(code), "她说了不倒扣");
});

test("工资不受自动刷新那道闸管——它一枪都不打", () => {
  const seg = cut("  const walletCatchAllToday = async () =>", "  // 补账：把 lastDailyKey");
  assert.ok(seg.indexOf("applyWalletMonthly(c)") < seg.indexOf('!autoRefreshOn("wallet")'),
    "月结又被关进那道闸后面了：没配 API 就不发工资");
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
  // 补完地板才轮到月结：否则她那批 monthlyIncome 是 0 的坏钱包永远等不到工资
  assert.ok(seg.indexOf("const floor = walletMoneyFloor") < seg.indexOf("applyWalletMonthly(char);"),
    "又在补地板之前就去月结了，那时候工资还是 0");
});

test("体检挂在早退【前面】：补账已经补到昨天的钱包照样可能欠着工资", () => {
  const seg = cut("  const catchUpWallet = async char =>", "  // 转账：联动我的钱包");
  assert.ok(seg.indexOf("healWalletPay(char);") < seg.indexOf("if (lastKey >= cutoffKey) return;"),
    "体检排在早退后面＝大多数时候根本不跑");
});

// ── 把 applyWalletMonthly 抠出来【真跑一遍】────────────────────────────
// 光 grep「函数在」挡不住「它其实多发了一个月」。钱算错是她当场看得见的那种错。
const vm = require("node:vm");
const runMonthly = (rec, nowStr) => {
  const i = app.indexOf("  const monthKeyOf = ts =>");
  const src = app.slice(i, app.indexOf("  const healWalletPay = char =>", i));
  let state = { c1: rec };
  const ctx = {
    pad2: n => String(n).padStart(2, "0"),
    r2: n => Math.round(n * 100) / 100,
    charWalletRef: { current: state },
    setCharWallet: fn => { state = fn(state); },
    saveJSON: () => {},
    Date: class extends Date {
      constructor(...a) { if (!a.length) super(nowStr); else super(...a); }
      static now() { return new Date(nowStr).getTime(); }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.__n = applyWalletMonthly({ id: 'c1' });", ctx);
  return { n: ctx.__n, rec: state.c1 };
};
// 桩照【写存档那段】写：applyWalletMonthly 落的就是这些字段（stub-from-the-writer.md）
const wal = over => Object.assign({
  init: true, balance: 1000, monthlyIncome: 8000, fixedMonthly: 3000,
  createdTs: new Date("2026-06-15T00:00:00").getTime(), ledger: []
}, over || {});
const TODAY = "2026-09-18T11:00:00";

test("建档 6/15、今天 9/18：补 7、8、9 三个月，一个月两笔", () => {
  const r = runMonthly(wal(), TODAY);
  assert.equal(r.n, 6, "三个月 × （工资 + 固定支出）");
  assert.equal(r.rec.balance, 1000 + 3 * (8000 - 3000));
  // ⚠️join 再比：vm 里造出来的数组是另一个 realm 的 Array，deepEqual 会因为原型不同而红
  const months = k => r.rec.ledger.filter(e => e.kind === k).map(e => e.monthKey).sort().join(",");
  assert.equal(months("monthly"), "2026-07,2026-08,2026-09");
  assert.equal(months("monthlyfix"), "2026-07,2026-08,2026-09");
});

// ⚠️这一条就是老那版栽的地方：它每翻一次钱包就再多发一轮（3 → +2 → +1）。
test("再跑几次一分钱都不许多", () => {
  let cur = runMonthly(wal(), TODAY).rec;
  for (let i = 0; i < 4; i++) cur = runMonthly(cur, TODAY).rec;
  assert.equal(cur.balance, 16000, "重复发了：" + cur.balance);
  assert.equal(cur.ledger.filter(e => e.kind === "monthly").length, 3);
});

test("老的「补记 N 个月」那笔在，就一个月都不补（宁可少补，不许重复发）", () => {
  const r = runMonthly(wal({ balance: 16000, ledger: [{ kind: "monthly",
    label: "补记 · 之前 3 个月的工资和固定支出",
    ts: new Date("2026-09-17T10:00:00").getTime(), delta: 15000 }] }), TODAY);
  assert.equal(r.n, 0);
  assert.equal(r.rec.balance, 16000);
});

test("建档当月的 1 号不算——那天还没有这个钱包", () => {
  assert.equal(runMonthly(wal({ createdTs: new Date("2026-09-03T00:00:00").getTime() }), TODAY).n, 0);
});

test("没填工资也没填固定支出的，一个字都不记", () => {
  assert.equal(runMonthly(wal({ monthlyIncome: 0, fixedMonthly: 0 }), TODAY).n, 0);
  // 只有固定支出没有工资也得扣——那种人设是有的
  const r = runMonthly(wal({ monthlyIncome: 0, fixedMonthly: 1200 }), TODAY);
  assert.equal(r.n, 3);
  assert.equal(r.rec.balance, 1000 - 3 * 1200);
});
