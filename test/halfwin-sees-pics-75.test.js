// 半窗里他也看得到屏幕上露着的图的描述（她 2026-10-13：「开着半屏看他日记他能看到照片描述吗」）
const assert = require("node:assert");
const fs = require("node:fs"), path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
assert.match(app, /querySelectorAll\("\[data-desc\]"\)/);
assert.match(app, /（她屏幕上露着的图）/);
assert.match(app, /photoStrip: \{ imgKey, imgUrl, ts: Date\.now\(\), desc: stripDesc \}/);
assert.match(scr, /"data-desc": desc/);
console.log("ok");
