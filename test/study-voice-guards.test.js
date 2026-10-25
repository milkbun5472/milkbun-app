const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const st = fs.readFileSync(__dirname + "/../js/study.js", "utf8"), eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("长期准则只有一份说法：单聊和一起学都走 directivesBlock", () => {
  assert.match(eng, /function directivesBlock\(dirs\)/);
  assert.match(eng, /if \(dirs\.length\) parts\.push\(directivesBlock\(dirs\)\);/);
  assert.equal((eng.match(/【⚠️用户立下的长期准则·最高优先级/g) || []).length, 1);
});
test("一起学带上「别拿现成的说法」和她立的准则（课堂和我来教两条路）", () => {
  // 2026-10-26 talkBans 合并：「别拿现成的说法」改从 talkBans() 整摞取（它在那张清单里）；
  //   群辅导那条路 groupBans 已经带了，调用处传第三参 have 跳过，别发两遍
  assert.match(st, /function voiceGuards\(dirLists, studyList, have\)/);
  assert.match(st, /if \(typeof talkBans === "function" && !have\) talkBans\(\)\.forEach/);
  assert.match(eng, /function talkBans\(o\) \{[\s\S]{0,300}?CANNED_PHRASE_BAN/);
  assert.match(st, /voiceGuards\(\[cx\.directives\], \[\{ sr: cx\.studyRules, name: chars\.length > 1 \? c\.name : "" \}\], chars\.length > 1\)/);
  assert.match(st, /chars\.length > 1 && typeof groupBans === "function" \? \[groupBans\(/, "群辅导不走 groupBans 了，have 就不该跳过");
  assert.match(st, /voiceGuards\(\[ctx\.directives\]/);
  assert.match(st, /voiceGuards\(stus\.map\(function \(c\) \{ return ctx\.directivesFor/);
  assert.match(st, /directives: props\.directivesFor && char \? props\.directivesFor\(char\) : \[\]/);
  assert.match(app, /directivesFor: c => \(c && directives\[c\.id\]\) \|\| \[\],/);
});
test("学习准则：单开一份，只有一起学读；课程页右上「规矩」整页编辑", () => {
  assert.match(app, /studyRulesFor: c => \{ const st = \(c && settingsFor\(c\.id\)\) \|\| \{\}; return \{ style: String\(st\.studyStyle/);
  assert.match(app, /onSaveStudyRules: \(id, patch\) => patchChatSetting\(id, patch\),/);
  assert.match(st, /voiceGuards\(\[ctx\.directives\], \[\{ sr: ctx\.studyRules \}\]\)/);
  assert.match(st, /ctx\.studyRulesFor \? ctx\.studyRulesFor\(c\) : null/);
  assert.match(st, /function StudyRulesPage\(props\)/);
  assert.match(st, /bookOpen === "rules"\) return h\(StudyRulesPage/);
  assert.doesNotMatch(fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), /studyRules|studyStyle/);   // 聊天那头一个字都不读
});
