const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("拉黑那两条链也要填心声/心情/动作，并写回状态卡", () => {
  assert.strictEqual((app.match(/" \+ BLOCK_STATE_SHAPE \+ "\}" \+ BLOCK_STATE_SPEC/g) || []).length, 2);
  assert.ok(app.includes("applyBlockTurnState(charId, chatKey, d)"));
  assert.ok(app.includes("applyBlockTurnState(charId, chatKey, r.d)"));
  const fn = app.slice(app.indexOf("const applyBlockTurnState"), app.indexOf("const queueUnblockSpeech"));
  assert.ok(fn.includes("TVG.turnPatch") && fn.includes("setMoodFor") && fn.includes("setStateFor"));
});
