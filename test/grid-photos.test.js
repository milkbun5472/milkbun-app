const test = require("node:test"); const assert = require("node:assert");
const fs = require("fs");
const s = fs.readFileSync(__dirname + "/../js/screens.js", "utf8"), a = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("四宫格：一次生图、切格放大、单格拍清楚", () => {
  assert.match(s, /function GridCells\(\{ photo, rows, cols, onSharpen, sharpBusy \}\)/);
  assert.match(a, /const sceneFull = (COMIC_LINE \+ )?\(opt && opt\.grid \? GRID_LINE : ""\)/);
  assert.match(a, /firstRef \? \[firstRef, char\.refPhoto, profile\.refPhoto\]/);
  assert.match(s, /big\.grid === "2x2" \? h\(GridCells/);
});
test("照片日记：只有点了才拍，一次生图", () => {
  assert.match(a, /const genPhotoDiary = async \(charId, entry(, wish)?\) =>/);   // v75.970 多一个 wish：改了画面描述再画
  // 只从日记页那颗按钮进来，别处不调
  assert.equal((a.match(/genPhotoDiary\b/g) || []).length, 2);
  assert.match(s, /onClick: \(\) => onPhotoDiary\(entry\)/);
  assert.match(a, /scheduleTextFor\(char, schedDayKey\(new Date\(entry\.ts\)\)\)/);   // 三格参考那天的日程
});
// 照着真实白边切，不再死按等分（她 2026-10-12 截图）；照片日记三格机位要错开
{ const s2 = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "screens.js"), "utf8");
  const a2 = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
  require("node:assert").match(s2, /const whiteness = \(horiz, i\) =>/);
  require("node:assert").match(a2, /不要三格都从高处往下拍/); }
{ const a3 = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
  require("node:assert").match(a3, /const wearsOnDay = \(charId, ts\) =>/);
  require("node:assert").match(a3, /entry\.wears = w/);
  require("node:assert").match(a3, /每一格穿那个时刻对应的那一身/); }
{ const a4 = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
  require("node:assert").match(a4, /纯侧脸、背影最多一格/);
  require("node:assert").match(a4, /晚上不等于睡觉/); }
// 照片日记三格各掷一个机位（她 2026-10-13：「为什么又是同一个角度！」——整张只掷一个，三格全被钉成一样）
{ const e5 = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "engine.js"), "utf8");
  const a5 = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
  require("node:assert").match(e5, /else if \(opts\.panels > 1\)/);
  require("node:assert").match(a5, /panels: 3,\s*lead: "【最重要·整张图的版式】/); }
// 旧日记别套上今天的衣服（她 2026-10-13）
{ const a6 = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
  require("node:assert").match(a6, /\(!isToday \|\| dayWears\.length\) \? \{ \.\.\.st0, wearing: "", wearingUpdatedAt: 0 \}/); }
// 每格机位跟着那一刻的事自己定，池子只当灵感；角度不重复、至少两格看得清脸（她 2026-10-13：「这种应该自由一点」）
{ const e7 = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "engine.js"), "utf8");
  require("node:assert").match(e7, /const ideas = pool\.slice\(0, 6\)/); require("node:assert").match(e7, /至少两格要看得清他的脸/); require("node:assert").doesNotMatch(e7, /let pick = \[R\(WIDE\)/); }
