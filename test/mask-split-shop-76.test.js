// 她 2026-10-29「来我们慢慢开始分吧」：钱包购物按面具分——第一步，购物。
// 定的规矩：下单时选用哪张面具付；旧单都算主面具；TA 送的、代付的算 TA 认的那张。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");

test("订单记面具：自己挑的照挑的，TA 送的跟 TA 认的那张，其余主面具", () => {
  assert.match(app, /mask: o && o\.mask != null \? String\(o\.mask \|\| ""\) : \(o && o\.fromCharId \? maskKeyOf\(o\.fromCharId\) : ""\),/);
  assert.match(app, /takeout: it\.takeout, mask: payMask \}\)\);\n      removeCartUids\(uids\);/);
  const i = app.indexOf("const orderMaskOf = o =>");
  const f = new Function("maskKeyOf", "return " + app.slice(i + "const orderMaskOf = ".length, app.indexOf("\n", i)).replace(/;$/, ""))(id => id === "c_b" ? "mk_b" : "");
  assert.equal(f({ mask: "mk_b" }), "mk_b");
  assert.equal(f({}), "", "旧单算主面具");
  assert.equal(f({ fromCharId: "c_b" }), "mk_b", "老单里 TA 送的跟 TA 认的那张");
});

test("查手机：别的面具买的单他看不到（文字和录像两头）", () => {
  assert.match(app, /!\(maskIds && maskIds\.length && orderMaskOf\(o\) !== maskKeyOf\(viewerId\)\)/);
  assert.match(app, /window\.__peekMask = Object\.assign\(peekMaskInfo\(maskIds\), \{ mine: maskKeyOf\(charId\) \}\)/);
  assert.equal((app.match(/orderMaskOf\(o\) !== peekMaskView\(\)\.mine/g) || []).length, 3, "购物两屏＋外卖吃过的那屏");
});

test("结算时有「用哪张面具买」，只在有副面具时出现，点得到", () => {
  assert.match(ui, /payMasks\.length > 1\) \? h\("div", \{ "data-wk": "shoppaymask"/);
  assert.match(ui, /onCheckout\(sel, "buy", null, \{ mask: payMask \}\)/);
  assert.match(ui, /"data-wk": "shoppaymaskitem"[^\n]*\n[^\n]*minHeight: 40/);
});

// 第二步：外卖（跟购物同一个规矩、同一份面具名单）
test("外卖：点单时选面具，吃完进「吃过的」带着面具，查手机按面具挡", () => {
  const ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
  assert.match(ui, /onOrder\(\{ shop: shop\.name, items: bagItems, remark, note: mode === "forchar" \? say : "" \}, mode, target, \{ mask: payMask \}\)/);
  assert.match(ui, /"data-wk": "tkopaymaskitem"[^\n]*\n[^\n]*minHeight: 40/);
  assert.match(app, /addOrder\(\{ \.\.\.item, mask: payMask \}\)/);
  assert.match(app, /fromCharId: o\.fromCharId \|\| null, mask: orderMaskOf\(o\), ts: Date\.now\(\)/);
  assert.match(app, /const tk = \(takeoutLog \|\| \[\]\)\.filter\(o => !\(maskIds && maskIds\.length && orderMaskOf\(o\) !== maskKeyOf\(viewerId\)\)/);
  assert.equal((app.match(/payMasks: payMaskList\(\),/g) || []).length, 2, "购物外卖共用一份名单");
});

// 第三步：钱包流水
test("钱包流水记面具：购物外卖跟着选的那张，转给谁跟谁认的那张，其余主面具；查手机两头挡", () => {
  assert.match(app, /entry\.mask = walletMaskOf\(\{ mask: ref && ref\.mask != null \? ref\.mask : undefined, ref: entry\.ref \}\);/);
  assert.match(app, /"shop", \{ where: "购物", mask: payMask \}\)/);
  assert.match(app, /"shop", \{ where: "外卖", mask: payMask \}\)/);
  const i = app.indexOf("const walletMaskOf = w =>");
  const f = new Function("maskKeyOf", "return " + app.slice(i + "const walletMaskOf = ".length, app.indexOf("\n", i)).replace(/;$/, ""))(id => id === "c_b" ? "mk_b" : id === "g:g1" ? "mk_g" : "");
  assert.equal(f({ mask: "mk_b" }), "mk_b");
  assert.equal(f({ ref: { charId: "c_b" } }), "mk_b", "转给他的跟他认的那张");
  assert.equal(f({ ref: { groupId: "g1" } }), "mk_g", "群红包跟群那张");
  assert.equal(f({ label: "工资" }), "", "其余主面具");
  assert.match(app, /const log = \(walletLog \|\| \[\]\)\.filter\(w => !\(maskIds && maskIds\.length && walletMaskOf\(w\) !== maskKeyOf\(viewerId\)\)/);
  assert.match(app, /walletLog\.filter\(w => !\(peekMaskView\(\)\.mine != null && walletMaskOf\(w\) !== peekMaskView\(\)\.mine\)/);
});
