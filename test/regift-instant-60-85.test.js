const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const gift = (() => {
  const i = app.indexOf("const sendGiftToChar = (charId, itemName, cat, hand) => {");
  assert.ok(i > 0, "sendGiftToChar 抠不出来了");
  return app.slice(i, app.indexOf("\n  // 礼物送达后", i));
})();

// 她 2026-09-03：「我买了东西送到了，选择转赠的时候显示还有一段时间」。
// 病因：转赠走的是和「买了送人」同一条路，于是又从头跑了一遍快递倒计时——
// 可东西明明已经在她手上了。

test("转赠是当面转手：不再从头跑一遍快递", () => {
  assert.match(app, /sendGiftToChar\(charId, o\.name, o\.cat, true\)/, "转赠那一路要挑明是转手");
  assert.match(gift, /const arriveTs = hand \? now : now \+ deliverMsForCat\(cat, itemName\)/, "转手的到达时刻就是此刻");
  assert.match(gift, /delivered: !!hand, hand: !!hand/, "聊天里那张卡直接是已送达");
  // 不进在途表：进了的话轮询还会再「送达」一次，卡片和随身物品都会重复
  const handBranch = gift.slice(gift.indexOf("if (hand) {"), gift.indexOf("setGiftOut("));
  assert.ok(handBranch.indexOf("setGiftOut") < 0, "转手这一路不许进在途表");
  assert.match(handBranch, /setCarryGifts\(prev => \{/, "转手要当场存进 TA 的随身物品");
  assert.match(handBranch, /return;/, "转手这一路要就此收住，别掉进下面的下单流程");
  assert.match(gift, /toast\("已转交给 " \+ \(char\.remark \|\| char\.name\) \+ "，东西现在在 Ta 手上"\)/);
});

test("模型那边读到的也是「已经在手上」", () => {
  // 历史里那条礼物按 delivered 分两种说法——转赠落成 delivered:true，它就说对了
  assert.match(app, /m\.delivered \? "（已送到你手上）" : "（外卖\/快递还在路上）"/);
});

// 她同一句：「礼物卡还是差点意思，能不能做个礼物盒之类的」

test("礼物卡改成一个真的盒子：盒身、丝带、吊牌", () => {
  const card = comp.slice(comp.indexOf("function GiftCard("), comp.indexOf("\n// 亲属卡的卡面"));
  assert.equal(card.indexOf('background: "linear-gradient(135deg,#c25a4a,#9a3f37)"'), -1, "那张红渐变卡片该整个删掉");
  assert.match(card, /const KRAFT = "#e6d8bd"/, "盒身是牛皮纸");
  assert.match(card, /const band = extra =>/, "压过盖子的那条丝带");
  // 她 2026-09-03：「礼物盒上这个英文 for u 不要了」——吊牌上只留名字
  assert.equal(card.indexOf("FOR YOU"), -1, "那行英文该删干净");
  assert.equal(card.indexOf("FOR ME"), -1, "那行英文该删干净");
  assert.match(card, /borderRadius: "2px 8px 8px 2px"/, "吊牌还是那张挂在丝带上的小纸片");
  assert.match(card, /position: "absolute", left: RIB_X - 3, top: open \? 4 : 20/, "蝴蝶结跟着盖子一起动");
});

test("到没到不靠换颜色，靠盖子掀没掀", () => {
  const card = comp.slice(comp.indexOf("function GiftCard("), comp.indexOf("\n// 亲属卡的卡面"));
  assert.match(card, /const open = toChar \? !!m\.delivered : false/);
  assert.match(card, /top: open \? 2 : 18/, "送到了盖子要抬起来");
  assert.match(card, /transform: open \? "rotate\(-2\.4deg\)" : "none"/, "而且歪一点，像刚被掀开");
  assert.match(card, /open \? h\("div", \{ style: \{ position: "absolute", left: 6, right: 6, top: 26, height: 8[^}]*background: "#2a2119"/, "掀开后底下要露出一线暗");
  assert.match(card, /m\.hand \? "当面交到 TA 手上"/, "转手那一档有自己的说法");
});

test("名字再长也不许撑破盒子", () => {
  const card = comp.slice(comp.indexOf("function GiftCard("), comp.indexOf("\n// 亲属卡的卡面"));
  assert.match(card, /WebkitLineClamp: 2/);
});
