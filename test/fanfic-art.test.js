const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fic = (fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "..", "js", "fanfic-core.js"), "utf8"));
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
// 她 2026-10-16：同人文生图——头图、画手产粮、出本，都是点了才画
test("三样都只在她点的那颗键里画，app 那头接得上", () => {
  assert.match(app, /onFicImage: ficImage,/);
  assert.match(fic, /onFicImage: props\.onFicImage\n/);
  ["head", "book", "fanart"].forEach(k => assert.match(fic, new RegExp('drawArt\\("' + k + '"\\)')));
  assert.equal((fic.match(/drawArt\(/g) || []).length, 4, "多出来的调用八成是自动画");
});
test("画手产粮落在书评区那一条上，出本存本子封面和书签", () => {
  assert.match(fic, /painter: true, art: k, artChap: chapIdx/);
  assert.match(fic, /x\.book = \{ cover: cover, mark: mark \|\| "", ts: Date\.now\(\) \}/);
  assert.match(fic, /const thumb = \(f\.book && f\.book\.cover\) \|\| \(f\.art && f\.art\.head\)/);
});
test("出图是插画不是照片，CP 有参考照就锁脸，本子封面走海报排字但不写「上映」", () => {
  const seg = app.slice(app.indexOf("const ficImage = async"), app.indexOf("const studioOverlay = async"));
  assert.match(seg, /不是照片/);
  assert.match(seg, /refs\.length \? refs : null/);
  assert.match(seg, /dateLine: "同人本/);
});
