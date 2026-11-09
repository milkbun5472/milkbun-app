// 性别跟人设一起递给模型：charLangLine 一处，各处名单都接它（群里 2026-11-04：女角色被写成「他」）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
global.CharacterPronoun = require("../js/character-pronoun.js");
const eng = R("engine.js");
const fn = eng.slice(eng.indexOf("function charLangLine("), eng.indexOf("function groupPersonaText("));
const { charLangLine } = new Function(fn + "return { charLangLine };")();
test("女/男写明，空性别和 TA 不写", () => {
  assert.match(charLangLine({ name: "阿梨", gender: "女" }), /【性别】女。说到阿梨一律用「她」/);
  assert.match(charLangLine({ name: "阿木", gender: "男" }), /【性别】男/);
  assert.equal(charLangLine({ name: "老角色" }), "");
  assert.equal(charLangLine({ name: "某某", gender: "TA" }), "");
  assert.match(charLangLine({ name: "阿梨", gender: "女", lang: "粤语" }), /【性别】女[\s\S]*【平时说的话】/);
});
test("自带名单的功能都接上了", () => {
  ["listen-square.js", "weekly.js", "trpg.js", "date-game.js", "debate.js", "theater.js", "study.js"].forEach(f => assert.match(R(f), /charLangLine\(/, f));
  assert.match(R("games.js"), /CharacterPronoun\.selfLine\(c\)/);
});
