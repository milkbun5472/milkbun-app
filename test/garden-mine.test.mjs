import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const app = fs.readFileSync("js/app.js", "utf8"), scr = (fs.readFileSync("js/screens.js", "utf8") + "\n" + fs.readFileSync("js/screens-ui.js", "utf8"));
test("我种的花和他种的走同一条路", () => {
  assert.match(app, /const plantPot = \(char, o\)/);
  assert.match(app, /gardenPlantGen[\s\S]{0,4000}plantPot\(char, \{[^}]*by: "char"/);
  assert.match(app, /const gardenPlantMine = [\s\S]{0,600}plantPot\([^)]*by: "me"/);
  assert.match(app, /plantPot = [\s\S]{0,2000}coupleKeep\(/);
  assert.match(app, /gardenMineHint/);
});
test("生图开关接到花房页", () => {
  assert.match(app, /const drawGarden = async/);
  assert.match(app, /onGardenPlantMine: gardenPlantMine, onGardenDraw: drawGarden, onGardenDrawToggle: setGardenDraw/);
  assert.match(scr, /function CoupleGarden\(\{[^}]*onPlantMine, onDraw, onDrawToggle, drawing/);
  assert.match(scr, /"data-part": "gardenmine"/);
  assert.match(scr, /"data-part": "gardendraw"/);
  assert.match(scr, /onDrawToggle: on => onGardenDrawToggle && onGardenDrawToggle\(partner\.id, on\)/);
});
