// 复合（她 2026-10-17）：一周内写信、TA 自己定；被退回一天后才能再写；好感不再是硬门槛
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
const send = app.slice(app.indexOf("const sendCoupleInvite = async"), app.indexOf("const askCoupleInvite = async"));
const ask = app.slice(app.indexOf("const askCoupleInvite = async"), app.indexOf("const respondCoupleInvite = "));
const resp = app.slice(app.indexOf("const respondCoupleInvite = "), app.indexOf("const beginCouple = "));
test("冷静期里不再直接挡，而是要一封信", () => {
  assert.ok(!/再等等吧（还差/.test(send));
  assert.ok(/requestAppPrompt\(/.test(send) && /letter:/.test(send));
});
test("好感不再是硬门槛", () => { assert.ok(!/加回被扣的一半/.test(send)); assert.ok(/不是门槛/.test(ask)); });
test("被退回记 declinedTs，一天内挡住", () => {
  assert.ok(/declinedTs: Date\.now\(\)/.test(resp));
  assert.ok(/REJOIN_DECLINE_COOL_MS = 864e5/.test(app) && /declinedTs/.test(send));
});
test("TA 拆信时读得到那封信和当初怎么分的", () => { assert.ok(/invM\.letter/.test(ask) && /bkA\.mode/.test(ask)); });
test("邀请卡上显示那封信", () => {
  const card = comp.slice(comp.indexOf("function CoupleInviteCard("), comp.indexOf("function UnblockReqCard("));
  assert.ok(/m\.letter \?/.test(card));
});
