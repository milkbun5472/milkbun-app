const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const slice = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
const E = new Function(slice(eng, "function offlineSayZhSpec", "async function generateOffline(") + "; return { offlineSayZhSpec, offlineSayKey, offlineSayZhParse };")();
const offSayZhOf = new Function("offlineSayKey", slice(comp, "function offSayZhOf", "function offBody(") + "; return offSayZhOf;")(E.offlineSayKey);
test("线下外语台词的中文由模型顺手交（她 2026-10-26 选 B）：对照按句、键忽略引号和句末标点", () => {
  const map = E.offlineSayZhParse({ "コンソールにあるよ。": "在中控台那儿。", "Type-Cで足りる？": "Type-C 够用吗？", "": "x" });
  assert.equal(offSayZhOf(map, "「コンソールにあるよ。"), "在中控台那儿。");
  assert.equal(offSayZhOf(map, " Type-Cで足りる？」"), "Type-C 够用吗？");
  assert.equal(offSayZhOf(map, "知らない文。"), undefined);   // 对不上的照旧走免费翻译
  assert.equal(E.offlineSayZhParse([]), null); assert.equal(E.offlineSayZhParse({}), null);
  assert.match(E.offlineSayZhSpec(""), /sayZh/); assert.match(E.offlineSayZhSpec("『莲』"), /『莲』/);
});
test("单人线下、群线下都接上：开着自带中译才要、存进消息、正文显示时用", () => {
  assert.match(eng, /\(!isDigital && session\.sayZhOn\) \? offlineSayZhSpec\(""\)/);
  assert.match(eng, /sayZh: session\.sayZhOn \? offlineSayZhParse\(parsed\.sayZh\) : null/);
  assert.match(eng, /\(session\.sayZhNames \|\| \[\]\)\.length \? offlineSayZhSpec/);
  assert.equal((eng.match(/if \(gSayZh\) (out|nOut)\.forEach/g) || []).length, 2);
  assert.match(app, /sayZhOn: !!\(settingsFor\(charId\) \|\| \{\}\)\.bilingual/);
  assert.match(app, /sayZhNames: \(gCtx\.members/);
  assert.equal((app.match(/\.\.\.\((res|b)\.sayZh \? \{ sayZh: (res|b)\.sayZh \} : \{\}\)/g) || []).length, 2);
  assert.match(comp, /zhReady: offSayZhOf\(sayZh, sen\)/); assert.match(comp, /isUser \? null : m\.sayZh\)\)/);
});
