const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const g = fs.readFileSync(__dirname + "/../js/games.js", "utf8");
test("游戏里会说话的提示都走 gameVoiceRules，不再各拼一份", () => {
  assert.ok(!/AC \+ (SKILL_RULE \+ )?VOICE_RULE \+/.test(g.replace(/return AC \+ VOICE_RULE \+ SKILL_RULE/, "")), "还有手拼 AC + VOICE_RULE 的地方");
  assert.ok(!/AC \+ TD_IC/.test(g), "真心话那几处没接上");
  ["你正在亲自玩 UNO", "你正在亲自玩「骗子骰」", "你正在和大家玩「故事接龙」", "你正在亲自打德州扑克", "你正在亲自玩「抽鬼牌」", "你正在亲自玩 21 点"].forEach(k =>
    assert.match(g, new RegExp('gameVoiceRules\\(\\) \\+ "\\\\n" \\+ "' + k.replace(/[()]/g, "\\$&")), k));
});
test("角色卡入局时统一填成整张（gameSheet）", () => {
  assert.match(g, /function gameSheet\(c\)/);
  assert.match(g, /persona: gameSheet\(c\) \+ \(lore \?/);
});
test("你画我猜有存档：打到哪儿存到哪儿，架上能继续，打完清掉", () => {
  assert.match(g, /saveGameSnap\("draw", \{ config: cfg/);
  assert.match(g, /if \(phase === "end"\) \{ clearGameSave\("draw"\); return; \}/);
  assert.match(g, /const sv = \(props\.savedState && props\.savedState\.draw\) \|\| null;/);
});
