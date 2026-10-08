// 两种局拉开差别；平票由裁判拍板并明说；判词说人话（她 2026-09-23）。
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync(__dirname + "/../js/debate.js", "utf8");
assert(/【随便吵 · 这是一场吵架，不是辩论】/.test(src) && /每人一段 1~4 句/.test(src));
assert(/【讲道理 · 这是一场正经辩论】/.test(src) && /每段都要有一个清楚的论点，并且真的碰到对面/.test(src));
assert(/casual \? "这一局看的是谁更会损、更好笑、更有戏，不看道理；/.test(src), "裁判每轮看的也分局");
assert(/台下打平，我来拍板/.test(src));
assert(/【判词说人话】/.test(src));
const i = src.indexOf("function tallyTied(");
const ctx = {}; vm.createContext(ctx); vm.runInContext(src.slice(i, src.indexOf("\n  }\n", i) + 4), ctx);
assert.strictEqual(ctx.tallyTied({ 沈屿白: 80, 顾暮: 80 }), true);
assert.strictEqual(ctx.tallyTied({ 沈屿白: 79, 顾暮: 80 }), false);
assert.strictEqual(ctx.tallyTied({}), false);
console.log("debate-modes-verdict ok");
// 她 2026-10-08：「擂台大家一个声音」——不许再把全场压成一个骨架
assert(/遮掉名字也认得出谁是谁/.test(src) && /同一轮里不许两个人用同一个骨架/.test(src));
assert(!/每段都要交三样/.test(src));
