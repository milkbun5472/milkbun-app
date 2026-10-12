const test = require("node:test"); const assert = require("node:assert");
const fs = require("fs");
const s = fs.readFileSync(__dirname + "/../js/screens.js", "utf8"), a = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("四宫格：一次生图、切格放大、单格拍清楚", () => {
  assert.match(s, /function GridCells\(\{ photo, rows, cols, onSharpen, sharpBusy \}\)/);
  assert.match(a, /const sceneFull = \(opt && opt\.grid \? GRID_LINE : ""\)/);
  assert.match(a, /opt && opt\.cellRef \? \[opt\.cellRef, char\.refPhoto, profile\.refPhoto\]/);
  assert.match(s, /big\.grid === "2x2" \? h\(GridCells/);
});
test("照片日记：只有点了才拍，一次生图", () => {
  assert.match(a, /const genPhotoDiary = async \(charId, entry\) =>/);
  // 只从日记页那颗按钮进来，别处不调
  assert.equal((a.match(/genPhotoDiary\b/g) || []).length, 2);
  assert.match(s, /onClick: \(\) => onPhotoDiary\(entry\)/);
});
