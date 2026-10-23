// 群友 2026-10-23：一起玩加国际象棋和中国象棋。她：正常打，放水多给点提示；两个游戏各自一个界面
const assert = require("node:assert/strict");
const rd = f => require("node:fs").readFileSync(require("node:path").join(__dirname, "..", f), "utf8");
const g = rd("js/games.js"), list = require("../js/games-list.js"), idx = rd("index.html");
["chess", "xiangqi"].forEach(k => {
  assert.ok(list.GAMES.find(x => x.key === k), "目录里没有 " + k);
  assert.match(idx, new RegExp('data-lazy="games" data-src="js/' + k + '-core\\.js\\?v='));
});
assert.match(g, /if \(session\.game\.key === "chess" && window\.ChessCore\) return h\(ChessGame, engineProps\);/);
assert.match(g, /if \(session\.game\.key === "xiangqi" && window\.XiangqiCore\) return h\(XiangqiGame, engineProps\);/);
assert.match(g, /function ChessGame\(props\)/);
assert.match(g, /function XiangqiGame\(props\)/);
// 走子是本地引擎，模型只说话
assert.ok(!/ChessGame[\s\S]{0,200}callRetry\(api, sys[^)]*走子/.test(g));
// 放水：TA 那一方 easy，提示不限；正常局三次
assert.match(g, /const BOARD_HINTS = 3;/);
assert.equal((g.match(/const canHint = !over && state\.turn === userSide && \(easy \|\| hintsUsed < BOARD_HINTS\);/g) || []).length, 2);
assert.equal((g.match(/const levelOf = function \(s\) \{ return !spectate && easy && s === charSide \? "easy" : "normal"; \};/g) || []).length, 2);
console.log("ok");
