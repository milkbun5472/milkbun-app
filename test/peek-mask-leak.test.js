// 查手机：别的面具不给看，却从「发过的图」读到名字、录像里点进了那人的聊天（群友 2026-10-09）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

test("发过的图只算看得见的人；录像点到藏起来的人不打开；回放也挡", () => {
  const pics = A.slice(A.indexOf('if (on("pics")) {'), A.indexOf('if (on("pics")) {') + 600);
  assert.match(pics, /filter\(c => c\.id === viewerId \|\| shownId\(c\.id\)\)/);
  const open = A.slice(A.indexOf("const peekOpen = "), A.indexOf("const peekBack = "));
  assert.match(open, /window\.__peekHide/);
  assert.match(open, /&& ok\(x\.id\)/);
  assert.match(A, /if \(how === "replay"\) \{ try \{ window\.__peekHide = new Set\(peekMaskOthers\(charId\)/);
});
