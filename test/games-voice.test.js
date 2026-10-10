// 小游戏里开口的生成要贴人设、说人话（她 2026-10-11：擂台、一起学修过，小游戏也看看）：
// 原来只递「真实水平」不递人设，全桌一个腔；还有一条写死的口气例句（违反不放内容样本）。
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("node:fs").readFileSync(require.resolve("../js/games.js"), "utf8");

test("共用一条 VOICE_RULE 和 voiceBrief，开口的那几处都接上了", () => {
  assert.match(g, /const VOICE_RULE = "【是这个人在说话 · 说人话】/);
  assert.match(g, /function voiceBrief\(p\)/);
  assert.ok((g.match(/AC \+ SKILL_RULE \+ VOICE_RULE \+/g) || []).length >= 11);
  assert.match(g, /const sys = AC \+ VOICE_RULE \+ "「" \+ gameZh/);
  assert.ok((g.match(/voiceBrief\((s|v|d|p|out)\)/g) || []).length >= 12);
  assert.doesNotMatch(g, /好的口气示例/);
});
test("狼人杀拼座位时把人设带上，不然 voiceBrief 拿不到", () => {
  assert.match(g, /skill: p\.skill, persona: p\.persona, char: p\.char, engineer: engineer, alive: p\.alive, priv: privateFor\(p, list\)/);
  assert.match(g, /skill: d\.skill, persona: d\.persona, char: d\.char, priv: privateFor\(d, list\)/);
  assert.match(g, /skill: p\.skill, persona: p\.persona, char: p\.char, engineer: engineer, alive: p\.alive, priv: privateFor\(p, players\)/);
});
