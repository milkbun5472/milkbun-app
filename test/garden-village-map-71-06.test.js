"use strict";
// 村子平面图（她 2026-09-18：「地图这里略丑，做好看一点，也可以放大缩小，做平面板的地图」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const game = rd("apps/fairy-garden/game.mjs");
const html = rd("apps/fairy-garden/index.html");
const css = rd("apps/fairy-garden/style.css");
const mapSrc = rd("apps/fairy-garden/village-map.mjs");
const M = () => import("../apps/fairy-garden/village-map.mjs");
const W = () => import("../apps/fairy-garden/world.mjs");

test("平面图画的全是 rules 里本来就有的几何：湖、溪、屋子脚印、摊子、桥、树、小路、铁轨；一个坐标都不另抄", async () => {
  const m = await M(), w = await W();
  const plan = m.villagePlan();
  assert.ok(plan.box.w > 400 && plan.box.h > 500, "整个村子都在图上（含北林、车站、水磨坊）");
  for (const cls of ["land", "woods", "water", "land island", "creek", "rail", "wood", "stone", "roof", "house", "wheel", "tower", "stall", "bed", "tree", "lamp", "path"])
    assert.ok(plan.open.includes('class="' + cls + '"'), cls);
  assert.equal((plan.open.match(/class="house"/g) || []).length, Object.values(w.MAPS.garden.architecture).reduce((n, b) => n + b.parts.length, 0) + w.MAPS.garden.watermill.parts.length + 1, "屋子脚印＝architecture 各部件＋水磨坊＋车站售票亭");
  assert.equal((plan.open.match(/class="stall"/g) || []).length, w.MAPS.garden.market.stalls.length);
  assert.ok((plan.open.match(/class="tree"/g) || []).length > 100, "树是障碍物表里那些圆");
  assert.doesNotMatch(mapSrc, /\{x:-?\d+(\.\d+)?,z:-?\d+(\.\d+)?\}/, "不另抄坐标");
  // 坐标映射同一份：openMap 标点用的就是 plan.at
  const at = plan.at(w.MAPS.garden.sites.home.target);
  assert.ok(Number(at.x) > 0 && Number(at.y) > 0);
  assert.match(game, /const plan=villagePlan\(\),esc=/); assert.match(game, /const at=plan\.at;/); assert.match(game, /let svg=plan\.open;/); assert.match(game, /svg\+=plan\.close;/);
  assert.match(game, /\$\('map-view'\)\.innerHTML=svg;/);
});

test("放大缩小：手指捏、滚轮、三颗按钮；开图先把她放到中间；拖过不算点，点一处仍旧是带路", async () => {
  assert.match(mapSrc, /export function installMapZoom\(plan,view,buttons=\{\}\)/);
  assert.match(mapSrc, /const MIN=1,MAX=4;/);
  assert.match(mapSrc, /plan\.addEventListener\('wheel'/); assert.match(mapSrc, /pinch=\{d:Math\.hypot\(a\.x-b\.x,a\.y-b\.y\),scale\};/);
  assert.match(mapSrc, /if\(!drag&&Math\.hypot\(dx,dy\)>8\)drag=true;/);
  assert.match(mapSrc, /plan\.dispatchEvent\(new CustomEvent\('maptap',\{detail:\{hit\}\}\)\)/, "抬手没拖过才算点");
  assert.match(game, /const mapZoom=installMapZoom\(\$\('map-plan'\),\$\('map-view'\),\{zoomIn:\$\('map-zoom-in'\),zoomOut:\$\('map-zoom-out'\),reset:\$\('map-zoom-reset'\)\}\);/);
  assert.match(game, /mapZoom\.focus\(ox\+Number\(me\.x\)\*k,oy\+Number\(me\.y\)\*k,2\);\}else mapZoom\.reset\(\);/);
  assert.match(game, /\$\('map-plan'\)\.addEventListener\('maptap',e=>\{\n const hit=e\.detail&&e\.detail\.hit;if\(!hit\)return;/);
  assert.match(html, /<div id="map-plan"><div id="map-view"><\/div><div class="map-zoom"><button id="map-zoom-in"/);
  assert.match(css, /#map-plan\{position:relative;display:block;margin:4px 0 10px;height:min\(62vh,560px\)/);
  assert.match(css, /#map-view\{display:block;margin:0;width:100%;height:100%;transform-origin:0 0/);
  assert.match(css, /touch-action:none/);
});

test("v70.81 合并时第一行 import 丢了 main 加的四个名字（NEIGHBOR_REACH 那一批）：refreshLeisure 每帧报错——钉住", () => {
  const first = game.split("\n")[0];
  for (const n of ["NEIGHBOR_REACH", "neighborTalkError", "neighborView", "noteNeighborTalk"]) assert.ok(first.includes(n), n + " 要在 game.mjs 第一行 import 里");
  // 每个 import 的名字不重复（那次修复第一版把 world.mjs 的几行 import 合成了一行，全是重复声明）
  const seen = new Set();
  for (const line of game.split("\n").filter(l => l.startsWith("import {"))){
    for (const n of line.slice(8, line.indexOf("}")).split(",").map(x => x.trim()).filter(Boolean)){ assert.ok(!seen.has(n), "重复 import：" + n); seen.add(n); }
  }
});
