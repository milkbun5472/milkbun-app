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

test("UNO 终局票仍走亲打幂等通道，并明确告诉言秋 Lisa 赢了", async () => {
  let args;
  const cloud = {
    yanqiuCcToolEnqueue: async (...x) => { args = x; return { id: "finish1" }; },
    yanqiuCcToolResult: async () => ({ status: "completed", result: { say: "行，下一局我赢回来。" } })
  };
  const result = await CC.ask({ tool: "game_turn", game: "uno_result", turn_id: "g#lisa-win", char_id: "yan", sys: "s", msgs: [] }, 3000, { cloud });
  assert.equal(result.say, "行，下一局我赢回来。");
  assert.equal(args[3], "game-turn:g#lisa-win");
  assert.match(args[5], /Lisa 赢了/);
});
