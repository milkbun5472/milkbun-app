// 牌技钉住（她 2026-10-11）：开局页给角色钉一档，三处组名单都认她定的，没钉照旧估
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("node:fs").readFileSync(require.resolve("../js/games.js"), "utf8");

test("钉了用钉的，没钉用估的；三处组名单都走 pinnedSkill", () => {
  assert.match(g, /const SKILL_PIN_KEY = "x_gameSkillPins";/);
  assert.match(g, /function pinnedSkill\(charId, guessed\)/);
  assert.equal((g.match(/skill: pinnedSkill\((p|c)\.id, skillOf\[(p|c)\.name\] \|\| ""\)/g) || []).length, 3);
  assert.doesNotMatch(g, /skill: skillOf\[(p|c)\.name\] \|\| ""/);
});
test("开局页给选上的人一排四档，改了就存", () => {
  assert.match(g, /"data-wk": "gameskillpin"/);
  assert.match(g, /saveJSON\(SKILL_PIN_KEY, n\)/);
});
test("台词念出来：配了音色的真人角色台词旁一颗 ▶，跟通话转录同一个 TtsDot；一桌只念一句", () => {
  assert.match(g, /function GameVoiceDot\(props\)/);
  assert.match(g, /h\(TtsDot, \{ k: props\.k, text: props\.text, spk: spk, tp: relay \}\)/);
  assert.match(g, /window\.__gameTtsStop !== tp\.stop/);
  assert.ok((g.match(/h\(GameVoiceDot, \{ p: p, text: it\.text, k: "gv" \+ i \}\)/g) || []).length >= 4);
});
