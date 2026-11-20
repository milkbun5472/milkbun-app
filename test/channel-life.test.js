// 频道的日子（她 2026-11-20）：精华墙、树洞、深夜频道、一起听
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const fn = name => { const i = en.indexOf("function " + name + "("), j = en.indexOf("\n}\n", i) + 3; const ctx = {}; vm.createContext(ctx); vm.runInContext(en.slice(i, j) + ";this.f=" + name + ";", ctx); return ctx.f; };
test("精华提名：引的必须是这个频道最近真说过的话", () => {
  const hit = fn("gemQuoteHit");
  const ms = [{ role: "assistant", content: "今晚的月亮像个煎蛋", ts: 1 }, { role: "system", content: "某某 去了 #a" }];
  assert.equal(hit("「像个煎蛋」", ms).ts, 1);
  assert.equal(hit("像个汤圆", ms), null);
  assert.equal(hit("去了", ms), null);
  assert.equal(hit("x", ms), null);
});
test("精华提名一个频道一天一回，她收的不算", () => {
  const ok = fn("gemDayOk");
  assert.equal(ok([{ gid: "a", by: "me", day: "d" }], "a", "d"), true);
  assert.equal(ok([{ gid: "a", by: "c1", day: "d" }], "a", "d"), false);
  assert.equal(ok([{ gid: "a", by: "c1", day: "x" }], "a", "d"), true);
});
test("精华接线：长按菜单、提名字段、墙页、提示词", () => {
  assert.match(cs, /gem: \["收进精华"/);
  assert.match(cs, /function SpaceGemsPage\(/);
  assert.match(ap, /const addGem = \(spId, gid, m, by, why\) =>/);
  assert.match(ap, /gemQuoteHit\(item\.gem\.quote/);
  assert.match(ap, /gNewChHint \+ gGemHint \+/);
});
