"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const css = fs.readFileSync("apps/fairy-garden/style.css", "utf8");

// 她 2026-09-18：「你把顶部拆掉后实际页面滑太上去了点不到了」
// ⚠️病根：<dialog> 开在 iframe 自己的顶层里，父页面那条浮着的标题栏永远画在它上面，
//   z-index 追不上——所以「让开」这件事只能由游戏这一侧做。
test("游戏里的弹窗自己让开那条浮着的标题栏", () => {
  assert.match(css, /body\.embedded dialog\{margin-top:calc\(var\(--head-clear,0px\) \+ 8px\);max-height:calc\(100dvh - var\(--head-clear,0px\) - 16px\)\}/);
  // 整屏那两种要连高度一起减，不然底下会被顶出屏幕
  assert.match(css, /body\.embedded \.companion-dialog,body\.embedded \.season-dialog\{margin-top:var\(--head-clear,0px\);height:calc\(100% - var\(--head-clear,0px\)\);max-height:none\}/);
  assert.match(css, /z-index 再高也追不上父页面那条栏/, "为什么不能在这儿用 z-index，要写在原地");
});

// ⚠️那个数只有一处：手机那边量出来报进来，游戏这边只读 --head-clear
test("让开多少还是只认 --head-clear 那一个数", () => {
  assert.ok((css.match(/var\(--head-clear,0px\)/g) || []).length >= 6);
  assert.doesNotMatch(css, /margin-top:\s*(5[0-9]|1[01][0-9])px/, "又拍了一个固定高度进去");
});
