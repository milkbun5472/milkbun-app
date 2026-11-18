// 她 2026-11-18：周刊封面「搞个保存和重画」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
test("封面照底下挨着放保存、重画", () => {
  const w = R("js/weekly.js");
  assert.match(w, /\["wklycoversave", "保存到手机"[\s\S]{0,500}window\.saveImgOriginal\(props\.photo, "周刊封面"\)/);
  assert.match(w, /\["wklycoverredraw", props\.shooting \? "重画中" : "重画", "[^"]+", props\.shooting \? null : props\.onShoot\]/);
  assert.match(R("js/theme-studio.js"), /\["wklycoverredraw", /);
});
