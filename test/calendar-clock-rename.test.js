// 她 2026-11-03 转群友：开了虚拟时间（零几年）、「日程照这只钟的日子排」没开，日历点进去是空的——日程按现实日子存，日历翻到钟上那天。
//   钟只改日子的叫法：这一页每一天挂对应现实那天的日程；删、改回到现实那天。
const assert = require("node:assert/strict"), fs = require("fs");
const c = fs.readFileSync("js/components.js", "utf8");
const seg = c.slice(c.indexOf("function Calendar({"), c.indexOf("const [form, setForm]", c.indexOf("function Calendar({")));
assert.match(seg, /schedules: rawSchedules/);
assert.match(seg, /rawSchedules = window\.CharDayLink \? window\.CharDayLink\.publicSchedules\(rawSchedules\) : rawSchedules;/);
assert.match(seg, /window\.ScheduleClock\.planFollows\(_viewChar\) \|\| !_vcNow\(_viewChar\.id\)\) return 0;/, "跟着钟排、或者钟没开：不挪");
assert.match(seg, /\[schedShiftDayKey\(k, -_nameShift\), v\]/);
for (const f of ["onDelSchedDay", "onDelSchedSeq", "onEditSchedSeq"]) assert.match(seg, new RegExp("const " + f + " = raw\\w+ && \\(\\(c, dk, \\.\\.\\.r\\) => raw\\w+\\(c, toRealDk\\(dk\\), \\.\\.\\.r\\)\\)"));
// 挪法本身：现实 2026-11-03、钟上 2009-03-20 → 现实那天的日程挂在钟上那天
const shift = (k, d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k); const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + d)); return t.toISOString().slice(0, 10); };
const ms = k => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k); return Date.UTC(+m[1], +m[2] - 1, +m[3]); };
const n = Math.round((ms("2026-11-03") - ms("2009-03-20")) / 86400000);
assert.equal(shift("2026-11-03", -n), "2009-03-20");
assert.equal(shift("2009-03-21", n), "2026-11-04");
