const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("论坛多选删帖：入口在右上角刷新那张单子里，选着时点帖是勾（她 2026-10-26）", () => {
  assert.match(ui, /onDeletePosts && \["多选", "点几帖勾上，一起收藏或删掉", \(\) => setPick\(\[\]\)\]/);
  assert.equal((ui.match(/onClick: \(\) => tapPost\(p\)/g) || []).length, 2);   // 单列、双列两种都接
  assert.match(ui, /function tapPost\(p\) \{ if \(pick\) setPick\(/);
  assert.match(ui, /"data-wk": "fopickdel"/);
  assert.match(ui, /里面有 " \+ mine \+ " 帖是你自己发的，删了回不来。/);
  assert.match(app, /onDeletePosts: ids => \{ const n = \(ids \|\| \[\]\)\.length; if \(!n\) return; forumDropPosts\(ids\);/);
  assert.match(fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8"), /"fopickbar"/);
});

test("论坛多选也能一起收藏（她 2026-10-26）", () => {
  assert.match(ui, /"data-wk": "fopickfav"/);
  assert.match(ui, /const bookmarkMany = ids =>/);
});
