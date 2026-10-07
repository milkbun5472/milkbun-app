const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const phone = fs.readFileSync(__dirname + "/../js/phone.js", "utf8");
const seg = (src, a, b) => { const i = src.indexOf(a); assert.ok(i > 0, a); return src.slice(i, src.indexOf(b, i)); };

test("改TA通讯录备注：走 savePhoneApp 就地改、灰字、等她按回复", () => {
  const f = seg(app, "const phoneRemarkEdit =", "const phoneRemarkSpec =");
  assert.match(f, /savePhoneApp\(char\.id, "wechat", nd, \{ noArchive: true, patched: true \}\)/);
  assert.match(f, /kind: "system"/);
  assert.match(f, /waitForHer\(char\.id, \{ phoneRemark:/);
  assert.doesNotMatch(f, /replyNow/);
});

test("TA知道的两个时刻：下一轮一次、刷新微信一次（刷完清掉）", () => {
  assert.match(app, /const remarkHint = opts\.phoneRemark/);
  assert.match(app, /peekMemoFor\(charId\)\) \+ remarkHint;/);
  assert.equal((app.match(/phoneRemarkSpec\(char, key, phoneProbeSpec\(/g) || []).length, 2);
  assert.equal((app.match(/phoneRemarkDone\(char, key\);/g) || []).length, 2);
});

test("通讯录详情页的备注格能点开改，看TA玩时不给改", () => {
  assert.match(phone, /onRemark: ctx\.onRemark/);
  assert.match(phone, /onRemark && !drive && remarkDraft != null/);
  assert.match(phone, /_me: true \}, \.\.\.arr\(d\.contacts\)/);
  assert.match(app, /onRemark: phoneRemarkEdit,/);
});
