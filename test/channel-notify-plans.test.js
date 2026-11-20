const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(en.slice(en.indexOf("function chMentionsHer("), en.indexOf("function chHopTargets(")) + ";this.n=chNotifyCount;this.m=chMentionsHer;this.s=spaceSearch;this.p=planParseWhen;this.u=planUpcoming;", ctx);
test("通知等级：静音不算，只在 @我 时只算 @了她的，全部提醒照算", () => {
  const ms = [{ role: "assistant", content: "@Lisa 来" }, { role: "assistant", content: "嗯" }, { role: "assistant", content: "@所有人 开饭" }];
  assert.equal(ctx.n({ chNotify: "mute" }, 3, ms, ["Lisa"]), 0);
  assert.equal(ctx.n({ chNotify: "mention" }, 3, ms, ["Lisa"]), 2);
  assert.equal(ctx.n({}, 3, ms, ["Lisa"]), 3);
  assert.match(ap, /const _loud = !_ng \|\| chNotifyCount\(/);
  assert.match(cs, /un = it\.chs\.reduce\(\(n, g\) => n \+ chNotifyCount\(/);
});
