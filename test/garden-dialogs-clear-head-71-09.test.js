"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const css = fs.readFileSync("apps/fairy-garden/style.css", "utf8");

// 她 2026-09-18：「你把顶部拆掉后实际页面滑太上去了点不到了」
// ⚠️病根：<dialog> 开在 iframe 自己的顶层里，父页面那条浮着的标题栏永远画在它上面，
//   z-index 追不上——所以「让开」这件事只能由游戏这一侧做。
test("游戏里的弹窗自己让开那条浮着的标题栏", () => {
  // ⚠️让开归让开，小窗还要在剩下那块地方的正中（她 2026-09-18：「这个太高了」）：
  //   只压一个 margin-top 的话，所有弹窗都被顶到最上边。
  assert.match(css, /body\.embedded dialog\{position:fixed;left:0;right:0;top:calc\(var\(--head-clear,0px\) \+ 8px\);bottom:8px;margin:auto;/);
  assert.doesNotMatch(css, /body\.embedded dialog\{margin-top:/, "又回到只压 margin-top 那一版了");
  // 整屏那两种铺满剩下那一块
  assert.match(css, /body\.embedded \.companion-dialog,body\.embedded \.season-dialog\{top:var\(--head-clear,0px\);bottom:0;margin:0;height:auto;max-height:none\}/);
  assert.match(css, /z-index 再高也追不上父页面那条栏/, "为什么不能在这儿用 z-index，要写在原地");
});

// ⚠️那个数只有一处：手机那边量出来报进来，游戏这边只读 --head-clear
test("让开多少还是只认 --head-clear 那一个数", () => {
  // 贴着顶边的那几样各让一次：天气、地图那一排、弹窗、整屏那两种
  for (const who of [/\.weather\{top:calc\(10px \+ var\(--head-clear,0px\)\)/,
    /\.map-controls\{top:calc\(65px \+ var\(--head-clear,0px\)\)/,
    /body\.embedded dialog\{[^}]*var\(--head-clear,0px\)/,
    /body\.embedded \.companion-dialog[^}]*var\(--head-clear,0px\)/]) assert.match(css, who);
  assert.doesNotMatch(css, /margin-top:\s*(5[0-9]|1[01][0-9])px/, "又拍了一个固定高度进去");
});
