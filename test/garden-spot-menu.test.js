"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const game = rd("apps/fairy-garden/game.mjs");
const html = rd("apps/fairy-garden/index.html");
const css = rd("apps/fairy-garden/style.css");

// 她 2026-09-17：「点击交互的家具物件就能弹出选择做啥，而不是在那一堆行动里面」
test("点一件东西弹出这儿能做的那几件", () => {
  assert.match(html, /id="spot-dialog"/);
  assert.match(game, /const SPOT_BUTTONS=\{/);
  assert.match(game, /const key=spotKeyOf\(hit\);if\(key&&openSpot\(key\)\)return;/, "要排在原来那条默认动作之前");
  // 井、花圃、锅、星铃、月潭：每一处都不止一件事可做
  for (const k of ["well", "garden", "brew", "star", "pond"]) {
    assert.match(game, new RegExp("\\b" + k + ":\\['"), k + " 那一处没有条目");
  }
});

// ⚠️条目就是行动栏里那几颗真按钮本身：名字、能不能点、点了做什么都在 ui() 那一处算好了
test("菜单不另写一份文案和判断", () => {
  const fn = game.slice(game.indexOf("function openSpot(key)"), game.indexOf("$('spot-close')"));
  assert.match(fn, /const b=src\.cloneNode\(true\)/, "连内部结构一起搬，两行小字才不会挤成一行");
  assert.match(fn, /b\.disabled=src\.disabled/);
  assert.match(fn, /src\.click\(\)/, "点了要走原来那颗按钮的路，不另写一份行为");
  assert.doesNotMatch(fn, /request\(|perform\(|go\(/, "这儿一旦自己发动作，就是同一层活在两处");
});

// ⚠️只有一件事可做时不弹：为一颗按钮再让她点一下，是白让她多点一下
test("只有一件事可做就直接做，不弹", () => {
  assert.match(game, /if\(live\.length<2\)return false;/);
  assert.match(game, /只有一件事可做时不弹/);
});

// 收进「这会儿做不了的」那一格的按钮照样要列出来——她得看见还有这么一件事、以及为什么
test("做不了的那几件也列出来，灰着但看得见", () => {
  const fn = game.slice(game.indexOf("function openSpot(key)"), game.indexOf("$('spot-close')"));
  assert.match(fn, /filter\(b=>b&&!b\.hidden\)/, "只看 hidden，不看它这会儿摆在哪儿");
  assert.match(css, /#spot-list>button small\{display:block/, "两行小字要能断开");
});
