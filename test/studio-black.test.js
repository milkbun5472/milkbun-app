// 照相馆照片变一块黑、不能重拍（她 2026-11-04 转群友）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), scr = (fs.readFileSync(__dirname + "/../js/screens.js", "utf8") + "\n" + fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8"));
test("生图只回链接时当场下载成图；照相馆大图能照原样重拍", () => {
  assert.match(app, /\(function wrapSelfieBlob\(\) \{/);
  assert.match(app, /if \(out && !out\.blob && out\.url\) \{ try \{ const b = await imgOutBlob\(out\);/);
  assert.ok(app.indexOf("function wrapSelfieBlob") > app.indexOf("async function imgOutBlob"));
  assert.match(scr, /"data-wk": "studioreshoot"/);
  assert.match(scr, /onShoot\(\{ scene: sc, mine: big\.mine \|\| "", theirs: big\.theirs \|\| ""/);
});
