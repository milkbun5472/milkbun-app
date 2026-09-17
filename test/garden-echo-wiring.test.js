"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const companion = rd("apps/fairy-garden/companion.mjs");
const host = rd("js/fairy-garden.js");

// 她 2026-09-17：「我觉得现在还是有点玩法单调」
// 诊断写在 world.mjs 那一段注释里：病根是【做了没有回响】，不是事情少。
test("村里那本账是几条链子和他之间唯一的接口", () => {
  assert.match(world, /做了没有回响/);
  assert.match(world, /export function noteHappening\(s, kind, text\)/);
  // ⚠️一律走这一处记，散在各处各写一句 push 迟早有人改漏
  assert.match(world, /一律走这一处记/);
  // 六个入口都接上了：留馆、刨到、做出、交委托、收花笺、世界自己长的那一件
  assert.ok(world.split("noteHappening(").length - 1 >= 6, "有链子还没接进这本账");
});

// ⚠️这本账只记真发生过的事：写进去一件没发生的，他就会当着她的面提起它
test("账上只许有真发生过的事", () => {
  assert.match(world, /只记【真发生过的】/);
  const daily = world.slice(world.indexOf("function dailySeeds(s)"), world.indexOf("export function dailyNote"));
  assert.match(daily, /只从她自己的存档里长/);
  // 每一句要么不挑存档，要么先问存档里有没有
  assert.match(daily, /if \(kept\.length\)/);
  assert.match(daily, /if \(things\.length\)/);
});

test("他开口和他排日程，读的都是这一份", () => {
  assert.match(world, /const lately = recentHappenings\(s, 5\)/);
  assert.match(game, /lately:recentHappenings\(data,6\)/, "不进快照，他排日程时就读不到");
  assert.match(host, /【村里最近发生的事】/);
});

// ⚠️他去了馆里却什么都没留下＝他去了等于没去
test("他去馆里看过要留下痕迹", () => {
  assert.match(companion, /plan\.id==='museum'&&idle>=2\.8&&finishedKey!==key/);
  assert.match(companion, /看的是「'\+kept\.name\+'」/);
  assert.match(companion, /addMiss\(s,'kept'\)/, "他看过她留下的东西，那也是一笔思念");
});

// B：回来看看变了什么
test("每天早上把世界自己长的那一件说出来", () => {
  assert.match(world, /function withDailyNote\(s\)/);
  assert.match(world, /export function nextDay\(s\)\{const day=s\.day\+1;return withDailyNote\(/);
  assert.match(game, /\(recentHappenings\(data,1\)\[0\]\|\|\{\}\)\.text/, "不说出来，她回来看到的还是只有天数在变");
  // 连着几天同一句，「世界在动」立刻就假了
  assert.match(world, /先把最近说过的那几句划掉再抽/);
});

// C：天气不是滤镜
test("天气真的改掉今天能做的事", () => {
  assert.match(world, /那是【滤镜】，不是玩法/);
  assert.match(world, /export const diveWeight = s =>/);
  assert.match(world, /Math\.round\(45\*diveWeight\(s\)\)/);
  assert.match(world, /Math\.round\(35\*diveWeight\(s\)\)/);
  // ⚠️不许拿「今天不行」堵她的路
  assert.match(world, /不是不让下——不许拿「今天不行」堵她的路/);
  assert.match(game, /diveWet\(data\)\?'↓ 下到井里 · 井壁湿滑，慢一截'/, "慢了却不说，她只会以为卡了");
  assert.match(game, /fog&&here&&Math\.hypot\(pos\.x-here\.x,pos\.z-here\.z\)>MAP_FOG_RANGE/);
  assert.match(game, /雾大，远处那 '\+hidden\+' 处这会儿看不清/);
});
