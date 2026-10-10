// 心声也有译键（她 2026-10-10）：心声跟着角色的语言走，发了外语就给「译」，走全库那一份 TransText
const test = require("node:test");
const assert = require("node:assert/strict");
const comp = require("node:fs").readFileSync(require.resolve("../js/components.js"), "utf8");
test("线下心声两处、状态页心声两处都包了 TransText", () => {
  assert.match(comp, /h\(TransText, \{ text: castPick\.x\.thought, ink: t\.fog, inline: true, size: 12\.5, noModel: true \}\)/);
  assert.match(comp, /h\(TransText, \{ text: m\.thought, ink: t\.fog, inline: true, size: 12\.5, noModel: true \}\)/);
  assert.match(comp, /h\(TransText, \{ text: s2\.thought \|\| "", ink: t\.ink, inline: true, size: 13\.5, noModel: true \}\)/);
  assert.match(comp, /h\(TransText, \{ text: S\(state\.thought\), ink: t\.ink, inline: true, size: 15, noModel: true \}\)/);
});
test("心声翻不成就停：免费的两家都失败也不去叫模型", () => {
  const eng = require("node:fs").readFileSync(require.resolve("../js/engine.js"), "utf8");
  assert.match(eng, /run: \(\) => opts && opts\.noModel \? Promise\.reject/);
  assert.match(comp, /translateLongToZh\(text, lang, noModel \? \{ noModel: true \} : undefined\)/);
});
