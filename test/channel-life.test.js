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
test("树洞：按先后发号，同一份聊天每次一样；屏幕上只剩代号", () => {
  const ctx = {}; vm.createContext(ctx);
  const grab = n => { const i = en.indexOf("function " + n + "("), j = en.indexOf("\n}\n", i) + 3; return en.slice(i, j); };
  vm.runInContext(grab("thAlias") + grab("thAliasMapOf") + grab("thView") + ";this.m=thAliasMapOf;this.v=thView;", ctx);
  const ms = [{ role: "assistant", senderId: "b", senderName: "顾暮", content: "1" }, { role: "user", content: "2" }, { role: "assistant", senderId: "a", senderName: "顾朝", content: "3" }, { role: "assistant", senderId: "b", senderName: "顾暮", content: "4" }];
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.m(ms))), { b: 1, me: 2, a: 3 });
  const v = ctx.v(ms);
  assert.equal(v[0].senderName, "树洞 #1"); assert.equal(v[2].senderName, "树洞 #3"); assert.equal(v[3].senderId, "th:1");
  assert.equal(v[1].content, "2"); assert.equal(ms[0].senderName, "顾暮");
  assert.match(ap, /gGemHint \+ gTreeHint \+/);
});
test("深夜频道：几点到几点开，跨午夜也认", () => {
  const open = fn("chHoursOpen"), at = h => new Date(2026, 0, 1, h, 30);
  assert.equal(open(null, at(3)), true);
  assert.equal(open({ from: 22, to: 5 }, at(23)), true);
  assert.equal(open({ from: 22, to: 5 }, at(3)), true);
  assert.equal(open({ from: 22, to: 5 }, at(5)), false);
  assert.equal(open({ from: 22, to: 5 }, at(12)), false);
  assert.equal(open({ from: 9, to: 18 }, at(12)), true);
  assert.equal(open({ from: 9, to: 18 }, at(20)), false);
});
test("欢迎新人：加人、收群带进新人都走 welcomeNew，老成员接一轮", () => {
  assert.match(ap, /const welcomeNew = \(spId, ids\) =>/);
  assert.match(ap, /if \(added\.length\) welcomeNew\(sp\.id, added\);/);
  assert.match(ap, /welcomeNew\(sp\.id, add\); \}/);
  assert.match(ap, /replyGroup\(g\.id, \{ welcome: names \}\)/);
  assert.match(ap, /gTreeHint \+ gWelcomeHint \+/);
});
