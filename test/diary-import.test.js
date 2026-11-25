// 群友 2026-11-25：他的日记能自己填，从别的小手机搬过来
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), su = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("整段粘进来按行首日期拆成一篇篇", () => {
  const c = {}; vm.createContext(c);
  vm.runInContext(en.slice(en.indexOf("function diaryImportParse"), en.indexOf("function photoDuoSaid")) + ";this.P=diaryImportParse;", c);
  const now = new Date(2026, 10, 25).getTime();
  const r = c.P("2025年3月1日 下雨\n今天很累\n\n还是想她\n3/2\n第二篇", 1, now);
  assert.equal(r.length, 2);
  assert.equal(r[0].title, "下雨");
  assert.equal(r[0].paras.length, 2);
  assert.equal(new Date(r[1].ts).getMonth(), 2);
  assert.equal(c.P("没有日期的一段", 123, now)[0].ts, 123);
});
test("界面和落库都接上", () => {
  assert.match(su, /"data-wk": "diimport"/);
  assert.match(su, /e\.source === "imported"/);
  assert.match(ap, /source: "imported"/);
});
