// ⚠️v68.44 我把「他给你起的称呼」那张卡的三个口子画出来了，
//   **却没把 onTitle 一路递下去**——界面照常渲染，点「收下」什么都不会发生。
//   props 链断了不报错、不红字、不留痕迹，只是「点了没反应」。
//   （病根是我那一轮的替换没加断言，两处静默 no-op；这条测试就是那次的账。）
//
// 所以这儿把整条链钉死：app.js 造 → Us 收 → Gacha 收 → GachaCard 收。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

const usProps = scr.slice(scr.indexOf("function Us({"), scr.indexOf(") {", scr.indexOf("function Us({")));
const gachaCall = scr.slice(scr.indexOf("    return h(Gacha, {"), scr.indexOf("    return h(Gacha, {") + 460);
const gachaSig = scr.slice(scr.indexOf("function Gacha({"), scr.indexOf(") {", scr.indexOf("function Gacha({")));
const cardSig = scr.slice(scr.indexOf("function GachaCard({"), scr.indexOf(") {", scr.indexOf("function GachaCard({")));
// ⚠️别拿 /\{[^)]*\}/ 去抠：props 里本来就有括号（fresh.indexOf(c.id) >= 0），一抠就断
const cardUse = (() => {
  const out = []; let i = -1;
  while ((i = scr.indexOf("h(GachaCard, {", i + 1)) >= 0) out.push(scr.slice(i, i + 420));
  return out;
})();

// 抽卡这一页往下递的每一个回调：app 那头叫什么、卡上叫什么
const CHAIN = [
  ["onGachaPull", "onPull"], ["onGachaRedeem", "onRedeem"], ["onGachaShow", "onShow"],
  ["onGachaPin", "onPin"], ["onGachaTitle", "onTitle"], ["onGachaShoot", "onShoot"]
];

test("app.js 真的造了这几个回调", () => {
  CHAIN.forEach(([outer]) => assert.match(app, new RegExp("\\n    " + outer + ":"), "app.js 没有 " + outer));
});

test("Us 收得到（漏一个就是点了没反应，而且不报错）", () => {
  CHAIN.forEach(([outer]) => assert.ok(usProps.indexOf(outer) >= 0, "Us 的 props 里没有 " + outer));
});

test("Us 往 Gacha 递了，Gacha 也真的收了", () => {
  CHAIN.forEach(([outer, inner]) => {
    assert.match(gachaCall, new RegExp(inner + ": " + outer + "\\b"), "没递：" + inner + " ← " + outer);
    assert.ok(gachaSig.indexOf(inner) >= 0, "Gacha 没收：" + inner);
  });
});

test("Gacha 往每一张卡都递了——两个地方都得递（券夹 + 纪念册）", () => {
  assert.ok(cardUse.length >= 2, "抠不出 GachaCard 的用处");
  ["onRedeem", "onShow", "onTitle", "onShoot"].forEach(k => {
    cardUse.forEach((u, i) => assert.ok(u.indexOf(k + ":") >= 0, "第 " + (i + 1) + " 处 GachaCard 漏了 " + k));
    assert.ok(cardSig.indexOf(k) >= 0, "GachaCard 没收：" + k);
  });
});

test("卡上那几个按钮按下去真有人接", () => {
  // 每一个 onXxx(...) 的调用，都得能在 GachaCard 的签名里找到
  const called = [...scr.slice(scr.indexOf("function GachaCard({"), scr.indexOf("function Gacha({"))
    .matchAll(/\bon(Title|Shoot|Show|Redeem)\s*(?:&&|\()/g)].map(m => "on" + m[1]);
  assert.ok(called.length >= 4, "卡上一个按钮都没接");
  [...new Set(called)].forEach(k => assert.ok(cardSig.indexOf(k) >= 0, k + " 被调用了但没在签名里"));
});
