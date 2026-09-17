"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const game = rd("apps/fairy-garden/game.mjs");
const css = rd("apps/fairy-garden/style.css");
const html = rd("apps/fairy-garden/index.html");

// 她 2026-09-17：「整理一下 ui，放大缩小点击地图那块太占位置了」
test("缩放那一条默认只剩两颗图标", () => {
  for (const id of ["zoom-in", "zoom-out", "zoom-reset"])
    assert.match(html, new RegExp('<button id="' + id + '"[^>]*hidden'), id + " 默认要收起来");
  // 真的缩放过了，那三颗才冒出来——她需要的是【退回去】，不是一直摆着三颗
  assert.match(game, /const off=Math\.abs\(value-1\)>\.02;\$\('zoom-reset'\)\.hidden=!off;/);
  assert.match(game, /\$\('zoom-in'\)\.hidden=!off;\$\('zoom-out'\)\.hidden=!off;/);
  assert.match(game, /双指本来就能缩放/);
});

// 她截图那一版行动面板占了 79% 的画面
test("行动面板不许再占掉大半个庭院", () => {
  assert.match(css, /:root\{--panel-cap:52%\}/);
  assert.match(css, /\.panel\{padding-top:0;max-height:min\(var\(--panel-cap\),calc\(100% - 100px\)\)/);
  assert.doesNotMatch(css, /max-height:calc\(100% - 100px\);display:flex/, "旧的那条没删干净");
});

// codex 每盖好一间屋就多一颗「走进 X」，她那一版已经七颗
test("门多了就收成一颗", () => {
  assert.match(game, /const DOORS_INLINE=3;/);
  assert.match(game, /if\(doors\.length>DOORS_INLINE\)/);
  assert.match(game, /b\.textContent='进屋去… '\+doors\.length\+' 处';/);
  assert.match(game, /function openDoors\(\)/);
  // ⚠️门在场景里本来就走得到，这一颗只是给「懒得找门」留的路
  assert.match(game, /不删路，只是不摊在台面上/);
  // 名单只有一处：openDoors 和 fillDoors 都问 doorsOf()
  assert.equal((game.match(/doorsOf\(\)/g) || []).length, 2, "openDoors 和 fillDoors 都问同一张名单");
});

// ⚠️百分比也不行：它的包含块不是整屏
test("那条提示按面板此刻的上沿摆，只有一处算位置", () => {
  assert.match(game, /hint\.style\.bottom=\(innerHeight-panel\.getBoundingClientRect\(\)\.top\+10\)\+'px'/);
  assert.match(game, /它的包含块不是整屏/);
  assert.match(css, /\.hint\{position:fixed;left:50%/);
  assert.doesNotMatch(css, /\.hint\{bottom:352px\}/, "后写的那条会压过前面，两处写同一个位置本来就是错的");
  assert.equal((css.match(/\.hint\{bottom:/g) || []).length, 0, "位置只许 JS 那一处算");
});
