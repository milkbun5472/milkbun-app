// 群友许愿 2026-10-31「买重的东西可以退货」：购物「我的」里待发货能取消、待收货和我的物品能退货，
// 钱原路退回真正付钱的那个人；TA 那边的在私聊里留一条旁白。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
const studio = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
const manual = fs.readFileSync(path.join(__dirname, "..", "js", "assistant-manual.js"), "utf8");

function rig(state) {
  const i = app.indexOf("  const payerOf = o => {"), j = app.indexOf("  const checkout = (uids, mode, target, opts) => {", i);
  assert.ok(i > 0 && j > i, "抠不出 payerOf / returnShopThing");
  const calls = { wallet: [], char: [], kin: [], chat: [], confirm: [], orders: state.orders.slice(), inv: state.inv.slice(), toast: [] };
  const env = {
    inventoryRef: { current: calls.inv }, ordersRef: { current: calls.orders },
    kinshipCardsRef: { current: state.cards || [] }, charWalletRef: { current: state.cw || {} },
    characters: [{ id: "c1", name: "哥哥" }], profile: { name: "她" },
    orderMaskOf: o => o && o.mask != null ? String(o.mask || "") : "",
    pocketOf: m => m === "mk2" ? "mk2" : "", moneyText: a => "¥" + a, userName: p => p.name,
    toast: t => calls.toast.push(t),
    requestAppConfirm: (title, body, ok, label) => { calls.confirm.push({ title, body, label }); ok(); },
    dropInv: id => { calls.inv = calls.inv.filter(x => x.id !== id); },
    saveOrders: fn => { calls.orders = fn(calls.orders); },
    changeWallet: (d, label, kind, ref) => calls.wallet.push({ d, label, kind, ref }),
    adjustCharBalance: (id, d, label, kind) => calls.char.push({ id, d, label, kind }),
    updateKinshipCard: (id, fn) => calls.kin.push(fn({ used: 100 })),
    pChat: (id, fn) => calls.chat.push({ id, msgs: fn([]) })
  };
  const names = Object.keys(env);
  const f = new Function(...names, app.slice(i, j) + "\nreturn returnShopThing;")(...names.map(k => env[k]));
  return { f, calls };
}

test("自己付的：退回她的钱包、回到下单那张面具，流水写「退货退款」，不发私聊", () => {
  const { f, calls } = rig({ orders: [{ id: "o1", name: "哑铃", price: 88, mask: "mk2", status: "receiving", payLabel: "" }], inv: [] });
  f("order", "o1");
  assert.equal(calls.confirm.length, 1, "先确认");
  assert.match(calls.confirm[0].body, /¥88 退回你的钱包/);
  assert.deepEqual(calls.wallet[0], { d: 88, label: "退货退款：哑铃", kind: "shop", ref: { where: "购物", mask: "mk2" } });
  assert.equal(calls.char.length, 0); assert.equal(calls.chat.length, 0);
  assert.equal(calls.orders.length, 0);
});

test("TA 代付的、待发货：取消订单，钱回 TA 钱包，私聊留一条第三人称旁白", () => {
  const { f, calls } = rig({ orders: [{ id: "o2", name: "跑步机", price: 999, fromCharId: "c1", status: "shipping", payLabel: "哥哥 代付" }], inv: [] });
  f("order", "o2");
  assert.equal(calls.confirm[0].label, "取消订单");
  assert.match(calls.confirm[0].body, /退回 哥哥 的钱包/);
  assert.deepEqual(calls.char[0], { id: "c1", d: 999, label: "取消订单退款：跑步机", kind: "shop" });
  assert.equal(calls.wallet.length, 0);
  const m = calls.chat[0].msgs[0];
  assert.equal(calls.chat[0].id, "c1"); assert.equal(m.role, "narration");
  assert.equal(m.content, "她 取消了哥哥 代付的「跑步机」那一单，¥999 退回了 哥哥 的钱包。");
});

test("TA 送的、已入库：钱包开通才退钱；没开通只拿走东西不凭空加钱", () => {
  const item = { id: "i1", name: "大花瓶", price: 300, fromCharId: "c1", payLabel: "哥哥 送的" };
  let r = rig({ orders: [], inv: [item], cw: { c1: { init: true } } });
  r.f("item", "i1");
  assert.equal(r.calls.char[0].d, 300); assert.match(r.calls.chat[0].msgs[0].content, /把哥哥 送的「大花瓶」退了货/);
  r = rig({ orders: [], inv: [item], cw: {} });
  r.f("item", "i1");
  assert.equal(r.calls.char.length, 0); assert.equal(r.calls.inv.length, 0);
});

test("刷亲属卡的：退回 TA 账上，额度还回去", () => {
  const { f, calls } = rig({ orders: [{ id: "o3", name: "沙发", price: 40, kinCharId: "c1", status: "receiving", payLabel: "刷了 哥哥 的亲属卡" }], inv: [] });
  f("order", "o3");
  assert.equal(calls.char[0].kind, "kinship"); assert.equal(calls.kin[0].used, 60);
});

test("外卖单、梦里的、没价钱的旧物品退不了", () => {
  const { f, calls } = rig({ orders: [{ id: "t", kind: "takeout", name: "奶茶", price: 20 }], inv: [{ id: "d", name: "羽毛", source: "dream" }, { id: "old", name: "旧杯子" }] });
  f("order", "t"); f("item", "d"); f("item", "old");
  assert.equal(calls.confirm.length, 0);
});

test("界面：三处按钮，挂点复用已登记的那几个、点得到；收下时把价钱和付款人带进物品", () => {
  assert.match(ui, /"data-wk": "shoporderbtn", "data-part": "cancel", onClick: \(\) => onReturn\("order", o\.id\)[^\n]*minHeight: 40/);
  assert.match(ui, /"data-wk": "shoporderbtn", "data-part": "return", onClick: \(\) => onReturn\("order", o\.id\)[^\n]*minHeight: 40/);
  assert.match(ui, /row\("退货", [^\n]*\n[^\n]*onReturn\("item", it\.id\)/);
  assert.match(studio, /\["shoporderbtn", "[^"]*cancel 取消订单 \/ return 退货"\]/);
  assert.match(studio, /\["shopinvact", /);
  assert.match(app, /onReturn: asPhone \? null : returnShopThing,/);
  assert.match(app, /price: o\.price, payLabel: o\.payLabel \|\| "", mask: orderMaskOf\(o\)/);
  assert.match(app, /fromCharId: null, kinCharId: charId, payLabel: "刷了 "/);
  assert.ok(!/function Takeout\([^)]*onReturn/.test(ui), "外卖那一屏不接");
});

test("攻略写了退货", () => {
  assert.match(manual, /\*\*取消订单 \/ 退货：\*\*/);
});
