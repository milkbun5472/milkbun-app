"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const comp = fs.readFileSync("apps/fairy-garden/companion.mjs", "utf8");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");
const html = fs.readFileSync("apps/fairy-garden/index.html", "utf8");

// 她 2026-09-17 截图：「他这个行动都不会干别的」
test("没排过这一季的日子，每天也不一样", () => {
  assert.match(comp, /const FLOOR_POOL=\[/);
  assert.match(comp, /const floorDay=s=>/);
  assert.match(comp, /pickFloor\(String\(s\.epoch\)\+':floor:'\+s\.day,3\)/, "挑哪几处只看今天是第几天");
  assert.doesNotMatch(comp, /const FALLBACK=/, "钉死那四格已经退役了");
});

// ⚠️这仍旧是地板，不是他的性格
test("地板不许假装成他的性格", () => {
  assert.match(comp, /这仍旧是【地板】，不是他的性格/);
  assert.match(comp, /真正照着他的人设排的那一份/);
  assert.doesNotMatch(comp, /gardener|explorer|scholar/);
  // 那件杂活是钉子，而且不进抽签池（抽进去会排两遍）
  assert.match(comp, /\[420,'home'\],\[480,'flowers'\]/);
  assert.doesNotMatch(comp, /FLOOR_POOL=\[[^\]]*'flowers'/);
});

// 连着三行「在屋檐下听雨」看着像坏了
test("挨着的重复格并成一格", () => {
  assert.match(comp, /\.filter\(\(item,i,all\)=>i===0\|\|all\[i-1\]\.id!==item\.id\)/);
  assert.match(comp, /连着三行「在屋檐下听雨」看着像坏了/);
});

// 真正照着人设排的那一份在季节手册里，而这一页从来没说过
test("这一页要说清楚这是地板，并且给一颗直接过去的按钮", () => {
  assert.match(html, /id="companion-plan-note"/);
  assert.match(html, /id="companion-plan"/);
  assert.match(game, /const planned=!!preview\.seasonPlan;/);
  assert.match(game, /\$\('companion-plan'\)\.hidden=planned;/);
  assert.match(game, /这一季还没一起安排过。/);
  assert.match(game, /\$\('companion-plan'\)\.onclick=\(\)=>\{\$\('companion-dialog'\)\.close\(\);\$\('season-open'\)\.click\(\);\}/);
});
