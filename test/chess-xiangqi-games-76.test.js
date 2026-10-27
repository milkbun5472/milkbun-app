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
assert.equal((g.match(/const canHint = !over && state\.turn === userSide && \(easy \|\| hintsUsed < BOARD_HINTS\);/g) || []).length, 1);   // 走子棋公共那一份（useEngineBoard）；围棋另有自己那句
assert.equal((g.match(/if \(!spectate \&\& easy \&\& s === charSide\) return "easy";/g) || []).length, 2);   // 放水一律 easy（走子棋公共那一份 ＋ 围棋）
// 国际象棋、中国象棋、斗兽棋只交规则和棋盘画法，外壳只有一份（她 2026-10-27「要要要」）
["ChessGame", "XiangqiGame", "JungleGame"].forEach(n => assert.match(g, new RegExp("function " + n + "\\(props\\) \\{\\n    const g = useEngineBoard\\(props, \\{")));
assert.equal((g.match(/return h\(EngineBoardPage, \{ g: g,/g) || []).length, 3);
console.log("ok");
// 她 2026-10-23：正常局水平照人设（钉的优先，估的跟能力小传存一起），说话走公共那套
assert.match(g, /const BOARD_TIER_LV = \{ rookie: "easy", mid: "normal", pro: "hard" \};/);
assert.match(g, /function useBoardSkill\(props, key, zh, chars\)/);
assert.match(g, /const sys = AC \+ SKILL_RULE \+ SKILL_TALK \+ "\\n\\n你是「" \+ zh \+ "」的能力评估器/);
assert.equal((g.match(/const tiers = useBoardSkill\(props, KEY, ZH,/g) || []).length, 2);
assert.match(g, /const sys = gameVoiceRules\(\) \+ "【场面】" \+ o\.scene\(\)/);
// 围棋（她 2026-10-23）＋ 三个棋的教学开关
assert.ok(list.GAMES.find(x => x.key === "go"));
assert.match(idx, /data-lazy="games" data-src="js\/go-core\.js\?v=/);
assert.match(g, /if \(session\.game\.key === "go" && window\.GoCore\) return h\(GoGame, engineProps\);/);
assert.match(g, /boardTeach: \["chess", "xiangqi", "go", "jungle"\]\.indexOf\(game\.key\) >= 0 && !spectate \? boardTeach : undefined/);
assert.equal((g.match(/const teach = !!cfg\.boardTeach && !spectate/g) || []).length, 2);
assert.match(g, /\(o\.teach \? "\\n\\n【这局在教 " \+ o\.uName \+ " 下】/);
// 她开口才说：教学也不自己冒话（提示是她按的，算她开口）
assert.ok(!/teachRef\.current = [^;]*talk\.say/.test(g));
console.log("go ok");
