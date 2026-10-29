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
  assert.equal((app.match(/orderMaskOf\(o\) !== peekMaskView\(\)\.mine/g) || []).length, 2);
});

test("结算时有「用哪张面具买」，只在有副面具时出现，点得到", () => {
  assert.match(ui, /payMasks\.length > 1\) \? h\("div", \{ "data-wk": "shoppaymask"/);
  assert.match(ui, /onCheckout\(sel, "buy", null, \{ mask: payMask \}\)/);
  assert.match(ui, /"data-wk": "shoppaymaskitem"[^\n]*\n[^\n]*minHeight: 40/);
});
