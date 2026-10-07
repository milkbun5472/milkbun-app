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

// ⚠️上面那条只验了【两头】：app 递了 onRemark、微信那页认 ctx.onRemark。
//   中间那一跳（PhoneCarry 收下它、放进往下递的 ctx）漏了，于是微信那页永远拿到 undefined，
//   「›」一次都没出现过——家里和公共版都是（她 2026-10-07 在公共版截图问出来的）。
//   一条链得每一跳都验，两头对上不等于通了。
test("从 app 到微信那页，每一跳都接上了（中间那跳曾经漏过）", () => {
  // ① app 把它递给 PhoneCarry
  const carryCall = seg(app, 'screen === "phone") body = /*#__PURE__*/React.createElement(PhoneCarry, {', '});else if');
  assert.match(carryCall, /onRemark: phoneRemarkEdit,/, "app 没递给 PhoneCarry");
  // ② PhoneCarry 收下
  const carryParams = seg(phone, "function PhoneCarry({", "}) {");
  assert.match(carryParams, /\n\s*onRemark,\n/, "PhoneCarry 没收下 onRemark——这就是那次断掉的地方");
  // ③ 放进往下递的 ctx（没有就给 null，不给空函数：微信那页靠它的真假决定露不露「›」）
  assert.match(phone, /onRemark: onRemark \? \(ch, c, v\) => onRemark\(ch, c, v\) : null,/, "收下了却没放进 ctx");
  // ④ 微信那页从 ctx 取
  assert.match(phone, /onRemark: ctx\.onRemark/);
});

test("真跑一遍：ctx 那一跳拿得到、调得通", () => {
  // 照 PhoneCarry 里那一行原样搭出 ctx.onRemark，看它是不是真把三个参数递回 app 那支
  const calls = [];
  const onRemark = (ch, c, v) => calls.push([ch, c, v]);
  const line = phone.match(/onRemark: (onRemark \? \(ch, c, v\) => onRemark\(ch, c, v\) : null),/)[1];
  const built = eval(line);
  assert.equal(typeof built, "function", "有 onRemark 时 ctx 里应该是个函数");
  built("角色", { name: "某人" }, "新备注");
  assert.deepEqual(calls[0], ["角色", { name: "某人" }, "新备注"]);
  const none = eval(line.replace(/^onRemark/, "undefined"));
  assert.equal(none, null, "没有 onRemark 时得是 null——给个空函数的话「›」会出现、点了却什么都不发生");
});
