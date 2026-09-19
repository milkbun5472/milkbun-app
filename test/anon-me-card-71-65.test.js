// 她 2026-09-19：「然后匿名信箱我的也跟角色的一起放吧。然后再想想咋弄题目」
//
// 原来她的马甲只藏在【进了某个角色之后】那一屏里。可匿名问答那一页的意思是
// 「每个人的匿名主页」——她也是这里面的一个人，不该只能从别人家门口看到自己。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), comp = P("js/components.js"), core = P("js/core.js");

const hub = () => {
  const i = comp.indexOf("function AnonHub({"), j = comp.indexOf("function AnonMeBox({", i);
  assert.ok(i > 0 && j > i, "抠不出 AnonHub");
  return comp.slice(i, j);
};

test("她那张卡跟角色的在同一张九宫格里，不是另起一格", () => {
  const seg = hub();
  assert.equal((seg.match(/className: "grid grid-cols-2 gap-3"/g) || []).length, 1,
    "又拆成两张网格了——那一页会变成两种卡拼起来的");
  assert.ok(seg.indexOf("onClick: onOpenMe") < seg.indexOf("rows.map(function (row)"), "她那张不在第一格");
});

// 同一种东西＝同一种卡面：她那张和角色那张的骨架必须一样
test("她那张和角色那张长一样，只有眉标不同", () => {
  const seg = hub();
  ["minHeight: 174", "borderRadius: 18", "height: 58, flexShrink: 0", "则问答"].forEach(k =>
    assert.equal((seg.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 2,
      "两张卡的骨架对不上了：" + k));
});

test("马甲用的是同一张面具，没另立一个身份", () => {
  assert.ok(app.includes("myMask: anonMe,\n    myBox: anonMeBox,"), "hub 没拿到她的马甲");
  assert.ok(app.includes("onGenMask: genAnonMe,\n    onOpenMe:"), "生成马甲走的不是原来那一支");
  // 全库仍旧只有 x_anonMe 这一个马甲
  assert.equal((app.match(/x_anonMe"/g) || []).length, 2, "又多出一处马甲存档");
});

test("点开她那张卡有落点，不是点了没反应", () => {
  assert.ok(app.includes('onOpenMe: () => setScreen("anonme")'), "点了没地方去");
  assert.ok(app.includes('screen === "anonme") body = h(AnonMeBox'), "那一屏没接上");
  assert.ok(comp.includes("function AnonMeBox({ mask, box, busy, characters, onGenMask, onAsk, onAnswer, onReveal, onDrop, onBack })"), "那一屏没画");
  assert.ok(core.includes('anonme: "我的匿名主页"'), "页名没登记——主题工作台和返回栏都认不出它");
});

// v71.67 那条路做完了（她「匿名可以按你说的来试试」），所以空页不再是「还没做」，
// 而是「还没人问过你」——得顺手告诉她下一步点哪儿。
test("箱子空着要说清为什么空", () => {
  const i = comp.indexOf("function AnonMeBox({"), j = comp.indexOf("// 匿名箱：仿 QQ 主页", i);
  const seg = comp.slice(i, j);
  assert.ok(seg.includes("还没有人问过你"), "空页一个字都没有");
  assert.ok(seg.includes("点上面那颗，让谁来问你一句"), "空页没告诉她下一步点哪儿");
  // 她这屏【不该】有「匿名问 Ta 一句」——往她箱子里投问题的是角色，不是她自己
  // 那一屏有一句「跟你匿名问别人时用的是同一张面具」，是说明不是按钮——所以认动作
  // ⚠️v71.67 这屏有了 onAsk（他来问她）——那是【反方向】的，不能连它一起禁。
  //   要禁的仍是「她去匿名问别人」那颗：那是角色那屏的东西。
  assert.ok(!/onOpenBox|匿名问 Ta|问 Ta 一句/.test(seg), "她自己这屏冒出了「匿名问 Ta」——那是角色那屏的东西");
  assert.ok(/onAsk/.test(seg), "他来问她那一路没了");
});

test("存档立起来了，而且坏了读不回也不炸", () => {
  assert.ok(app.includes('localStorage.getItem("x_anonMeBox")'), "她那一箱没有存档");
  assert.ok(/catch \(e\) \{ return \{ records: \[\] \}; \}/.test(app), "存档坏了会整页炸");
});
