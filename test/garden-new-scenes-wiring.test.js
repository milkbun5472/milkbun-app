"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const host = fs.readFileSync("js/fairy-garden.js", "utf8");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");
const world = fs.readFileSync("apps/fairy-garden/world.mjs", "utf8");

// 她 2026-09-18：「然后把新加的场景的动作交互也补上吧宝宝」
test("「他能去哪儿」那句话照 COMPANION_DESTINATIONS 长，宿主不另抄一份地名", () => {
  assert.match(host, /target 取 " \+ \(destinations \|\| /);
  assert.doesNotMatch(host, /pond（林地池边）/, "手抄那一份已经退役了");
  assert.match(host, /destinations: \(game\(\) && game\(\)\.destinations && game\(\)\.destinations\(\)\)/);
  assert.match(game, /destinations:\(\)=>destinationChoices\(\)/);
  assert.match(world, /export const destinationChoices=\(\)=>Object\.entries\(COMPANION_DESTINATIONS\)/);
});

// ⚠️存档白名单是同一张表的第二瓣：手抄的那一版加一处就漏一次
test("存档里的地点白名单直接问那张表，不是手抄的四个 id", () => {
  assert.match(world, /destination:Object\.hasOwn\(COMPANION_DESTINATIONS,d\.destination\)/);
  assert.doesNotMatch(world, /\['pond','garden','well','home'\]/);
});

// 那串静态文字不许塞进 snapshot：每一枪都要 JSON.stringify 一遍
test("这串不变的地名不占每一枪的上下文", () => {
  assert.match(game, /不塞进 snapshot/);
});
