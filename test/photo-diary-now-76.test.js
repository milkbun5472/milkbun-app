// 照片日记拍的是这一天、他现在的样子，回想的往事不拍（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("三格只拍这一天当下的事", () => {
  assert.match(s, /他就是现在这个年纪、现在的样子；日记里回想起的往事（小时候、以前、梦里）只是他心里想的，不拍成画面/);
});
