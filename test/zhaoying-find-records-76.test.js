// 她 2026-10-23「题越来越多不好找记录」：首页「最近做过」＋「自己出的」按出题人筛
const assert = require("node:assert/strict"), fs = require("fs");
const core = fs.readFileSync("js/zhaoying-core.js", "utf8"), ui = fs.readFileSync("js/zhaoying.js", "utf8"), ts = fs.readFileSync("js/theme-studio.js", "utf8");
assert.match(core, /function recentRecords\(n, alive\)/);
assert.match(core, /recordsOf, recentRecords, addRecord/);
assert.match(ui, /Z\.recentRecords\(8, w => w === "me" \|\| chars\.some/);
assert.match(ui, /setWho\(r\.who\); setTestId\(r\.testId\); setOpenRec\(r\.id\)/);
assert.match(ui, /curCat !== "mine" \|\| !byWho \|\| \(tt\.by \|\| "me"\) === byWho/);
assert.ok(!/saveJSON\("x_zyBy/.test(ui), "出题人筛不另存");
assert.match(ui, /saveJSON\("x_zyRecentFold", v\)/);
for (const k of ["zyrecentfold", "zyrecent", "zyrecentcard", "zyauthors"]) { assert.match(ui, new RegExp('"data-wk": "' + k + '"')); assert.match(ts, new RegExp('\\["' + k + '", "')); }
console.log("ok");
