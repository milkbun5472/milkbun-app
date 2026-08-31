const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ph = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const src = ph.slice(ph.indexOf("const PHONE_TA_KEEP"), ph.indexOf("function phoneProbeSpec("));
const K = new Function(src + "\nreturn { phoneTa, charTa };")();

// 她 2026-08-31 的后半段：提示词那一半 v58.86 已经从一处过掉了，这一半是【界面标签】
//（「他的订单」「他为什么想买」「解锁 · 进他的桌面」），一百五十多处写死的字面量。
// 一个人的手机同一时刻只看得了一份，所以记一个模块级的「现在在看谁」就够，
// 不用把称呼一路穿过几十个组件的 props。
test("界面标签走 T()，默认那一档一个字不动", () => {
  assert.match(ph, /let PHONE_VIEW_TA = "他";/, "没有「现在在看谁」这一处");
  assert.match(ph, /function phoneViewTa\(char\) \{ PHONE_VIEW_TA = charTa\(char\); \}/, "没接上 charTa");
  assert.match(ph, /function T\(s\) \{ return PHONE_VIEW_TA === "他" \? s : phoneTa\(s, PHONE_VIEW_TA\); \}/,
    "T\\(\\) 没走快路——默认档也去跑一遍替换，白折腾");
});

test("两个渲染入口都定了称呼，不然子树会拿到上一个人的", () => {
  const app = ph.slice(ph.indexOf("function PhoneApp({"), ph.indexOf("function PhoneCarry({"));
  assert.match(app, /phoneViewTa\(char\);/, "整机页没定");
  const carry = ph.slice(ph.indexOf("function PhoneCarry({"));
  assert.match(carry, /const char = characters\.find\(c => c\.id === selId\) \|\| characters\[0\];\n  phoneViewTa\(char\);/,
    "列表页没定，或者不是跟着选中那位走");
});

test("确实包住了那一批标签，不是只改了两处", () => {
  const n = (ph.match(/T\("/g) || []).length;
  assert.ok(n >= 90, "只包了 " + n + " 处，那一百来个标签没扫干净");
});

// ⚠️提示词那一半【不许】被这一套碰：那边的称呼是按 charTa(char) 逐个角色算的，
// 而 T() 用的是「现在在看谁」——两者混在一起，后台给 A 生成时会用上 B 的称呼。
test("只包界面那一段，提示词那两头一处都没动", () => {
  const uiStart = ph.indexOf("function phoneSearch(rows, extra, q) {");
  const uiEnd = ph.indexOf("const PHONE_ANGLE = {");
  assert.ok(uiStart > 0 && uiEnd > uiStart);
  // 注释里写着 T("他的订单") 这个例子，先剥掉注释再看，不然是自己抓自己
  const bare = x => x.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(bare(ph.slice(0, uiStart)).indexOf('T("') < 0, "提示词那一半（前半段）被包进去了");
  assert.ok(bare(ph.slice(uiEnd)).indexOf('T("') < 0, "提示词那一半（后半段）被包进去了");
  // 提示词仍然走各自角色的那一条
  assert.match(ph, /instruction: phoneTa\(_full, charTa\(char\)\)/, "提示词那条路被改坏了");
});

test("不是代词的「他」没被包进去", () => {
  const wrapped = ph.match(/T\("((?:[^"\\]|\\.)*)"\)/g) || [];
  wrapped.forEach(w => {
    const body = w.slice(3, -2);
    const rest = body.replace(/其他|他们|他人|他乡|吉他|利他|排他|他杀|他律/g, "");
    assert.ok(rest.indexOf("他") >= 0, "这条里没有真正的代词，白包了：" + body.slice(0, 24));
  });
  // 真跑一遍：包了也不会把保护词换坏
  assert.equal(K.phoneTa("其他他们他人吉他他", "她"), "其他他们他人吉他她");
});
