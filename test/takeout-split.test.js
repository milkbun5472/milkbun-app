const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const comps = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const rooms = fs.readFileSync(path.join(__dirname, "..", "js", "chat-rooms.js"), "utf8");
const { userName } = require("./_user-name.js");
const grab = (src, a, b, why) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出：" + why); return src.slice(i, j); };

// 她 2026-09-27：角色给她点外卖，要跟购物的礼物卡分开——TA自己说是哪一种，不再按名字猜。
function makeTakeout() {
  const src = grab(app, "  const GIFT_PRICE_HINT = [", "  // 代付：", "礼物/外卖那几个函数");
  const st = { w: { c1: { init: true, balance: 500, ledger: [] } }, chat: [], orders: [] };
  const ref = { current: st.w };
  const api = new Function("charWalletRef", "characters", "profile", "setCharWallet", "saveJSON", "numClean", "r2", "pChat", "addOrder", "Date", "userName", "deliverMsForCat",
    src + "\nreturn { postCharGift, postCharTakeout };")(
    ref, [{ id: "c1", name: "江识" }], { name: "Lisa" },
    fn => { const n = fn(ref.current); if (n) { ref.current = n; st.w = n; } },
    () => {},
    v => { const n = Number(v); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; },
    v => Math.round(v * 100) / 100,
    (id, fn) => { st.chat = fn(st.chat); },
    o => { st.orders.push(o); },
    Date, userName,
    cat => (cat === "food" ? 10 * 60000 : 5 * 3600000));
  return { api, st };
}

test("takeout 出外卖卡：店名、菜品、真扣钱，订单钉死 food、和聊天卡同一个到达时间", () => {
  const { api, st } = makeTakeout();
  assert.equal(api.postCharTakeout("c1", { shop: "巷口粥铺", items: ["皮蛋瘦肉粥", "油条"], price: 32, note: "趁热" }), true);
  const m = st.chat[0];
  assert.equal(m.kind, "takeout");
  assert.equal(m.opened, undefined, "外卖没有盒子可拆");
  assert.deepEqual(m.takeout, { shop: "巷口粥铺", items: ["皮蛋瘦肉粥", "油条"], price: 32, note: "趁热" });
  assert.equal(st.w.c1.balance, 468);
  const o = st.orders[0];
  assert.equal(o.cat, "food");
  assert.equal(o.kind, "takeout");
  assert.equal(o.arriveTs, m.arriveTs, "聊天卡和订单倒计时对不上");
  assert.ok(m.arriveTs - Date.now() <= 10 * 60000 + 1000);
});

test("takeout 没有点任何东西就不出卡、不扣钱", () => {
  const { api, st } = makeTakeout();
  assert.equal(api.postCharTakeout("c1", { shop: "某店", items: [] }), false);
  assert.equal(api.postCharTakeout("c1", { shop: "某店", items: ["null"] }), false);
  assert.equal(st.chat.length, 0);
  assert.equal(st.w.c1.balance, 500);
});

test("只填 gift 的照旧是礼物盒，名字像吃的也不改判", () => {
  const { api, st } = makeTakeout();
  api.postCharGift("c1", "一碗麻辣烫", 30);
  assert.equal(st.chat[0].kind, "gift");
  assert.equal(st.chat[0].opened, false);
});

test("协议里 gift 和 takeout 是两个字段，执行处各走各的", () => {
  assert.match(app, /takeout:\{"shop":"店名","items":\["点的每一样"\]/);
  assert.match(app, /"gift", "takeout", "recall"/);
  assert.match(app, /if \(parsed\.takeout && postCharTakeout\(charId, parsed\.takeout\)\) delivered = true;/);
  assert.match(app, /parsed\.gift = null; parsed\.takeout = null;/, "不回消息那一路也要把外卖作废");
  // 旁观房按「字段名：」摘 capState，takeout 那条必须以它自己的名字起头
  assert.match(app, /capState\.push\("takeout：/);
  assert.match(rooms, /"gift", "takeout", "kinshipcard"/);
});

test("聊天里 takeout 画成外卖小票，不是礼物盒", () => {
  assert.match(comps, /if \(m\.kind === "takeout"\) return h\(TakeoutCard,/);
  const card = grab(comps, "function TakeoutCard(", "function KinshipCardFace(", "外卖小票");
  assert.doesNotMatch(card, /onOpenGift/);
  assert.match(card, /骑手在路上/);
});

// ── 外卖 app 本体（她 2026-09-27：「可以，来吧」）──
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");

test("饭点：打开时按现在几点停在对应那一格，凌晨算夜宵", () => {
  const src = grab(screens, "const TAKEOUT_SLOTS = [", "function takeoutFmtLeft(", "饭点表");
  const at = new Function(src + "\nreturn takeoutSlotAt;")();
  assert.equal(at(7), "breakfast");
  assert.equal(at(12), "lunch");
  assert.equal(at(15), "tea");
  assert.equal(at(19), "dinner");
  assert.equal(at(23), "late");
  assert.equal(at(2), "late");
});

function makeOrder(wallet) {
  const src = grab(app, "  const takeoutItemOf = bag => {", "  const genTakeout = async", "折单")
    + grab(app, "  const orderTakeout = (bag, mode, target) => {", "  // 吃完了：", "下单");
  const st = { wallet: [], orders: [], kin: [], pay: [], chat: [], toasts: [] };
  const api = new Function("wallet", "toast", "changeWallet", "addOrder", "payWithKinship", "requestPayLater", "characters", "pChat", "deliverMsForCat", "Date",
    src + "\nreturn { orderTakeout };")(
    wallet, m => st.toasts.push(m), (d, l) => st.wallet.push([d, l]), o => st.orders.push(o),
    (id, items, total) => st.kin.push({ id, items, total }), (items, total, target) => st.pay.push({ items, total, target }),
    [{ id: "c1", name: "江识" }], (id, fn) => { st.chat = fn(st.chat); }, () => 600000, Date);
  return { api, st };
}
const bag = { shop: "巷口粥铺", items: [{ name: "砂锅粥", price: 58, qty: 2 }, { name: "油条", price: 4, qty: 0 }], note: "少葱" };

test("自己付：一单折成一件 kind:takeout，扣钱、进订单，份数写进明细", () => {
  const { api, st } = makeOrder(500);
  assert.equal(api.orderTakeout(bag, "buy"), true);
  assert.equal(st.wallet[0][0], -116);
  const o = st.orders[0];
  assert.equal(o.kind, "takeout");
  assert.equal(o.cat, "food");
  assert.deepEqual(o.takeout.items, ["砂锅粥 ×2"], "没点的那样不该进单");
  assert.equal(o.takeout.note, "少葱");
});

test("代付、亲属卡走购物现成的那两条路，带着同一件外卖", () => {
  const a = makeOrder(0);
  a.api.orderTakeout(bag, "paylater", { type: "char", id: "c1" });
  assert.equal(a.st.pay[0].items[0].kind, "takeout");
  assert.equal(a.st.pay[0].total, 116);
  a.api.orderTakeout(bag, "kinship", { type: "char", id: "c1" });
  assert.equal(a.st.kin[0].items[0].kind, "takeout");
  // 那两条路落单时 kind 和明细要一路带到订单上
  assert.match(app, /addOrder\(\{ name: it\.name, price: it\.price, cat: it\.cat, kind: it\.kind, takeout: it\.takeout, fromCharId: charId,/);
  assert.match(app, /addOrder\(\{ name: it\.name, price: it\.price, cat: it\.cat, kind: it\.kind, takeout: it\.takeout, fromCharId: null,/);
});

test("给TA点：聊天里出她那边的外卖小票，不进TA随身物；钱不够就不点", () => {
  const { api, st } = makeOrder(500);
  api.orderTakeout(bag, "forchar", { type: "char", id: "c1" });
  assert.equal(st.chat[0].kind, "takeout");
  assert.equal(st.chat[0].role, "user");
  assert.ok(st.chat[0].arriveTs > Date.now());
  assert.equal(st.orders.length, 0);
  const poor = makeOrder(10);
  assert.equal(poor.api.orderTakeout(bag, "forchar", { type: "char", id: "c1" }), false);
  assert.equal(poor.st.chat.length, 0);
});

test("外卖单归外卖 app，购物「我的」不再列它；主屏、秋秋名单、色相都登记了", () => {
  assert.match(screens, /o\.status === "shipping" && o\.kind !== "takeout"/);
  assert.match(screens, /o\.status === "receiving" && o\.kind !== "takeout"/);
  assert.match(comps, /takeout: \{ kind: "app", zh: "外卖", G: GTakeout \}/);
  assert.match(core, /shop: "购物", takeout: "外卖"/);
  assert.match(app, /screen === "takeout"\) body = h\(Takeout,/);
});
