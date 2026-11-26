// 群友 2026-11-25：他翻她手机自己改了备注、置顶了自己，下一次翻当成是她改的、又置顶一遍——原来只记看过什么，不记做过什么
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("翻手机：前几次自己动过的手脚摆给他", () => {
  assert.match(ap, /你前几次翻她手机时自己动过的手脚（是你自己干的，到现在还是这样）/);
  assert.match(ap, /\(loadJSON\("x_peekLog", \{\}\) \|\| \{\}\)\[charId\] \|\| \[\]\)\.slice\(0, 4\)/);
});
