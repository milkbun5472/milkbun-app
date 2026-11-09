const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
// 她 2026-11-08 转群里许愿：删除好友；他一直来加，被拒了可能换小号
test("删好友存在 x_blocks 那一份里，加回来落墓碑（留着他加了几次、用没用小号）", () => {
  assert.match(app, /if \(merged\.iBlocked \|\| merged\.theyBlocked \|\| merged\.deleted\) n\[charId\] = merged;/);
  assert.match(app, /n\[charId\] = \{ endedTs: Date\.now\(\), sinceTs: Number\(cur\.deletedTs\) \|\| 0, by: "del", reqs \};/);
  assert.match(app, /if \(b\.deleted\) return "【她把你删了好友】"/);
});
test("被删着时：主动那一路改成发好友申请，她发消息、按回复都拦下", () => {
  assert.match(app, /if \(opts && opts\.proactive\) return typeof bgJob === "function" \? bgJob\("proactive", [^\n]*sendFriendReq\(charId\)\)/);
  assert.match(app, /if \(\(blocksRef\.current\[activeChar\.id\] \|\| \{\}\)\.deleted\) \{ toast\("你已经删了 TA，先加回好友才能发消息"\); return; \}/);
  assert.match(app, /if \(!autoRefreshOn\("proactive", charId\)\) return false;/);
  assert.match(app, /reqs\.some\(r => r\.status === "pending"\)\) return false;/);
});
test("申请自己定用不用小号；她在「新的朋友」里通过或拒绝", () => {
  assert.match(app, /schemaHint: "\{\\"send\\":true,\\"alt\\":\\"\\",\\"note\\":\\"验证语\\"\}"/);
  assert.match(c, /function FriendReqPage\(\{ t, reqs, onAnswer, onClose \}\)/);
  assert.match(c, /entry\("新的朋友"/);
  assert.match(c, /"data-wk": "csdelfriend"/);
});
// 她 2026-11-08：「顺便把他可以删好友也一起弄了吧，被删好友期间朋友圈不可见之类的」
test("他也能删她：拉黑那一套照用，标 cut:del；求的是好友申请", () => {
  assert.match(app, /block:true 之外再写 unfriend:true/);
  assert.match(app, /const _cut = parsed\.unfriend === true && !sideRoom;/);
  assert.match(app, /if \(b\.theyBlocked && b\.cut === "del"\) return "【你把 Ta 删了好友】"/);
  assert.match(app, /content: \(bk\.cut === "del" \? "\[好友申请\] " : "\[解除拉黑申请\] "\)/);
  assert.match(c, /bk\.cut === "del" \? "TA 把你删了" : "TA 把你拉黑了"/);
});
test("有一方删了好友，朋友圈互相看不到", () => {
  assert.match(app, /const friendCut = id => \{ const b = \(blocksRef\.current \|\| \{\}\)\[id\] \|\| \{\}; return !!\(b\.deleted \|\| \(b\.theyBlocked && b\.cut === "del"\)\); \};/);
  assert.match(app, /const momSeen = \(m, charId\) => !!m && !!m\.mine && !friendCut\(charId\) &&/);
  assert.equal((app.match(/moments: moments\.filter\(m => !m\.characterId \|\| !friendCut\(m\.characterId\)\)/g) || []).length, 2);
});
test("她自己加回来，他记得", () => {
  assert.match(app, /删了我好友以后，又自己把我加了回来/);
});
// 她 2026-11-08「1234都可以」
test("他删了她以后自己想回来：主动那一路改成他发申请，通过了就解开", () => {
  assert.match(app, /if \(_bkD\.theyBlocked && _bkD\.cut === "del" && opts && opts\.proactive\) return [^\n]*sendFriendReq\(charId\)/);
  assert.match(app, /const mine = !!\(b\.theyBlocked && b\.cut === "del"\);   \/\/ 他自己删的她/);
  assert.match(app, /setBlockFor\(charId, mine \? \{ theyBlocked: false \} : \{ deleted: false \}\);/);
});
test("他手机上跟她那段最后一行灰字；她被删着还发，落一行朋友验证", () => {
  const ph = fs.readFileSync(__dirname + "/../js/phone-ui.js", "utf8");
  assert.match(app, /if \(friendCut\(char\.id\)\) \{ [^\n]*kind: "sysline"/);
  assert.match(ph, /if \(m\.kind === "sysline"\) return h\("div"/);
  assert.match(app, /sub: "frverify", content: "对方开启了朋友验证/);
});
test("她删他时把最后那几句留给他：他知道是因为什么", () => {
  assert.match(app, /setBlockFor\(charId, \{ deleted: true, deletedTs: Date\.now\(\), reqs: \[\], lastWords \}\);/);
  assert.match(app, /她删你之前，你们最后说的是：/);
});
