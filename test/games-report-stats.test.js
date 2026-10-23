// 小游戏终局：同一份战果 rep 管收进记忆、战报发给 TA、记一笔战绩（她 2026-10-11「都可以做，慢慢做」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const g = R("games.js"), app = R("app.js"), cmp = R("components.js");

test("终局记战绩（零调用、同一局不重复记），柜子里有战绩本", () => {
  assert.match(g, /const STATS_KEY = "x_gameStats";/);
  assert.match(g, /useEffect\(function \(\) \{ recordGame\(rep\); \}, \[\]\);/);
  assert.match(g, /x\.sig === sig && Date\.now\(\) - \(x\.ts \|\| 0\) < 3600000/);
  assert.match(g, /h\(GameStatsBook, \{ t: t, characters: props\.characters \|\| \[\] \}\)/);
  assert.match(g, /"data-wk": "gamestats"/);
});
test("战报发给 TA：每个上场的真人角色一颗，进聊天落一张 gameshare 卡", () => {
  assert.match(g, /sendGameReport: props\.sendGameReport,/);
  assert.match(g, /host\.sendGameReport\(id, \w+(, true)?\)/);   // 勾了「连过程一起」时交的是包过一层的那份
  assert.match(app, /sendGameReport: \(charId, rep(, noOpen)?\) => \{/);
  assert.match(app, /kind: "gameshare", content: body/);
  assert.match(cmp, /if \(kind === "gameshare"\) return GameShareCard;/);
  assert.match(cmp, /function GameShareCard\(\{ m, isU \}\)/);
});
test("每桌的输赢算法：卧底按阵营、狼人杀按狼与好人、阿瓦隆按 side", () => {
  assert.match(g, /won = function \(q\) \{ return \(q\.role === "spy"\) === \(winner === "spy"\); \}/);
  assert.match(g, /won = function \(q\) \{ return isWolfRole\(q\.role\) === \(winner === "wolf"\); \}/);
  assert.match(g, /won = function \(q\) \{ return \(winner === "good"\) === \(q\.side === "good"\); \}/);
});
