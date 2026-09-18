"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const host = fs.readFileSync("js/fairy-garden.js", "utf8");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");
const css = fs.readFileSync("apps/fairy-garden/style.css", "utf8");

// 她 2026-09-18：「上面又有框，不要做这个框挡住场景了宝宝」
// ⚠️这是对 施工规则/mobile-ui-layout.md「顶栏自己占一条」的一处【明写例外】：
//   庭院整屏是一张 3D 画布，横一条实心栏就是把画剪掉一截。栏还是那条 Head，只是不占位。
test("庭院那条顶栏浮在场景上面，画面从屏幕最上边就开始", () => {
  assert.match(host, /position: "absolute", left: 0, right: 0, top: 0, zIndex: 5,\s*\n\s*background: "linear-gradient\(180deg, rgba\(228,233,215,\.92\)/);
  assert.match(host, /ref: headRef/);
  assert.match(host, /这是对 施工规则\/mobile-ui-layout\.md/, "破一次铁律就要在原地写明白为什么");
  // 还是那条公共 Head，没有自己再造一条
  assert.match(host, /h\(Head, \{ zh: "微光庭院", sub: char \?/);
});

test("那条栏多高是量出来的，不是写死一个数", () => {
  assert.match(host, /const set = \(\) => setHeadH\(Math\.round\(el\.getBoundingClientRect\(\)\.height\)\);/);
  assert.match(host, /new ResizeObserver\(set\)/);
  assert.match(host, /if \(loaded && g && g\.setHeadClear\) g\.setHeadClear\(headH\)/);
});

// ⚠️贴着顶边的那几样要让开这条栏，而这个数只许有一处
test("游戏那头只认 --head-clear 这一个变量", () => {
  assert.match(game, /setHeadClear:px=>\{/);
  assert.match(game, /setProperty\('--head-clear',n\+'px'\)/);
  const users = (css.match(/var\(--head-clear,0px\)/g) || []).length;
  assert.ok(users >= 3, "天气、地图控件、季节手册三处都要让开，现在只有 " + users + " 处");
  assert.doesNotMatch(css, /--head-clear\s*:\s*\d/, "CSS 里又写死了一个数，那就是两处各一份");
});

// 整页盖上来的册子要自己让开那条浮着的栏
test("花册不压在顶栏底下", () => {
  assert.match(host, /position: "absolute", inset: 0, paddingTop: headH, background: "#e9ecdd"/);
});
