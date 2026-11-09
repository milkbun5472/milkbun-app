const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// 群里 2026-11-04：日文角色开着双语，今日签和小游戏里只有日文、没有中译
test("小游戏：开着双语的人，规矩挂在 gameVoiceRules 这一处；气泡劈开原文和中译，念只念原文", () => {
  const g = read("js/games.js");
  assert.match(g, /return AC \+ VOICE_RULE \+ SKILL_RULE \+ gameBiRules\(\)/);
  assert.match(g, /GAME_BI = \(props\.characters \|\| \[\]\)\.filter\(/);
  assert.match(g, /function gameSaid\(text, who\)/);
  assert.ok((g.match(/gameSaid\(it\.text, p && p\.char\)\.node/g) || []).length >= 4);
  assert.match(g, /gameSaid\(l\.text, c\)\.node/);
});
test("今日签：手动、自动都把抽签的人递进提示词；存的时候不截掉译文；卡上劈开显示", () => {
  const core = read("js/astro-core.js"), app = read("js/app.js"), astro = read("js/astro.js");
  assert.match(core, /function signInstruction\(meName, facts, char\)/);
  assert.match(core, /function signCardOf\(d, by\)/);
  assert.match(core, /signLine\(a\.title/);
  assert.match(astro, /signInstruction\(meName, facts, c\)/);
  assert.match(astro, /g\.Astro\.signCardOf\(/);
  assert.match(app, /window\.Astro\.signCardOf\(/);
});
test("要不要带中译只问 __charBiOn 一处", () => {
  const app = read("js/app.js");
  assert.match(app, /window\.__charBiOn = id =>/);
  assert.match(app, /const stampBi = char => \{ return window\.__charBiOn\(char\.id\)/);
});
