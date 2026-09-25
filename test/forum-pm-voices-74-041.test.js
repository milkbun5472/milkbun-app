// 论坛私信一人一个调（她 2026-09-24：「论坛私信的人基本上都是一个调调」）
const fs = require("fs"), assert = require("assert"), vm = require("vm");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const i = app.indexOf("const FORUM_PM_AXES = ["), j = app.indexOf("const refreshForumPMs = async", i);
assert.ok(i > 0 && j > i, "抠不出 FORUM_PM_AXES");
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + "/../js/axes.js", "utf8"), ctx);
vm.runInContext(app.slice(i, j).replace("const FORUM_PM_AXES", "this.AX"), ctx);
const Axes = ctx.window.Axes || ctx.Axes;
assert.ok(Axes && Axes.batch, "Axes 没挂上");
// 一批九个人：同一条轴上掷出来的格子，一批之内不撞（格子数够的那几条）
const out = Axes.batch([{ axes: ctx.AX }], 9, ["forumpm", 1]);
assert.strictEqual(out.length, 9);
const why = out.map(g => (g[0].rows.find(r => r.key === "why") || {}).opt).filter(o => o && !/自己/.test(o));
assert.ok(new Set(why.slice(0, 6)).size === why.slice(0, 6).length, "前六个人的来意撞了");
// 真拼进了那一枪；旧的「每条必须针对某条帖子」删掉了
const r = app.slice(j, app.indexOf("const markPMRead", j));
assert.match(r, /sourceBlock \+ baseRule \+ pmPeople/);
assert.match(r, /Axes\.batch\(\[\{ axes: FORUM_PM_AXES \}\], pmN/);
assert.ok(!/每条 opening 必须/.test(r), "又逼每个人都从「看到你那帖」开口");
assert.match(r, /maxTokens: FTOK\.pm/);
console.log("ok forum-pm-voices");
