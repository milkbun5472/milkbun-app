// 她 2026-09-10：「送礼物能不能选择发到群然后再选群里面的某位，想看大家看到礼物的反应」。
//
// 三件事得同时成立，少一件她就看不到她要的东西：
//  ① 挑人这一屏能挑到群，挑了群还要再挑【群里的哪一位】——礼物永远是送给一个人的；
//  ② 那张礼物盒摆在群里（不是私聊里），而且写着送给谁；
//  ③ 群里其他人当场有反应——这是她这句话真正要的东西。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js"), scr = R("js/screens.js");

test("挑人那一屏：选了群不是送给群，是换一屏挑群里的谁", () => {
  const sheet = scr.slice(scr.indexOf('} else if (sheet === "gift") {'), scr.indexOf('} else if (sheet === "paylater") {'));
  // 群那一行点下去只换屏，绝不许直接结算
  assert.match(sheet, /onClick: \(\) => setSheet\(\{ kind: "giftgroup", id: g\.id \}\)/, "点群就直接送出去了——那就没得挑人");
  assert.ok(!/type: "group", id: g\.id \}\)/.test(sheet), "群那一行还在直接 onCheckout");
  // 第二屏只列这个群的成员，选中才带着 toId 结算
  const two = scr.slice(scr.indexOf('} else if (sheet && sheet.kind === "giftgroup") {'), scr.indexOf('} else if (sheet === "paylater") {'));
  assert.match(two, /\(\(grp && grp\.memberIds\) \|\| \[\]\)\.map\(id => \(characters \|\| \[\]\)\.find\(c => c\.id === id\)\)\.filter\(Boolean\)/, "没按这个群的成员来列");
  assert.match(two, /onCheckout\(sel, "gift", \{ type: "group", id: gid, toId: c\.id \}\)/, "结算没带上收礼的是谁");
  assert.match(two, /这个群里还没有成员/, "空群没有兜底，点进去是一片白");
});

test("结算这一头：收礼人只认一次，反应只要一次", () => {
  const ck = app.slice(app.indexOf('} else if (mode === "gift") {'), app.indexOf('} else if (mode === "paylater") {'));
  assert.match(ck, /const toId = target && \(inGroup \? target\.toId : target\.type === "char" \? target\.id : null\);/, "收礼人不是一处算出来的");
  assert.match(ck, /if \(!toId\) \{ toast\(inGroup \? "请选择送给群里的谁" : "请选择送礼对象"\); return; \}/, "没挑人也放行了");
  assert.match(ck, /items\.forEach\(it => sendGiftToChar\(toId, it\.name, it\.cat, false, inGroup \? target\.id : null\)\)/, "群那一路没把群 id 传下去");
  // ⚠️一次结算可能好几件东西：一件调一次模型＝把她的钱按件数翻倍
  assert.ok(ck.indexOf("items.forEach") < ck.indexOf("reactGroupGift"), "反应挂在 forEach 里了");
  assert.match(ck, /if \(inGroup\) setTimeout\(\(\) => reactGroupGift\(target\.id, toId, items\.map\(x => x\.name\)\), 1400\);/);
  assert.equal((app.match(/reactGroupGift\(/g) || []).length, 1, "反应不止一个调用点");
  // 钱照旧从她钱包里扣，跟私聊送礼共用同一行
  assert.match(ck, /changeWallet\(-total, "送礼 "/, "群里送礼不扣钱了");
});

test("群里送＝当面递过去：不走快递，东西照旧记在收礼那个人名下", () => {
  const gift = app.slice(app.indexOf("const sendGiftToChar = (charId, itemName, cat, hand"), app.indexOf("\n  // 礼物送达后"));
  assert.match(gift, /const inGroup = !!groupId;/);
  assert.match(gift, /const handNow = !!hand \|\| inGroup;/, "群里送还在跑快递倒计时");
  // 卡摆在群里，且写明送给谁；私聊那张一个字没改
  assert.match(gift, /if \(inGroup\) pushGroupRich\(groupId, \{ \.\.\.card, toId: charId, toName: toName,/, "卡没摆进群里");
  assert.match(gift, /else pChat\(charId, p => \[\.\.\.p, \{ \.\.\.card, content: "\[礼物\] " \+ \(handNow \? "当面给你：" : "送给你："\) \+ itemName \}\]\);/, "私聊那张被改坏了");
  // 归属：carryGifts 落在收礼那个人名下（giftLog / 随身物品全靠它接上）
  const hand = gift.slice(gift.indexOf("if (handNow) {"), gift.indexOf("setGiftOut("));
  assert.match(hand, /\[charId\]: \[\{ id: giftId, name: itemName, receivedTs: now \}/, "东西没记在收礼那个人名下");
  assert.ok(hand.indexOf("groupId") < 0, "随身物品按群存了——那就没人拥有它");
});

test("模型读到的那一行说清了「只送给一个人」", () => {
  // ⚠️不加这一支的话，群历史里只剩 content 那句原话，读起来「给你」是给谁说不清
  const line = app.slice(app.indexOf("const groupHistLine = m =>"), app.indexOf("\n  // ---- 群里每位成员那一段"));
  assert.match(line, /m\.kind === "gift" \? "\[当着全群的面，把「" \+ \(\(m\.item && m\.item\.name\) \|\| m\.name \|\| "一件东西"\) \+ "」送给了" \+ \(m\.toName \|\| "群里某位"\)/);
  assert.match(line, /只送给 Ta 一个人，别人没有；东西现在就在 Ta 手上/, "没说死只有一个人有——群发是这一档最容易塌的方向");
});

test("反应这一次调用：收礼人单开一个字段，别人认不出名字就丢掉", () => {
  const fn = app.slice(app.indexOf("const reactGroupGift = async"), app.indexOf("\n  // 送的东西值多少钱"));
  // 收礼那位的反应不跟别人挤在 say 里：挤在一起就得靠名字去认，漏了他这次钱就白花
  assert.match(fn, /\{\\"toSay\\":\[\\"气泡1\\"\],\\"say\\"/, "收礼人的反应没单开字段");
  assert.match(fn, /pushGroupRich\(groupId, \{ role: "char", senderId: to\.id, senderName: to\.name, content: toWords\[i\] \}\)/, "收礼人那几句没落到他名下");
  assert.ok(fn.indexOf("toWords") < fn.indexOf("const say ="), "别人的话排在收礼人前面了");
  // ⚠️认不出名字就丢掉，绝不许像代付那样退到 members[0]——退错人整段戏就演反了
  assert.match(fn, /if \(!spk \|\| !txt\) continue;/, "认不出说话人还硬塞");
  assert.ok(fn.indexOf("|| members[0]") < 0, "又退回 members[0] 了");
  assert.match(fn, /const spk = members\.find\(m => m\.name === nm \|\| \(m\.remark \|\| ""\) === nm\);/);
  // 塌向群发是这一档最大的风险，提示词和落地都得挡
  assert.match(fn, /只送给 Ta 一个人，在场其他人都没有/);
  assert.match(fn, /绝不许让别人也收到礼物、也绝不许当成群发/);
  assert.match(fn, /不必每个人都开口/, "不挡的话每个人都会硬凑一句");
  assert.match(fn, /bumpAff\(toId, d\.affinityDelta\)/, "收了礼好感不动");
});

test("群里那张礼物盒复用单聊那一只，顶上写着送给谁", () => {
  // ⚠️切到【下一支】为止，别按字节数切（那是本仓库最常见的假红）；
  //   右边界要从 gift 那儿往后找——transfer 这一支单聊里也有一个，在前面。
  const gi = comp.indexOf('if (m.kind === "gift") return h("div", {');
  const seg = comp.slice(gi, comp.indexOf('if (m.kind === "transfer") return h("div", {', gi));
  assert.ok(seg.length > 0, "群里根本没接礼物这一支");
  assert.match(seg, /"送给 " \+ m\.toName/, "群里看不出这份礼物是给谁的");
  assert.match(seg, /h\(GiftCard, \{/, "群里另画了一张卡——那就跟单聊那只盒子走散了");
  // ⚠️GroupThread 里没有 now 这个变量，传下去是直接 ReferenceError
  assert.ok(seg.indexOf("now: now") < 0, "传了群里根本不存在的 now");
});

// 顺手修的：giftLog 那两行标签一直是反的
test("礼物往来那两行别说反：carryGifts 是【他收到的】", () => {
  const seg = app.slice(app.indexOf("    giftLog: (() => {"), app.indexOf("    // 她想要什么。"));
  assert.match(seg, /const given = \(carryGiftsRef\.current\[char\.id\] \|\| \[\]\)/);
  assert.match(seg, /if \(given\.length\) parts\.push\("用户送给你过："/, "他收到的东西还写着是他送出去的");
  assert.match(seg, /if \(got\.length\) parts\.push\("你送给用户过："/);
});
