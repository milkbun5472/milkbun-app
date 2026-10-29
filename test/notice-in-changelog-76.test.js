// 公告进更新日志（她 2026-10-29：「你把搬家公告显示在更新日志呢，点击一次就没了，以后公告也是」）
//   在这之前公告只有开机弹窗一条路，搬家那则还按天换 id、一天弹一次。
//   现在：没点过「知道了」的公告整则摊在「更新了什么」最上面，点一次收起来，收起来也还在「秋秋的公告」里。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const UI = fs.readFileSync(path.join(__dirname, "..", "js/screens-ui.js"), "utf8");

const cut = (from, to) => {
  const i = UI.indexOf(from), j = UI.indexOf(to, i);
  assert.ok(i > 0 && j > i, "抠不出 " + from);
  return UI.slice(i, j);
};

test("没看过的公告自己是一块，摊在「更新了什么」最上面", () => {
  assert.match(UI, /function NoticeUnread\(/, "没有这个组件");
  const view = cut("function ChangelogView(", "\nfunction ");
  const a = view.indexOf("h(NoticeUnread, null)"), b = view.indexOf("h(NoticeArchive, null)");
  assert.ok(a > 0, "更新日志那一页没画没看过的公告");
  assert.ok(b > a, "没看过的那几则要排在折着的「秋秋的公告」前面");
});

test("点一次就没了：记在跟弹窗同一个本机键上，不进存档不上云", () => {
  const c = cut("function NoticeUnread(", "function ChangelogView(");
  assert.match(UI, /const NOTICE_SEEN = "qq_noticeSeen"/, "换了键名就跟弹窗对不上了，会再出现一次");
  assert.match(c, /markNoticeSeen\(n\.id\)/, "那颗按钮没把这一则记成看过");
  assert.match(c, /setSeen\(noticeSeenIds\(\)\)/, "点完没重算，卡片不会消失");
});

test("已经弹过「收到了」的，这儿不再出现一次", () => {
  const c = cut("function NoticeUnread(", "function ChangelogView(");
  assert.match(c, /seen\.indexOf\(n\.id\) < 0/, "没按看过筛");
});

test("设置首页那颗红点：有没看过的公告也亮", () => {
  assert.match(UI, /function noticeUnreadCount\(/);
  assert.match(UI, /dot: changelogUnseen\(clList\) \|\| noticeUnreadCount\(\) > 0/, "红点只看日志、不看公告");
});
