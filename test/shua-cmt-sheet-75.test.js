// 刷刷竖着刷：点评论从底下升一层，不换页（她 2026-10-15）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(__dirname + "/../js/shua.js", "utf8");
test("竖着刷点评论开 sheet，评论层画在页面上面、点露出来的视频收起", () => {
  assert.match(src, /onComments: \(\) => setSheet\(v\.id\)/);
  assert.match(src, /"data-wk": "shuacmtsheet"/);
  assert.match(src, /h\(CommentsPage, \{ v: sheetV, t, P, sheet: true,/);
  assert.match(src, /onClick: \(\) => setSheet\(null\), "aria-label": "收起评论"/);
  assert.match(src, /if \(dy > 50\) onBack\(\);/);
});
test("单条视频、我的作品、收藏都挂评论层；主页的格子点进单条视频而不是整页评论", () => {
  assert.match(src, /return withSheet\(h\("div", \{ "data-wk": "shuaone"/);
  assert.match(src, /return withSheet\(h\("div", \{ "data-wk": "shuafavs"/);
  assert.match(src, /return withSheet\(h\("div", \{ "data-wk": "shuamine"/);
  assert.ok(!/setPage\(\{ kind: "comments"/.test(src));
});
