const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const live = fs.readFileSync(__dirname + "/../js/live.js", "utf8");
// 她 2026-11-08：路人主播加成好友变成角色后，他钱包里看得到以前刷过的钱；之后再刷也进他钱包
test("转正时把以前刷过的钱（他到手那一半）记进新角色钱包", () => {
  assert.match(live, /const tipped = listRef\.current\.filter\(s2 => s2\.stranger && s2\.charId === st\.id\)/);
  assert.match(live, /props\.charPay\(cid, toHost\(tipped\), "以前在直播间收到的打赏/);
});
test("已经转正的路人主播，之后的打赏进他转正后那个人的钱包", () => {
  assert.match(live, /const payee = !s\.stranger \? s\.charId : \(\(\(stGet\(s\.charId\) \|\| \{\}\)\.promoted\) \|\| ""\);/);
  assert.match(live, /props\.charPay\(payee, toHost\(amount\), "直播收到打赏/);
});
