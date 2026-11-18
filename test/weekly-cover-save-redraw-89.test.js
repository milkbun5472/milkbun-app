// 她 2026-11-18：周刊封面「搞个保存和重画」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
test("封面照、专访照共用一份保存／重画", () => {
  const w = R("js/weekly.js");
  assert.match(w, /function PhotoActs\(props\)/);
  assert.match(w, /window\.saveImgOriginal\(props\.photo, props\.saveName/);
  assert.match(w, /h\(PhotoActs, \{ photo: props\.photo, saveName: "周刊封面"/);
  assert.match(w, /h\(PhotoActs, \{ photo: e\.photo, saveName: "专访 "/);
  const ts = R("js/theme-studio.js");
  ["wklycoverredraw", "wklycoversave", "wklyivsave", "wklyivredraw"].forEach(k => assert.match(ts, new RegExp('\\["' + k + '", ')));
});
