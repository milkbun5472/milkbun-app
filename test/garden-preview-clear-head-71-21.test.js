"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");

// 她 2026-09-18：「这个也太高了宝宝」——样貌那一页的小人站在最上面，头被浮着的标题栏压住
test("换样貌那条预览也让开浮着的标题栏", () => {
  assert.match(game, /let headClear=0;/);
  assert.match(game, /headClear=n;document\.documentElement\.style\.setProperty\('--head-clear',n\+'px'\)/,
    "报进来的那个数要留下，画预览时用的就是它");
  assert.match(game, /const clear=Math\.max\(0,Math\.min\(headClear,innerHeight\*PREVIEW_BAND-60\)\);/,
    "⚠️再怎么让也要给小人留一条：夹住，不许把这条窗让没了");
  assert.match(game, /h=Math\.max\(1,Math\.round\(innerHeight\*PREVIEW_BAND-clear\)\),y=Math\.max\(0,innerHeight-h-clear\)/);
});
