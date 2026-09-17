"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const rules = rd("apps/fairy-garden/rules.js");
const companion = rd("apps/fairy-garden/companion.mjs");
const world = rd("apps/fairy-garden/world.mjs");
const host = rd("js/fairy-garden.js");
const game = rd("apps/fairy-garden/game.mjs");
const html = rd("apps/fairy-garden/index.html");

// 她 2026-09-17：「固定时间表不要了，就直接模型定就行，不过得增加他可以做的行动」
test("三档性格退役，存档和界面里都不许再留", () => {
  assert.doesNotMatch(world, /TEMPERAMENTS/);
  assert.doesNotMatch(world, /temperament/);
  assert.doesNotMatch(companion, /temperament/);
  assert.doesNotMatch(game, /companion-type/);
  assert.doesNotMatch(html, /companion-type/);
  assert.match(world, /三档「性格」v69\.55 退役/);
});

// ⚠️地板表不是「默认作息」，是「今天还没排上」——它不许假装那是他的性格
test("兜底只剩一张地板表，而且明摆着是还没排上", () => {
  assert.match(companion, /const FALLBACK=\[\[420,'home'\],\[480,'flowers'\],\[720,'walk'\],\[1080,'home'\]\];/);
  assert.doesNotMatch(companion, /gardener|explorer|scholar/);
  // 那件杂活不能省：没配线路的人打开游戏，他从此再也不浇花了
  assert.match(companion, /他每天顺手帮你浇一次花/);
});

// 这张表就是【他能做什么】的全部：造世界那一枪照它发清单，不在提示词里另写一份
test("她做出来的那些地方，他都够得着了", () => {
  for (const id of ["board", "museum", "bottle", "market", "bridge", "wish", "neighbor", "hall", "walk"]) {
    assert.match(rules, new RegExp("\\b" + id + ":\\{map:"), id + " 不在活动表里，他就永远去不了");
  }
  assert.match(host, /rules\.ACTIVITIES/, "清单要从表里现取，不许在提示词里抄第二份");
  assert.match(host, /她一个人做的那些事，你也去得了/);
  assert.match(host, /收藏馆里摆着的是【她自己留下的东西】/);
});

// 撤掉垫底的三张表之后，这一枪的责任变重了：它排不满，他那一天就是空的
test("造世界那一枪要知道自己是他全部的日子", () => {
  assert.match(host, /【这一份就是你全部的日子】/);
  assert.match(host, /没有另一套「默认作息」垫着/);
});
