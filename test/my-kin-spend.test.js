// 她给TA的亲属卡（2026-10-07 复查）：连刷几笔不许刷穿额度；不算数的房里不摆、不刷
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

function kit(card, wallet) {
  const a = app.indexOf("  const saveMyKin = updater =>"), b = app.indexOf("  // 她在账单页做的几件事", a);
  const box = { myKinRef: { current: [card] }, walletRef: { current: wallet }, characters: [{ id: "c1", name: "甲" }],
    pending: [], setMyKinCards: fn => box.pending.push(fn), saveJSON: () => {}, changeWallet: () => {}, toast: () => {}, pChat: () => {}, Date, Math };
  vm.createContext(box);
  vm.runInContext(app.slice(a, b) + ";this.spend=spendMyKin;", box);
  return box;
}

test("同一拍连刷三笔：第三笔超了额度就刷不过（setState 还没跑也一样）", () => {
  const k = kit({ charId: "c1", limit: 100, used: 0, ledger: [] }, 1000);
  assert.equal(k.spend("c1", "早饭", 40, "daily").ok, true);
  assert.equal(k.spend("c1", "午饭", 40, "daily").ok, true);
  const r = k.spend("c1", "晚饭", 40, "daily");
  assert.equal(r.ok, false);
  assert.equal(r.why, "额度不够");
  assert.equal(k.myKinRef.current[0].used, 80);
  assert.equal(k.myKinRef.current[0].ledger.length, 2);
});

test("小房间一律不摆卡、不刷卡；钱包空着时叫她直接问TA要", () => {
  assert.match(app, /const _kinRoomOk = !sideRoom;/);
  assert.match(app, /const _myKin = _kinRoomOk \? myKinOf\(charId\) : null;/);
  assert.match(app, /myKinOf\(charId\) && !sideRoom\) \{/);
  assert.match(app, /\|亲属卡\|副卡\/\.test\(recentUserText\)/);
  const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
  assert.match(screens, /想要就直接在聊天里问 TA 要/);
  assert.doesNotMatch(screens, /允许角色给我亲属卡/);
});

test("小房间里钱的出口全关：TA转账、送礼、点外卖、发卡、刷卡、收转账；她的＋面板亲属卡也挡", () => {
  const R = require("../js/chat-rooms.js");
  const room = R.normalize({ id: "r1" }, "c1");
  for (const f of ["transfer", "transferAccept", "gift", "takeout", "kinshipcard", "herkinspend"]) assert.equal(R.allowsField(room, f), false, f);
  assert.match(app, /onMyKin: \(\) => runRoomAction\(activeChar\.id, "herkinspend"/);
  assert.match(app, /const callTfOk = !cur\.groupId && \(!cur\.room \|\| cur\.room\.main\);/);
});
