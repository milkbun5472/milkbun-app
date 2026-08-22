"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const CC = require("../js/cc-seat.js");

test("CCSeat 用 turn_id 幂等入队并取回同形 JSON", async () => {
  let args, polls = 0;
  const cloud = {
    yanqiuCcToolEnqueue: async (...x) => { args = x; return { id: "job1" }; },
    yanqiuCcToolResult: async () => (++polls < 2 ? null : { status: "completed", result: { kind: "play", code: "R5" } })
  };
  const result = await CC.ask({ tool: "game_turn", turn_id: "g#1", char_id: "yan", sys: "s", msgs: [] }, 3000, { cloud });
  assert.deepEqual(result, { kind: "play", code: "R5" }); assert.equal(args[1], "game_turn"); assert.equal(args[3], "game-turn:g#1");
});

test("所有 *_result 终局票都走亲打幂等通道，并明确本局已结束", async () => {
  let args;
  const cloud = {
    yanqiuCcToolEnqueue: async (...x) => { args = x; return { id: "finish1" }; },
    yanqiuCcToolResult: async () => ({ status: "completed", result: { say: "行，下一局我赢回来。" } })
  };
  const result = await CC.ask({ tool: "game_turn", game: "uno_result", turn_id: "g#lisa-win", char_id: "yan", sys: "s", msgs: [] }, 3000, { cloud });
  assert.equal(result.say, "行，下一局我赢回来。");
  assert.equal(args[3], "game-turn:g#lisa-win");
  assert.match(args[5], /小游戏已经结算/);
  assert.match(args[5], /不继续行动/);
});

test("谁是卧底淘汰票明确告知已出局，不会让言秋继续参与", async () => {
  let args;
  const cloud = {
    yanqiuCcToolEnqueue: async (...x) => { args = x; return { id: "out1" }; },
    yanqiuCcToolResult: async () => ({ status: "completed", result: { say: "行，我坐旁边看你们盘。" } })
  };
  const result = await CC.ask({ tool: "game_turn", game: "spy_eliminated", turn_id: "spy#out#yan", char_id: "yan", sys: "s", msgs: [] }, 3000, { cloud });
  assert.equal(result.say, "行，我坐旁边看你们盘。");
  assert.equal(args[3], "game-turn:spy#out#yan");
  assert.match(args[5], /你已被投出/);
  assert.match(args[5], /不要继续描述或投票/);
});
