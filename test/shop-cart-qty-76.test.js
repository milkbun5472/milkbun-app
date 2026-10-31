// 购物车同一件并成一行带数量；结算挑这次买几件，剩下的留着（2026-10-31 群里）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path"), vm = require("vm");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
const a = app.indexOf("const cartKey = x =>"), b = app.indexOf("const addToCart = product =>");
const ctx = {}; vm.createContext(ctx); vm.runInContext(app.slice(a, b) + ";this.merge = mergeCart;", ctx);
test("同名同价并成一行，数量相加", () => {
  const out = ctx.merge([{ uid: "a", name: "杯子", price: 9 }, { uid: "b", name: "杯子", price: 9 }, { uid: "c", name: "杯子", price: 12 }, { uid: "d", name: "杯子", price: 9, qty: 2 }]);
  assert.equal(out.length, 2);
  assert.equal(out[0].uid, "a"); assert.equal(out[0].qty, 4); assert.equal(out[1].qty, 1);
});
test("结算按这次买几件拼成 ×N，剩下的留在购物车", () => {
  assert.match(app, /k > 1 \? \{ \.\.\.x, name: x\.name \+ " ×" \+ k, price: Math\.round\(\(Number\(x\.price\) \|\| 0\) \* k \* 100\) \/ 100, qty: k \}/);
  const c = app.indexOf("const checkout = (uids, mode, target, opts) =>"), body = app.slice(c, c + 4000);
  assert.doesNotMatch(body, /removeCartUids\(uids\)/);
  assert.match(body, /takeFromCart\(uids, pick\)/);
});
test("购物车每一行能挑这次买几件，结算都带上", () => {
  assert.match(ui, /"data-wk": "shopcartpick"/);
  const s = ui.indexOf("function Shop({"), blk = ui.slice(s, s + 60000);
  assert.equal((blk.match(/onCheckout\(sel/g) || []).length, (blk.match(/pick: pickN/g) || []).length);
});
test("结算那页：只摆「用余额买」，面具和别的付法收起来", () => {
  assert.match(ui, /h\(FoldRow, \{ title: "用哪张面具买"/);
  assert.match(ui, /h\(FoldRow, \{ title: "别的付法"/);
});
test("购物车每行都有 −件数+，件数能直接打字", () => {
  assert.match(ui, /"data-wk": "shopcartqtyinput", type: "text", inputMode: "numeric"/);
  assert.match(app, /const setCartQty = \(uid, q\) =>/);
  assert.match(app, /onSetCartQty: setCartQty,/);
});

// 件数能打到七位（群友 2026-10-31：「只能输入 3 位数」）
require("node:test")("购物车件数上限 999 万，输入框跟着位数变宽", () => {
  const assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8"), ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
  assert.match(app, /Math\.min\(9999999, Math\.round\(Number\(q\)\) \|\| 1\)/);
  assert.match(ui, /replace\(\/\[\^0-9\]\/g, ""\)\.slice\(0, 7\)/);
});
