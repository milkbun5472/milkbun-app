// 人物卷宗选常用语言（群友 2026-10-09）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "../js/" + f), "utf8");
const eng = R("engine.js"), app = R("app.js"), scr = (R("screens.js") + "\n" + R("screens-ui.js"));

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

// 群里 2026-10-11：设了粤语，线下旁白、动作描写也全写成了粤语；点「译」翻回来的有时是繁体
test("常用语言只管说出口的话；旁白动作照常写简体；译文一律摆简体", () => {
  const fs2 = require("node:fs"), p2 = require("node:path");
  const eng = fs2.readFileSync(p2.join(__dirname, "../js/engine.js"), "utf8");
  const cmp = fs2.readFileSync(p2.join(__dirname, "../js/components.js"), "utf8");
  assert.match(eng, /这只管【说出口的话】：线下的旁白、动作、神态、心理描写不是" \+ c\.name \+ "说的话，照常用简体中文写。/);
  assert.match(cmp, /setZh\(typeof toSimplified === "function" \? toSimplified\(r\.zh\) : r\.zh\)/);
});
