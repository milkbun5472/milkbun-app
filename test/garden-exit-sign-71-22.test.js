"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");
const html = fs.readFileSync("apps/fairy-garden/index.html", "utf8");
const css = fs.readFileSync("apps/fairy-garden/style.css", "utf8");

// 她 2026-09-18：「萤光林地的入口在哪儿啊」→「做一个入口吧宝宝」
test("口子不在画面里时，屏幕边上有个箭头指路", () => {
  assert.match(html, /<button id="exit-tag" class="exit-tag" hidden><\/button>/);
  assert.match(css, /\.exit-tag\{position:absolute;transform:translate\(-50%,-100%\)/, "和同行者名字牌同一套定位");
  assert.match(css, /\.exit-tag\[hidden\]\{display:none\}/, "display 会把 hidden 压过去（71.05 那次的病）");
  assert.match(game, /function placeExitTag\(panelTop\)\{/);
  // 位置从地图数据来，不在这儿另写一份坐标
  assert.match(game, /spot=map\.stations&&map\.stations\.travel,to=map\.exits&&map\.exits\.travel&&map\.exits\.travel\.to/);
});

// ⚠️点它＝行动栏那颗「前往…」，不另开一条路
test("点它走的还是同一个 travel", () => {
  assert.match(game, /\$\('exit-tag'\)\.onclick=\(\)=>request\('travel'\);/);
  assert.match(game, /const err=actionError\(data,'travel'\);\s*\n\s*tag\.hidden=false;tag\.disabled=!!acting\|\|!!err;/);
});

// ⚠️口子不在画面里就藏起来的话，她问的那句「入口在哪儿」还是没人答
test("口子不在画面里时贴到屏幕边上，箭头指着它", () => {
  assert.match(game, /const cx=Math\.min\(innerWidth-edge,Math\.max\(edge,tx\)\),cy=Math\.min\(maxY,Math\.max\(minY,ty\)\);/);
  assert.match(game, /const arrow=Math\.abs\(tx-cx\)>Math\.abs\(ty-cy\)\?\(tx>cx\?'→':'←'\):\(ty>cy\?'↓':'↑'\);/);
  // ⚠️口子在画面里的时候什么都不放（她 2026-09-18：「我说的入口是建模上的！不是放个大字在那儿！」）
  assert.match(game, /if\(!away\)\{tag\.hidden=true;return;\}/);
  // 让开浮着的标题栏和底下那条行动栏
  assert.match(game, /minY=headClear\+46,maxY=Math\.max\(headClear\+80,panelTop-10\)/);
});

// 第一天正是最需要指路的时候
test("第一天不许把它藏起来", () => {
  assert.doesNotMatch(css, /body\.first-day \.exit-tag/);
  assert.match(css, /body\.chatting \.exit-tag\{display:none\}/, "说话的时候让位");
});
