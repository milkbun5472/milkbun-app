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
