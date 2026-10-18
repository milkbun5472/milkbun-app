const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const st = fs.readFileSync(__dirname + "/../js/study.js", "utf8"), eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("长期准则只有一份说法：单聊和一起学都走 directivesBlock", () => {
  assert.match(eng, /function directivesBlock\(dirs\)/);
  assert.match(eng, /if \(dirs\.length\) parts\.push\(directivesBlock\(dirs\)\);/);
  assert.equal((eng.match(/【⚠️用户立下的长期准则·最高优先级/g) || []).length, 1);
});
test("一起学带上「别拿现成的说法」和她立的准则（课堂和我来教两条路）", () => {
  assert.match(st, /function voiceGuards\(dirLists\)/);
  assert.match(st, /CANNED_PHRASE_BAN/);
  assert.match(st, /voiceGuards\(\[ctx\.directives\]\)/);
  assert.match(st, /voiceGuards\(stus\.map\(function \(c\) \{ return ctx\.directivesFor/);
  assert.match(st, /directives: props\.directivesFor && char \? props\.directivesFor\(char\) : \[\]/);
  assert.match(app, /directivesFor: c => \(c && directives\[c\.id\]\) \|\| \[\],/);
});
