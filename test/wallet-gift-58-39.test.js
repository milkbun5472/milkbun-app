const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
// ⚠️抠出来的这段现在会调 userName(profile)：真的那一个从 core.js 抠出来递进去，
//   别在这儿抄一份兜底（stub-from-the-writer.md）。
const { userName } = require("./_user-name.js");
const grab = (src, a, b, why) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出：" + why); return src.slice(i, j); };

function makeGift(store) {
  const src = grab(app, "  const GIFT_PRICE_HINT = [", "  // 代付：", "礼物那几个函数");
  const st = { w: JSON.parse(JSON.stringify(store)), chat: [], orders: [] };
  const ref = { current: st.w };
  return {
    st,
    api: new Function("charWalletRef", "characters", "profile", "setCharWallet", "saveJSON", "numClean", "r2", "pChat", "addOrder", "Date", "userName",
      src + "\nreturn { giftPrice, walletSpend, postCharGift };")(
      ref, [{ id: "c1", name: "江识" }], { name: "Lisa" },
      fn => { const n = fn(ref.current); if (n) { ref.current = n; st.w = n; } },
      () => {},
      v => { const n = Number(v); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; },
      v => Math.round(v * 100) / 100,
      (id, fn) => { st.chat = fn(st.chat); },
      o => { st.orders.push(o); },
      Date, userName)
  };
}
const wal = extra => ({ c1: { init: true, balance: 5000, ledger: [], ...extra } });

// 她 2026-08-30：「现在给我发礼物卡比如买杯咖啡给我好像也没有生成价格和实际扣钱吧」
test("送东西给她：真的扣钱、真的记一笔流水、订单上也是真价钱", () => {
  const { api, st } = makeGift(wal({ monthlyIncome: 9000 }));
  api.postCharGift("c1", "一杯生椰拿铁", 28);
  assert.equal(st.w.c1.balance, 4972, "钱包没扣钱");
  const e = st.w.c1.ledger[0];
  assert.equal(e.kind, "gift");
  assert.equal(e.delta, -28);
  assert.equal(e.after, 4972, "after 没跟着算，账本那一列就错了");
  assert.match(e.label, /Lisa/, "流水上看不出这笔是为谁花的");
  assert.match(e.label, /生椰拿铁/, "流水上看不出买的是什么");
  assert.equal(st.orders[0].price, 28, "订单还是 0 元——她收到的卡片上不显示价钱");
  assert.equal(st.chat[0].item.price, 28, "聊天里那张礼物卡没带价钱");
});

test("模型没给价钱就本地估一个，而且按他的家底缩放", () => {
  const poor = makeGift(wal({ monthlyIncome: 3000 }));
  const rich = makeGift(wal({ monthlyIncome: 45000 }));
  const a = poor.api.giftPrice("c1", "一杯拿铁", null);
  const b = rich.api.giftPrice("c1", "一杯拿铁", null);
  assert.ok(a > 0 && b > 0, "估不出价钱");
  assert.ok(a < b, "穷学生和有钱人送的咖啡估成一个价了：" + a + " / " + b);
  assert.ok(a >= 5, "估成了几乎不要钱");
  // 品类得认得出来：一束花不该跟一杯咖啡一个价
  const g = makeGift(wal({ monthlyIncome: 9000 })).api.giftPrice;
  assert.ok(g("c1", "一束玫瑰", null) > g("c1", "一杯美式", null), "花和咖啡估成一个价了");
  // 模型给了就用模型的（他自己最清楚送的是什么档次的东西）
  assert.equal(g("c1", "一杯美式", 88), 88);
  assert.equal(g("c1", "一杯美式", "88"), 88, "字符串数字没认");
  assert.ok(g("c1", "随便什么", 99999999) <= 200000, "价钱没有上限，一次能把余额清空");
});

test("还没开通钱包的角色不扣钱，也不偷偷替他建账", () => {
  const { api, st } = makeGift({ c1: { init: false, balance: 0, ledger: [] } });
  api.postCharGift("c1", "一杯拿铁", 28);
  assert.equal(st.w.c1.balance, 0);
  assert.equal(st.w.c1.ledger.length, 0);
  // 东西照样送到——钱包没开通不该连礼物都收不到
  assert.equal(st.orders.length, 1, "钱包没开通就连东西都不送了");
});

test("协议里 gift 带上 price，并说清楚这笔钱会真的扣", () => {
  assert.match(app, /gift:\{"name":"物品","price":数字\}/, "能力清单里 gift 还没有 price");
  const hint = grab(app, "【gift 送东西/外卖】", "【voice 语音】", "gift 那段说明");
  assert.match(hint, /price/, "gift 那段说明里没让他给价钱");
  assert.match(hint, /会真的从你钱包里扣掉/, "没告诉他这笔钱是真扣，他会乱送");
  assert.match(hint, /手头紧的时候你自己掂量着送/, "没让他按自己的处境掂量");
});

// 她 2026-08-30：「为你花的那一块显示有好多就是编出来的，根本没有点过给我」
test("为你花的只认真发生过的四种，推演出来的日常花销一律不算", () => {
  const i = screens.indexOf("const FOR_HER_KINDS");
  assert.ok(i > 0, "还在靠名字匹配筛「为你花的」");
  const seg = screens.slice(i, i + 400);
  const kinds = JSON.parse((seg.match(/\[[^\]]*\]/) || ["[]"])[0].replace(/'/g, '"'));
  assert.deepEqual(kinds.slice().sort(), ["gift", "kinship", "redpacket", "transfer"].sort());
  // 真按 kind 筛，不是又拿名字兜一遍
  assert.match(seg, /FOR_HER_KINDS\.indexOf\(e\.kind\) >= 0/);
  assert.ok(!/L\.indexOf\(meName\)/.test(screens), "名字匹配那一套还留着，编出来的又会混进来");
  // 跑一遍：名目里写着她名字的日常消费不许算进去
  const forHer = new Function("ledger", "FOR_HER_KINDS",
    "return ledger.filter(e => e && Number(e.delta) < 0 && FOR_HER_KINDS.indexOf(e.kind) >= 0);")(
    [{ delta: -28, kind: "gift", label: "给 Lisa 买的 一杯生椰拿铁" },
     { delta: -200, kind: "transfer", label: "转账给 Lisa" },
     { delta: -35, kind: "daily", label: "给 Lisa 带的桂花糕" },
     { delta: -60, kind: "order", label: "Lisa 爱吃的那家 · 外卖" },
     { delta: 500, kind: "transfer", label: "Lisa 转来的" }], kinds);
  assert.deepEqual(forHer.map(e => e.kind), ["gift", "transfer"], "编出来的（daily/order）混进来了，或者把她转给他的也算成他花的");
});

test("收起来的时候写清楚这一栏到底算什么", () => {
  const i = screens.indexOf('forHer.length ? cardBox([');
  const sec = screens.slice(i, screens.indexOf("// 日常消费", i));
  assert.match(sec, /只算你真的收到过的/, "没说清这一栏的口径，她还是会以为漏了");
  assert.match(sec, /推演出来的日常花销不算在这儿/, "没说清哪一类被排除了");
});
