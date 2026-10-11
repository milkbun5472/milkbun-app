// 论坛「回复」一键已读（群友 2026-10-11）：走同一个 markNoticesRead，不另记一份
const test = require("node:test");
const assert = require("node:assert/strict");
const s = require("node:fs").readFileSync(require.resolve("../js/screens.js"), "utf8");
test("回复页顶上有全部标为已读，用的是同一个 markNoticesRead", () => {
  assert.match(s, /"data-wk": "forumnoticeallread", onClick: \(\) => markNoticesRead\(forumNotices\.map\(n => n\.id\)\)/);
  assert.match(s, /unreadNoticeCount > 0 && h\("div"/);
});
