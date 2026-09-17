"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");

// 她 2026-09-17：「走路的时候打字可以时间继续，只有停下来的时候不动，
//                 然后打字的时候小人可以继续走路视角跟着他移动」
// ⚠️原来只要在打字时间就停，于是「边走边聊」这件事在这游戏里等于不存在。
test("走着说话日子照走，站定了说话时间停下来等她", () => {
  assert.match(game, /if\(!chatting\|\|moving\)timeAccumulator\+=elapsed;/);
  assert.match(game, /走着说话，日子照走；站定了说话，时间停下来等她/);
  // moving 要在这一帧里先算好再读，不然读到的是上一帧的
  const loop = game.slice(game.indexOf("function frame(now)"));
  assert.ok(loop.indexOf("moving=path.length>0") < loop.indexOf("updateWorld(elapsed,dt)"),
    "读到的是上一帧的 moving，停下来那一刻会多走一分钟");
});

// 不然他走出画面，她一边打字一边看不见人
test("打字时镜头跟着他走", () => {
  assert.match(game, /if\(actor&&moving&&\(cameraFollow\|\|chatting&&chatFollow\)\)/);
  // ⚠️她自己拖过画面就不跟了——把主动权还给她（跟点地面取消「跟着他走」同一个道理）
  assert.match(game, /function panMap\(dx,dy\)\{cameraFollow=false;chatFollow=false;/);
  assert.match(game, /onCenter:\(\)=>\{cameraFollow=true;chatFollow=true;/);
  // 每次重新开聊天要重新跟上：上一轮拖过画面，不该一直记着
  assert.match(game, /if\(chatting\)chatFollow=true;/);
});
