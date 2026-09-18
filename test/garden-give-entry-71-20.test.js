"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");
const html = fs.readFileSync("apps/fairy-garden/index.html", "utf8");

// 她 2026-09-18：「怎么把手上的东西给他啊」——她会先在【他这一页】上找
test("他那一页上就有一颗递东西，但不另开一条路", () => {
  assert.match(html, /<button id="companion-give" hidden>/);
  assert.match(game, /\$\('companion-give'\)\.onclick=\(\)=>\{\$\('companion-dialog'\)\.close\(\);\$\('give-flower'\)\.click\(\);\};/,
    "点下去就是行动栏那颗：挑什么、递不递得出去仍旧只有那一处说了算");
  // 条件和行动栏那颗同一个：他得在同一张图上
  assert.match(game, /\$\('companion-give'\)\.hidden=!near;/);
  assert.match(game, /const near=data\.map===data\.companion\.map,gate=giftGate\(\);/);
});

// ⚠️递不出去的时候不许做成死按钮：她看不见 title，只会以为这东西坏了
test("递不出去就把原因写在按钮上，不是灰着不动", () => {
  assert.match(game, /\$\('companion-give'\)\.textContent=gate\|\|\('递一样东西给'\+c\.name\)/);
  assert.match(game, /\$\('give-flower'\)\.disabled=!!acting;/);
  assert.doesNotMatch(game, /\$\('give-flower'\)\.disabled=!!acting\|\|!!giftGate\(\)/, "又灰回去了");
  assert.match(game, /const gate=giftGate\(\);if\(gate&&!giftOptions\(data\)\.length\)\{say\(gate\);return;\}openGift\(\);/,
    "点下去要说得出为什么，而不是一按没反应");
});

// 她 2026-09-18：「送了礼物在哪儿看礼物簿啊宝宝，花册没有啊」
// ⚠️礼物簿就住在花册的「相处」那一页里；签上只写「相处」，所以要在【她正要递的那一刻】
//   和【村里的规矩】那张卡上都说清楚它在哪儿。签本身不能改成四个字：
//   七张竖签排下来会长出屏幕（test/garden-rail-vertical-71-24.test.js 钉着这条）。
test("礼物簿在哪儿这件事，两处都说得出口", () => {
  const world = fs.readFileSync("apps/fairy-garden/world.mjs", "utf8");
  assert.match(game, /递过的都记在花册的「相处」那一页。/, "挑东西那一页要说清楚记去哪儿了");
  assert.match(world, /礼物簿在手机那一册的「相处」里，和相处册同一页。/, "规矩那张卡上也要说");
});
