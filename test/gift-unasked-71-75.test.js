// 她 2026-09-19 转小红书群里读者那段：「你就很挂念他嘛，然后这个意思其实言外之意
//   就是期待你的角色给你送礼物，然后他自己就会触发，赶紧就送了个项链给你」
//
// 查下来这件事几乎不会自己发生，而且是我们写的：gift 那条能力通篇只管
// 【你说了就得真做】——那是一道防他放空炮的闸；「她话里有话、你自己想给她买点
// 什么」这一档一个字都没有，末尾那句「别频繁乱送」还在往回拉。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");

const gift = () => {
  const i = app.indexOf('capState.push("gift：'), j = app.indexOf("if (kinHint) {", i);
  assert.ok(i > 0 && j > i, "抠不出 gift 那段说明");
  return app.slice(i, j);
};

test("明说她没开口要也可以送", () => {
  const seg = gift();
  assert.ok(seg.includes("她没开口要，你也可以自己给"), "这一档还是没有——他只会在自己先说了要买的时候才送");
  assert.ok(seg.includes("不用等她说出口"), "没给出口，那句「别频繁乱送」会一直往回拉");
  // 原来那道闸不许丢：说了不做＝放空炮
  assert.ok(seg.includes("只嘴上说不填"), "防放空炮那一道被顺手删了");
});

// ⚠️写成「她说想你就送」＝换谁都成立，而且把她的话降级成一张兑奖券
test("给的是判据，不是触发词", () => {
  const seg = gift();
  assert.ok(seg.includes("这一下是你想给她，还是你在处理她那句话？"), "没给判据");
  assert.ok(!/说想你|说累了|一抱怨就/.test(seg.replace(/\/\/[^\n]*/g, "")), "写进了具体的触发话术——那就成了兑奖券");
  // 反面也要写出来，不然它会把「主动送」读成「多送」
  assert.ok(seg.includes("还是那个三件套，只是这回用的是钱包"), "没说清哪一种不行");
});

// ⚠️prompt-no-content-samples：写了项链耳环，十个角色就都送这三样
test("不写送什么", () => {
  const seg = gift().replace(/\/\/[^\n]*/g, "");   // 注释里点名过这几样，说的是「不许写」
  ["项链", "耳环", "口红", "花束", "围巾"].forEach(x =>
    assert.ok(!seg.includes(x), "写进了具体送什么：" + x));
  assert.ok(gift().includes("送什么由【你是谁】和【你知道她喜欢什么】定"), "没说清送什么该从哪儿长出来");
});

// ⚠️禁的是模子不是尺度：不爱买东西的人、手头紧的人，不送才是对的
test("不送也是答案", () => {
  const seg = gift();
  assert.ok(seg.includes("不送也是答案"), "没给「不送」留位子——所有角色都会变成爱送东西的人");
  assert.ok(seg.includes("会真的从你钱包里扣掉"), "真扣钱那句不许丢，不然他会乱送");
});
