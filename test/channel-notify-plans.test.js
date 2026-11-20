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
test("空间搜索：几个词都要出现，聊天、文件、墙、精华一起搜，新的在前", () => {
  const ch = [{ id: "a", chName: "综合" }];
  const r = ctx.s("火锅 周六", { channels: ch, chatsOf: () => [{ role: "assistant", senderName: "顾朝", content: "周六吃火锅吗", ts: 5 }, { role: "assistant", content: "火锅", ts: 9 }],
    filesOf: () => [{ id: "f", kind: "doc", name: "计划", text: "周六\n火锅 周六 晚上", updatedTs: 7 }], playOf: () => ({ notes: [{ text: "周六不许吃火锅", ts: 3 }] }), gems: [] });
  assert.equal(JSON.stringify(r.map(x => x.kind)), JSON.stringify(["file", "msg", "note"]));
});
test("约定日子：明天、周X、下周X、M月D日、带几点都认；接下来七天按先后排", () => {
  const now = new Date(2026, 10, 20, 10);
  assert.equal(ctx.p("明天晚上7点", now).date, "2026-11-21");
  assert.equal(ctx.p("明天晚上7点", now).time, "19:00");
  assert.equal(ctx.p("下周一", now).date, "2026-11-23");
  assert.equal(ctx.p("11月25日", now).date, "2026-11-25");
  assert.equal(ctx.p("乱写", now), null);
  const up = ctx.u([{ title: "b", date: "2026-11-25" }, { title: "a", date: "2026-11-21", time: "19:00" }, { title: "x", date: "2026-12-30" }, { title: "d", date: "2026-11-22", done: true }], "2026-11-20", 7);
  assert.equal(JSON.stringify(up.map(p => p.title)), JSON.stringify(["a", "b"]));
  const ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
  assert.match(ap, /gStatusHint \+ gPlanHint \+ gDirHint/);
  assert.match(ap, /if \(\(item\.plan \|\| item\.planDone\) && !groupSpectating\(group\)\)/);
  assert.match(cs, /function SpacePlansPage\(/);
  assert.match(cs, /function SpaceSearchPage\(/);
});
