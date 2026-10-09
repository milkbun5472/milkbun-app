// 人物卷宗选常用语言（群友 2026-10-09）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "../js/" + f), "utf8");
const eng = R("engine.js"), app = R("app.js"), scr = R("screens.js");

test("常用语言：中文／留空一个字不发；别的说主要说什么", () => {
  const src = eng.slice(eng.indexOf("function charLangLine("), eng.indexOf("function groupPersonaText("));
  const charLangLine = new Function(src + "\nreturn charLangLine;")();
  assert.equal(charLangLine({ name: "a", lang: "" }), "");
  assert.equal(charLangLine({ name: "a", lang: "中文" }), "");
  assert.match(charLangLine({ name: "阿岚", lang: "日语" }), /阿岚平时说日语/);
});

test("单聊、群里、通话各处人设串都接上同一句", () => {
  assert.match(eng, /parts\.push\("【角色人设】\\n" \+ \(char\.persona \|\| "（暂无设定）"\) \+ \(ctx\.notRoleplay \? "" : charLangLine\(char\)\)\)/);
  const bare = (app + eng).match(/groupPersonaText\(c\.persona, [^\n]*/g).filter(l => !/charLangLine\(c\)/.test(l));
  assert.deepEqual(bare, [], "群里有一处人设串没接常用语言");
  assert.match(app, /if \(charLangLine\(c\) && !\(prev && charLangLine\(prev\)\) && \(chatSettings\[c\.id\] \|\| \{\}\)\.bilingual === undefined\)/);
  assert.match(scr, /lang: String\(lang \|\| ""\)\.trim\(\)\.slice\(0, 20\)/);
});
