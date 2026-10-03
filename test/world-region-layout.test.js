const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const T = require(path.join(__dirname, "..", "js", "trpg.js"));
const map = fs.readFileSync(path.join(__dirname, "..", "js", "map.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 她 2026-10-03 群友：「如果可以调整每块地的大小和位置更好」
const R = () => [
  { name: "东区", terrain: "平原", adj: ["港口"], nodes: [{ name: "酒馆" }, { name: "市集" }] },
  { name: "港口", terrain: "水泽", adj: ["东区", "北山"], nodes: [{ name: "码头" }] },
  { name: "北山", terrain: "山地", adj: ["港口"], nodes: [{ name: "古庙" }] }];

test("手动挪过的那块落在她摆的位置；没动过的那几块跟以前一模一样", () => {
  const a = T.mapBuild("w1", R(), 360, 620, 40, 12);
  const moved = R(); moved[0].pos = { x: 0.2, y: 0.3 };
  const b = T.mapBuild("w1", moved, 360, 620, 40, 12);
  assert.equal(b.regions[0].cx, 72); assert.equal(b.regions[0].cy, 186);
  assert.equal(b.regions[0].moved, true);
  assert.deepEqual([b.regions[2].cx, b.regions[2].cy], [a.regions[2].cx, a.regions[2].cy], "没动的那块中心不许跟着跑");
});

test("放大缩小：团块跟着变，夹在 0.6~1.6", () => {
  const big = R(); big[1].size = 3;
  const b = T.mapBuild("w1", big, 360, 620, 40, 12);
  assert.equal(b.regions[1].size, 1.6);
});

test("图会重画：骨架键里有位置、大小、挨着谁、地形；界面有挪位置面板", () => {
  assert.match(map, /\(r\.adj \|\| \[\]\)\.join\("\+"\) \+ "\/" \+ \(r\.pos \?/);
  assert.match(map, /"到图上挪位置、调大小 ›"/);
  assert.match(map, /pos: null, size: 1/, "复位");
  assert.match(app, /if \(r\.name === oldName && "pos" in patch\)/);
});
