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
  assert.match(a, /const genPhotoDiary = async \(charId, entry\) =>/);
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
