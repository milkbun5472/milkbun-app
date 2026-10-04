"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");

test("现实时间在走路和站定聊天时都同步；人物动作仍等待输入", () => {
 const a=game.indexOf('function updateWorld('),b=game.indexOf('let last=performance.now()',a);assert.ok(a>=0&&b>a);const update=game.slice(a,b);
 assert.match(update,/data=syncRealWorld\(data\)/);
 assert.ok(update.indexOf('data=syncRealWorld(data)')<update.indexOf('const result=receivedUntil'));
 assert.doesNotMatch(update,/timeAccumulator\+=elapsed/);
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
