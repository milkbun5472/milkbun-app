const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const grab = (src, a, b, why) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出：" + why); return src.slice(i, j); };

// 把钱包那几个真函数抠出来跑（不碰 React）
function makeWallet(store, chars) {
  const src = [
    grab(app, "  const debtSig = d =>", "  const genWalletProfile = async char =>", "walletDebts"),
    grab(app, "  const walletDebtPeer = who =>", "  // 生成某天的日常消费", "settleDebt")
  ].join("\n");
  const st = { w: JSON.parse(JSON.stringify(store)), toasts: [] };
  const ref = { current: st.w };
  const api = new Function("charWalletRef", "characters", "liveChars", "setCharWallet", "saveJSON", "numClean", "r2", "toast",
    src + "\nreturn { walletDebts, settleDebt, debtSig, walletDebtPeer };")(
    ref, chars, chars.filter(c => !c.npc),
    fn => { const n = fn(ref.current); if (n) { ref.current = n; st.w = n; } },
    () => {},
    v => { const n = Number(v); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; },
    v => Math.round(v * 100) / 100,
    m => st.toasts.push(m));
  return { api, st };
}
const CHARS = [{ id: "c1", name: "江识" }, { id: "c2", name: "裴照川", remark: "王爷" }];
const wal = (bal, debts) => ({ init: true, balance: bal, debts: debts, ledger: [] });

// 她 2026-08-30：「有别人的欠债后续会不会真的还回来增加余额」
test("欠他的收回来余额真的会多，他欠的还掉真的会少", () => {
  const { api, st } = makeWallet({
    c1: wal(8400, [{ id: "d1", who: "外人", amount: 1200, dir: "owed" }, { id: "d2", who: "房东", amount: 800, dir: "owe" }])
  }, CHARS);
  api.settleDebt("c1", "d1");
  assert.equal(st.w.c1.balance, 9600, "收回欠款没进余额");
  api.settleDebt("c1", "d2");
  assert.equal(st.w.c1.balance, 8800, "还钱没从余额里出去");
  const kinds = st.w.c1.ledger.filter(e => e.kind === "debt");
  assert.equal(kinds.length, 2, "没留下流水，翻账本看不出这两笔");
  assert.ok(kinds.some(e => /收回欠款/.test(e.label)) && kinds.some(e => /还钱/.test(e.label)));
  // after 得跟着算，不然账本上那一列是错的
  kinds.forEach(e => assert.equal(typeof e.after, "number"));
  assert.ok(st.w.c1.debts.every(d => d.settledTs), "没标成已结清");
});

// 她 2026-08-30：「然后思考如果是两个角色之间的能不能互通」
test("欠账对上她名录里另一个角色：两边一起动，钱不会凭空多出来", () => {
  const { api, st } = makeWallet({
    c1: wal(8400, [{ id: "d1", who: "裴照川", amount: 1200, dir: "owed", why: "垫的诊金" }]),
    c2: wal(52000, [])
  }, CHARS);
  const before = st.w.c1.balance + st.w.c2.balance;
  api.settleDebt("c1", "d1");
  assert.equal(st.w.c1.balance, 9600, "收钱那边没加");
  assert.equal(st.w.c2.balance, 50800, "付钱那边没减");
  assert.equal(st.w.c1.balance + st.w.c2.balance, before, "两边加起来变了——凭空造钱或者凭空少钱");
  const a = st.w.c1.ledger.find(e => e.kind === "debt"), b = st.w.c2.ledger.find(e => e.kind === "debt");
  assert.ok(a && b, "有一边没留流水");
  assert.equal(a.delta + b.delta, 0, "两笔流水对不上");
  assert.match(b.label, /江识/, "对面那笔没写清是跟谁");
});

test("按备注也认得出是同一个人", () => {
  const { api, st } = makeWallet({
    c1: wal(1000, [{ id: "d1", who: "王爷", amount: 100, dir: "owe" }]), c2: wal(1000, [])
  }, CHARS);
  api.settleDebt("c1", "d1");
  assert.equal(st.w.c2.balance, 1100, "写的是备注就认不出来了");
});

test("对面没开通钱包就只动他自己这边，不偷偷给对面建账", () => {
  const { api, st } = makeWallet({
    c1: wal(8400, [{ id: "d1", who: "裴照川", amount: 1200, dir: "owed" }]),
    c2: { init: false, balance: 0, debts: [], ledger: [] }
  }, CHARS);
  api.settleDebt("c1", "d1");
  assert.equal(st.w.c1.balance, 9600);
  assert.equal(st.w.c2.balance, 0, "对面还没开通就不该动");
  assert.equal((st.w.c2.ledger || []).length, 0);
});

test("同一笔不许结清两次", () => {
  const { api, st } = makeWallet({ c1: wal(1000, [{ id: "d1", who: "外人", amount: 500, dir: "owed" }]) }, CHARS);
  api.settleDebt("c1", "d1");
  api.settleDebt("c1", "d1");
  api.settleDebt("c1", "d1");
  assert.equal(st.w.c1.balance, 1500, "重复点了几下就多收了几次钱");
  assert.equal(st.w.c1.ledger.filter(e => e.kind === "debt").length, 1);
});

// 刷新档案是整份重编的：结清过的不许被重新生成的档案复活
test("重新生成资产档案，结清过的那笔不会复活", () => {
  const { api } = makeWallet({}, CHARS);
  const prev = [
    { id: "d1", who: "张奕", amount: 300, dir: "owed", settledTs: 111 },
    { id: "d2", who: "房东", amount: 800, dir: "owe" }
  ];
  const next = api.walletDebts({ debts: [
    { who: "张奕", amount: 300, dir: "owed", why: "聚餐" },   // 模型又写了一遍
    { who: "房东", amount: 800, dir: "owe" },
    { who: "新的人", amount: 50, dir: "owe" }
  ] }, prev);
  const zhang = next.find(d => d.who === "张奕");
  assert.ok(zhang && zhang.settledTs === 111, "结清过的又变回没结清了——她再点一次就多收一次钱");
  assert.equal(zhang.id, "d1", "id 换了，界面上就成了另一笔");
  assert.ok(next.every(d => d.id), "有的欠账没有 id，点结清会点不中");
  assert.ok(next.some(d => d.who === "新的人"), "新的那笔没进来");
  // 结清过、这次没再生成的，也得留着看得见
  const gone = api.walletDebts({ debts: [{ who: "房东", amount: 800, dir: "owe" }] }, prev);
  assert.ok(gone.some(d => d.who === "张奕" && d.settledTs), "结清过的直接消失了，看不出这笔了过");
});

// 她 2026-08-30：「为你花的也搞一个箭头可以收起来不然太长了」
test("为你花的能收起来，收起来的时候仍然看得见总额", () => {
  const i = screens.indexOf('forHer.length ? cardBox([');
  const sec = screens.slice(i, screens.indexOf("// 日常消费", i));
  assert.ok(sec.length > 100, "找不到为你花的那一栏");
  assert.match(sec, /onClick: \(\) => setForHerOpen\(v => !v\)/, "没有收起来的开关");
  assert.match(sec, /transform: forHerOpen \? "rotate\(180deg\)"/, "没有那个箭头");
  // 收起来也得看得见总额和笔数，否则收起来等于把信息藏没了
  const head = sec.slice(0, sec.indexOf("forHerOpen ? h(\"div\", { key: \"fb\""));
  assert.match(head, /fmtMoney\(forHerTotal\)/, "收起来之后连总额都看不见了");
  assert.match(head, /forHer\.length \+ " 笔"/, "收起来之后看不出有几笔");
});

// 她问的另一半：跟购物/外卖到底有没有联动。有——而且两个方向都接着，
// 这条测试把它钉住，别哪天被拆了
test("钱包和购物/外卖是双向接着的，而且不会同一笔算两遍", () => {
  const money = grab(app, "  const phoneMoneyFor = char =>", "  // ---- 查手机：每个 app 独立生成/刷新 ----", "phoneMoneyFor");
  assert.match(money, /balance:/, "余额没发给花钱的那几个 app，穷角色照样下大单");
  const day = grab(app, "  const applyWalletDay = async (char, dayKey)", "  const catchUpWallet", "applyWalletDay");
  assert.match(day, /phoneOrdersOnDay\(char\.id, dayKey\)/, "手机上真下过的单子没有入账");
  assert.match(day, /srcKey/, "没有防重键，补账跑两遍就会把同一单记两次");
  const spend = grab(app, "  const genDailySpend = async (char, dayKey, rec, already)", "  const applyWalletDay", "genDailySpend");
  assert.match(spend, /已经入账了，不要重复/, "没告诉模型那几笔已经记过，它会再编一顿饭");
});
