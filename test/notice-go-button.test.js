// 公告跳转键（她 2026-11-10：「在公告那里加一个跳转键跳进集邮社」）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
const cut = (s, from, to) => { const i = s.indexOf(from); assert.ok(i >= 0, from); const j = s.indexOf(to, i + from.length); return s.slice(i, j < 0 ? undefined : j); };

test("openNoticeGo：带 goTab 的邮票册公告先记下落在哪一页，再跳屏", () => {
  const fn = cut(src, "function openNoticeGo(", "function noticeSeenIds(");
  const calls = [];
  global.window = { __openFromNotif: (c, s) => calls.push([c, s, window.__stampsOpen]) };
  new Function("window", fn + "\nopenNoticeGo({ go: 'stamps', goTab: 'duel' }); openNoticeGo({ go: 'nest' }); openNoticeGo({});")(global.window);
  assert.deepStrictEqual(calls[0], [null, "stamps", { tab: "duel" }]);
  assert.strictEqual(calls[1][1], "nest");
  assert.strictEqual(calls.length, 2);
});

test("「更新了什么」两张公告卡都有跳转键，都走同一处 openNoticeGo", () => {
  const unread = cut(src, "function NoticeUnread(", "function NoticeArchive(");
  const archive = cut(src, "function NoticeArchive(", "function ChangelogView(");
  assert.match(unread, /"clnewgo"[\s\S]*?openNoticeGo\(n\)/);
  assert.match(archive, /"clnoticego"[\s\S]*?openNoticeGo\(n\)/);
});
