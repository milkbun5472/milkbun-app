// 拿他手机转账（群友 2026-10-13）：只在真实会话；私聊走他转给你的同一张待领卡，群里他钱包挪到成员钱包
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const phone = fs.readFileSync(path.join(__dirname, "../js/phone.js"), "utf8");
test("只有真实会话能转，私聊复用 postCharTransfer 并标 byUser", () => {
  assert.match(app, /const phoneTransferAs = \(char, session, amount, note, toId\) => \{/);
  assert.match(app, /id\.indexOf\("actual:"\) !== 0\) return false;/);
  assert.match(app, /postCharTransfer\(char\.id, a, nt, \{ byUser: true \}\)/);
});
test("群里：两边钱包一减一加，不超过他余额", () => {
  assert.match(app, /const a = Math\.min\(a0, Math\.round\(bal \* 100\) \/ 100\);/);
  assert.match(app, /adjustCharBalance\(char\.id, -a,/);
  assert.match(app, /adjustCharBalance\(to\.id, a,/);
});
test("手机那头接上了，¥ 键只在能替他发的会话里出现", () => {
  assert.match(phone, /onTransferAs: onTransferAs \? \(sess, amt, note, toId\) => onTransferAs\(char, sess, amt, note, toId\) : null/);
  assert.match(phone, /!drive && asCanSend && tfOpen \?/);
});
