// 钱包补的三样：钱放在哪儿、欠账、为你花的
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

// 两个清洗器抽出来真跑
const W = (() => {
  const grab = name => {
    const i = app.indexOf("const " + name + " = ");
    assert.ok(i >= 0, "找不到 " + name);
    let depth = 0, started = false, end = i;
    for (let j = i; j < app.length; j++) {
      const c = app[j];
      if (c === "{" || c === "(" || c === "[") { depth++; started = true; }
      else if (c === "}" || c === ")" || c === "]") depth--;
      if (started && depth === 0 && app[j + 1] === ";") { end = j + 2; break; }
    }
    return app.slice(i, end);
  };
  const numClean = 'const numClean = v => { const n = Number(String(v == null ? "" : v).replace(/[^\\d.\\-]/g, "")); return isFinite(n) ? Math.round(n * 100) / 100 : 0; };';
  return new Function(numClean + grab("walletAccounts") + grab("walletDebts") +
    "; return { walletAccounts, walletDebts };")();
})();

test("账户：只留一处 primary，一处都没标就把第一条当它", () => {
  // primary 是他随身可动用的那笔，日常花销从这儿出。它的额度由钱包余额说了算，
  // 不然「贴身荷包 2850」和上面的余额 2850 会被当成两笔钱加两遍。
  const one = W.walletAccounts({ accounts: [
    { name: "官钱庄", hold: 120000 }, { name: "荷包", hold: 2850 }, { name: "商行份子", hold: 380000 }
  ] });
  assert.equal(one.filter(a => a.primary).length, 1);
  assert.equal(one[0].primary, true, "一处都没标时该把第一条当随身那笔");

  const many = W.walletAccounts({ accounts: [
    { name: "甲", hold: 1, primary: true }, { name: "乙", hold: 2, primary: true }, { name: "丙", hold: 3, primary: "true" }
  ] });
  assert.equal(many.filter(a => a.primary).length, 1, "标了好几处也只能留一处");
  assert.equal(many[0].primary, true);
});

test("账户：脏数据洗干净，没名字的不要", () => {
  const out = W.walletAccounts({ accounts: [
    { name: "  官钱庄  ", kind: "俸禄折", tail: 9012, hold: "¥120,000", note: "明面上的" },
    { name: "", hold: 999 }, null, "字符串", { hold: 5 }
  ] });
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "官钱庄");
  assert.equal(out[0].tail, "9012");
  assert.equal(out[0].hold, 120000, "带符号带逗号的金额没洗干净");
  assert.deepEqual(W.walletAccounts(null), []);
  assert.deepEqual(W.walletAccounts({ accounts: "不是数组" }), []);
});

test("欠账：dir 写歪了整栏就反了，一律归一", () => {
  // 界面靠 dir 分左右两边（他欠 / 欠他），模型会写「我欠」「欠我」这种
  const out = W.walletDebts({ debts: [
    { who: "程策", amount: 3000, dir: "owe", why: "垫了定金" },
    { who: "陆闻", amount: 800, dir: "owed" },
    { who: "甲", amount: 100, dir: "欠我" },
    { who: "乙", amount: 100, dir: "别人欠" },
    { who: "丙", amount: 100, dir: "我欠" },
    { who: "丁", amount: 100, dir: "看不懂的" }
  ] });
  assert.deepEqual(out.map(d => d.dir), ["owe", "owed", "owed", "owed", "owe", "owe"],
    "认不出来的该一律当「他欠人」——更常见，也更不容易读成向她讨债");
  // 没写 dir 的也当「他欠人」
  assert.equal(W.walletDebts({ debts: [{ who: "戊", amount: 100 }] })[0].dir, "owe");
  // 封顶 6 笔——欠账是拿来看的，不是拿来倒的
  assert.equal(W.walletDebts({ debts: Array.from({ length: 20 }, (_, i) => ({ who: "第" + i, amount: 10 })) }).length, 6);
});

test("欠账：没名字或没金额的不算一笔", () => {
  const out = W.walletDebts({ debts: [
    { who: "程策", amount: "¥3,000" }, { who: "", amount: 100 }, { who: "甲", amount: 0 },
    { who: "乙", amount: "说不清" }, null
  ] });
  assert.equal(out.length, 1);
  assert.equal(out[0].amount, 3000);
  assert.deepEqual(W.walletDebts(null), []);
});

test("首建和重新生成两处都要存这两块（一层只写在一处，别处没跟上）", () => {
  assert.match(app, /accounts: walletAccounts\(prof\),\n\s*debts: walletDebts\(prof\),/, "首建那处");
  assert.match(app, /accounts: walletAccounts\(prof\)\.length \? walletAccounts\(prof\) : \(cur\.accounts \|\| \[\]\)/,
    "重新生成那处：模型这次没给就保留旧的，别把已有的抹成空");
  assert.match(app, /debts: walletDebts\(prof\)\.length \? walletDebts\(prof\) : \(cur\.debts \|\| \[\]\)/);
  // 数字生命那份字段形状也要一致，界面才不会读到 undefined
  assert.match(app, /incomes: \[\], monthlyIncome: 0, fixedMonthly: 0, baseBalance: 0, investAssets: 0, accounts: \[\], debts: \[\],/);
});

test("界面：随身那处显示活余额，总资产不重复计", () => {
  assert.match(scr, /const acctRows = accounts\.map\(a => a\.primary \? \{ \.\.\.a, hold: bal0 \} : a\)/,
    "随身那处还在用模型给的数，会和余额对不上");
  assert.match(scr, /const heldTotal = acctRows\.reduce\(\(n, a\) => n \+ \(a\.primary \? 0 : \(Number\(a\.hold\) \|\| 0\)\), 0\)/,
    "合计把随身那笔又加了一遍");
  assert.match(scr, /const assetTotal = heldTotal \+ bal0;/);
  assert.match(scr, /随身 · 流水走这儿/);
});

test("界面：为你花的是从流水里筛的，不额外生成", () => {
  const m = scr.match(/const forHer = ledger\.filter\(e => \{[\s\S]*?\n  \}\);/);
  assert.ok(m, "找不到 forHer");
  assert.match(m[0], /e\.kind === "transfer"/, "转账没算进去");
  assert.match(m[0], /meName\.length >= 2/, "名字太短（一个字）时不许拿去匹配，会误伤一大片");
  assert.match(m[0], /Number\(e\.delta\) < 0/, "进账也被当成「为她花的」了");
  // 只读流水，不调模型
  assert.ok(m[0].indexOf("runProbe") < 0);
  // 名字从 profile 来，两边都得接上：组件签名要收，调用点要传
  assert.match(scr, /function CharWallet\(\{[^)]*profile,/, "CharWallet 签名没收 profile");
  const call = app.match(/screen === "cwallet"\) body = h\(CharWallet, \{[\s\S]{0,240}/);
  assert.ok(call && /profile: profile,/.test(call[0]), "CharWallet 的调用点没传 profile，拿不到她的名字");
});
