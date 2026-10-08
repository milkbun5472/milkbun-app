// 改日程不再一刀切（她 2026-10-08「改日程会截断，直接把日程和改日程的字数放开」）
const assert = require("assert");
const fs = require("fs");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const i = scr.indexOf("function schedSpliceNow("), j = scr.indexOf("\nfunction ", i + 10);
const fn = new Function(scr.slice(i, j) + "\nreturn schedSpliceNow;")();
global.schedFillEnds = x => x;
const long = "被她一把拉住手腕带去了餐厅，说今晚不许再看纪录片了，" + "原因写得很长".repeat(10);
const out = fn([{ time: "21:00", end: "23:59", title: "看纪录片" }], 21 * 60 + 57, { title: "在餐桌边和她待着", until: "23:30", reason: long });
const seg = out.find(s => s.deviation);
assert.strictEqual(seg.deviation.reason, long);
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
assert.match(comp, /"data-wk": "calevdev", style: \{[^}]*whiteSpace: "pre-wrap"/);
console.log("sched-no-truncate ok");
