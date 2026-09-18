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
