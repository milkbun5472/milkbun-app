// 她 2026-09-13 带截图报：线下那一屏「发送键它不是在屏幕最下面，下面有一层空白」，
// 顺带说「看别人的手机上底下也是」。要求写得很清楚：**别动她给 iPhone 16 调好的那套适配**。
//
// 两处各有各的病，都不在 100vh 和安全区那套上：
//   ① 线下那条输入栏比主聊天多挂了一个 marginBottom: kbLift。那个值是
//      innerHeight - visualViewport.height - offsetTop，而 iOS 上让它非零的**不只有键盘**
//      （安全区、取整、地址栏残留都会留下几十像素）。差多少顶多少，输入栏就永远浮在
//      离底一截的地方——主聊天那条压根不用这个 hook，所以那两屏一眼就不一样。
//   ② 查手机里微信那条 tab 栏吃的是【整条】底部安全区，而全库的规矩是只吃 0.4
//      （施工规则/mobile-ui-layout.md §2）。多吃的那一截就是图标底下那条空白。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const phone = fs.readFileSync(path.join(root, "js/phone.js"), "utf8");

// 真跑这个 hook：假的 useState/useEffect + 假的 visualViewport
const mkLift = () => {
  const i = comp.indexOf("const KB_MIN_PX = 120;");
  const j = comp.indexOf("// 全 App 共用的确认入口");
  assert.ok(i > 0 && j > i, "抠不出 useKbLift");
  const box = { v: 0 };
  const listeners = {};
  const win = {
    innerHeight: 874,
    visualViewport: {
      height: 874, offsetTop: 0,
      addEventListener: (k, fn) => { (listeners[k] = listeners[k] || []).push(fn); },
      removeEventListener: () => {}
    }
  };
  const useState = init => [typeof init === "function" ? init() : init, v => { box.v = v; }];
  const useEffect = fn => { fn(); };
  const useKbLift = new Function("useState", "useEffect", "window", comp.slice(i, j) + "\nreturn useKbLift;")(useState, useEffect, win);
  useKbLift();
  return { box, win, fire: () => (listeners.resize || []).forEach(fn => fn()) };
};

test("键盘没弹：剩下那几十像素一律当没有，输入栏贴着底", () => {
  const m = mkLift();
  assert.equal(m.box.v, 0, "一上来就顶起来了");
  // iOS 上常见的那点残差（安全区/取整）：34、这类数字都不是键盘
  [1, 12, 34, 60, 119].forEach(px => {
    m.win.visualViewport.height = 874 - px;
    m.fire();
    assert.equal(m.box.v, 0, px + "px 被当成键盘了——输入栏会永远浮在离底 " + px + "px 的地方");
  });
});

test("键盘真弹起来：该顶多少顶多少，一个像素不打折", () => {
  const m = mkLift();
  [216, 291, 336, 420].forEach(px => {
    m.win.visualViewport.height = 874 - px;
    m.fire();
    assert.equal(m.box.v, px, "真键盘弹起来却没顶够，输入栏会被键盘压住");
  });
  // 收起来就还回去
  m.win.visualViewport.height = 874;
  m.fire();
  assert.equal(m.box.v, 0);
});

test("地板写死在一处，而且只管「算不算键盘」这一件事", () => {
  assert.match(comp, /const KB_MIN_PX = 120;/);
  assert.match(comp, /setLift\(raw > KB_MIN_PX \? raw : 0\);/);
  // ⚠️她点名不许动的那套：100vh 和安全区常量，一个字都没碰
  assert.match(comp, /const raw = Math\.round\(window\.innerHeight - vv\.height - vv\.offsetTop\);/);
  const i = comp.indexOf("const KB_MIN_PX");
  const seg = comp.slice(i, i + 600);
  assert.ok(!/100vh|safe-area-inset/.test(seg), "这个 hook 里居然动了视口或安全区");
});

test("查手机那条 tab 栏回到只吃 0.4 条安全区", () => {
  assert.match(phone, /minHeight: 61, paddingBottom: "calc\(env\(safe-area-inset-bottom\) \* 0\.4\)"/);
  // 全库只剩内容区的 padding 还用整条，底栏一处都不许（施工规则/mobile-ui-layout.md §2）
  const bars = (phone.match(/paddingBottom: "env\(safe-area-inset-bottom\)"/g) || []);
  assert.deepEqual(bars, [], "查手机里还有底栏在吃整条安全区");
});
