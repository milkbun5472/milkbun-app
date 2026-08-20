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
