// 她给 TA 的亲属卡（她 2026-10-07：「我也可以给角色亲属卡，然后后续的联动」→「都可以」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const A = R("app.js"), C = R("components.js"), S = R("screens.js");
test("刷的是她的钱，三道闸：冻结 / 额度 / 她钱包", () => {
  const i = A.indexOf("const spendMyKin = ");
  const body = A.slice(i, A.indexOf("\n  };\n", i));
  assert.match(body, /if \(card\.frozen\) return \{ ok: false/);
  assert.match(body, /myKinRemain\(card\) < amt\) return \{ ok: false/);
  assert.match(body, /walletRef\.current < amt\) return \{ ok: false/);
  assert.match(body, /changeWallet\(-amt,/);
});
test("聊天里：有卡就把事实摆出来，冻结时不开刷卡字段", () => {
  assert.match(A, /if \(!_myKin\.frozen\) openCaps\.push\("herkinspend"\);/);
  assert.match(A, /parsed\.herkinspend = null;/);
  assert.match(A, /const _r = spendMyKin\(charId, _it, Number\(parsed\.herkinspend\.amount\), "chat"\);/);
  assert.match(R("chat-rooms.js"), /"herkinspend"/);
});
test("每天的开销里：开了平时也能刷才问；重生那一天不再刷", () => {
  assert.match(A, /const _kinDay = !!\(_kc && _kc\.daily && !_kc\.frozen && myKinRemain\(_kc\) > 0\);/);
  assert.match(A, /if \(!b \|\| !b\.card \|\| manual\) return true;/);
  assert.match(A, /kind: "mykindaily"/);
});
test("TA 在历史里读得到这几件事", () => {
  ["mykin", "mykinedit", "mykinbill", "mykindaily"].forEach(k => assert.ok(A.indexOf('m.kind === "' + k + '" ?') > 0, k));
  ["MyKinIssueCard", "MyKinSpendCard", "MyKinDailyCard", "MyKinEditCard"].forEach(k => assert.match(C, new RegExp("function " + k + "\\(")));
  assert.match(S, /function MyKinPage\(/);
  assert.match(C, /\["mykin", "亲属卡", "card"\]/);
});
