// 花房那句「为什么是它」不截断（她 2026-09-24 截图：半句断在「就算哪天你」）
const fs = require("fs"), assert = require("assert");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const i = app.indexOf("const gardenPlantGen = async"), j = app.indexOf("coupleKeep(char.id", i);
assert.ok(i > 0 && j > i, "抠不出 gardenPlantGen");
const seg = app.slice(i, j);
assert.ok(!/why[^\n]*\.slice\(0, 80\)/.test(seg), "why 又被截了");
assert.match(seg, /\{ species: sp, why: why,/);
console.log("ok garden-why-no-cut");
