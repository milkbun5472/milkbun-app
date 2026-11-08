const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
// 她 2026-11-08：发一张两个人的合照让他换情头——竖着拍的合照原来被上下切，他那半里挤着两个人
test("合照换情头：他说怎么切（lr/tb），竖图左右切时方块往脸那头靠", () => {
  assert.match(app, /两个人并排的合照也算：一人一半切开/);
  assert.match(app, /splitPairImage\(_pairSplit\.imageRef, parsed\.pairAvatar\.cut\)/);
  assert.match(app, /wide = cut === "lr" \? true : cut === "tb" \? false : W >= H/);
  assert.match(app, /const up = wide && sh > s \? 0\.25 : 0\.5;/);
});
