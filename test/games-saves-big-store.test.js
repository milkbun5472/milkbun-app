// 她 2026-10-10：「还有什么在小仓库一起搬了」——小游戏三份存档搬进大仓库，老的搬过来就删
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync(__dirname + "/../js/games.js", "utf8");

test("三份存档都走大仓库，老键第一次读到时搬过来、从小仓库删掉", () => {
  const i = src.indexOf("  function bigGet("), j = src.indexOf("  function bigSet(", i);
  assert.ok(i > 0 && j > i);
  const store = { games_save: JSON.stringify({ uno: { round: 3 } }) }, big = {};
  const localStorage = { getItem: k => (k in store ? store[k] : null), removeItem: k => { delete store[k]; } };
  const bigGet = new Function("localStorage", "loadJSON", "saveJSON", src.slice(i, j) + "\nreturn bigGet;")(
    localStorage, (k, f) => (k in big ? JSON.parse(big[k]) : f), (k, v) => { big[k] = JSON.stringify(v); });
  assert.equal(bigGet("x_gamesSave", "games_save", {}).uno.round, 3);
  assert.ok(!("games_save" in store), "老的删掉了");
  assert.equal(JSON.parse(big.x_gamesSave).uno.round, 3);
  assert.equal(bigGet("x_wolfSave", "wolf_save", null), null);
  const code = src.replace(/\/\/[^\n]*/g, "");
  ["wolf_save", "games_save", "tod_prompt_history_v1"].forEach(k =>
    assert.doesNotMatch(code, new RegExp("localStorage\\.setItem\\([^)]*" + k), k + " 又写回小仓库了"));
  assert.match(src, /const WOLF_SAVE = "x_wolfSave";/); assert.match(src, /const GS_SAVE = "x_gamesSave";/); assert.match(src, /const TD_PROMPT_HISTORY = "x_todPromptHistory";/);
});
