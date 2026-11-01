// 拿他手机转账（群友 2026-10-13）：只在真实会话；私聊走他转给你的同一张待领卡，群里他钱包挪到成员钱包
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const phone = (fs.readFileSync(path.join(__dirname, "../js/phone.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "../js/phone-ui.js"), "utf8"));
test("只有真实会话能转，私聊复用 postCharTransfer 并标 byUser", () => {
  assert.match(app, /const phoneTransferAs = \(char, session, amount, note, toId, opt\) => \{/);  // opt：红包（2026-10-25）
  assert.match(app, /id\.indexOf\("actual:"\) !== 0\) return false;/);
  assert.match(app, /postCharTransfer\(char\.id, a, nt, pk \? \{ byUser: true, packet: true \} : \{ byUser: true \}\)/);
});
test("群里：两边钱包一减一加，不超过他余额", () => {
  assert.match(app, /const a = Math\.min\(a0, Math\.round\(bal \* 100\) \/ 100\);/);
  assert.match(app, /adjustCharBalance\(char\.id, -a,/);
  assert.match(app, /adjustCharBalance\(to\.id, a,/);
});
test("手机那头接上了，转账收在「＋」里", () => {
  assert.match(phone, /onTransferAs: onTransferAs \? \(sess, amt, note, toId, opt\) => onTransferAs\(char, sess, amt, note, toId, opt\) : null/);
  assert.match(phone, /!drive && asCanSend && tfOpen \?/);
});

test("「＋」里有转账；跟她的私聊里还有购物、外卖，开的就是她自己那两页，只是花他的钱", () => {
  assert.match(phone, /"data-part": "plus", onClick: \(\) => setPlus\(v => v \? null : "menu"\)/);
  assert.ok(!/"¥"\) : null,/.test(phone), "不要单独那颗钱符号");
  assert.match(phone, /canBuy \? \["shop", "购物", /);
  assert.match(phone, /canBuy \? \["takeout", "外卖", /);
  assert.match(app, /const phoneShopAs = \(char, where\) => \{/);
  assert.match(app, /body = h\(Shop, \{\n(    [^\n]*\n)?    payAs: asPhonePay,/);   // 上面可以多一行别的（商品图那几个，v88.831）
  assert.match(app, /body = h\(Takeout, \{\n(    [^\n]*\n)?    payAs: asPhonePay,/);
});
test("用他的钱结账：购物每件走他送礼物那条路、外卖走他给她点外卖那条路，都标 byUser，钱不够不让下", () => {
  assert.match(app, /items\.forEach\(it => postCharGift\(cid, it\.name, it\.price, "", \{ byUser: true \}\)\)/);
  assert.match(app, /postCharTakeout\(cid, \{ shop: item\.takeout\.shop, items: item\.takeout\.items, price: total, note: item\.takeout\.remark \}, \{ byUser: true \}\)/);
  assert.match(app, /if \(total > asPhoneBal\(cid\)\)/);
});
test("没有「我的」那一页；离开就不再挂着他", () => {
  const scr = (fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "../js/screens-ui.js"), "utf8"));
  assert.match(scr, /\.filter\(\(\[k\]\) => !\(payAs && k === "my"\)\)/);
  assert.match(scr, /\.filter\(\(\[k\]\) => !\(payAs && k === "orders"\)\)/);
  assert.match(app, /if \(asPhone && screen !== "shop" && screen !== "takeout"\) setAsPhone\(null\)/);
});
