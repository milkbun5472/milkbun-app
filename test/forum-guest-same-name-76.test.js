// 论坛路人同名就是同一个人（2026-10-29 截图：同一楼「红烧铁头娃」两次，两个主页、两个账号名）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
test("forumGuestOf 按名字记下 id 和账号名，再出现照用", () => {
  const a = app.indexOf("const forumGuestOf = "), body = app.slice(a, a + 3000);
  assert.match(body, /x_forumGuests/);
  assert.match(body, /if \(book\[given\] && book\[given\]\.id\) return \{ id: book\[given\]\.id, name, handle: book\[given\]\.handle \|\| handle \}/);
});
test("路人主页把同名的旧足迹合在一起", () => {
  const a = ui.indexOf("function npcProfileView()"), body = ui.slice(a, a + 2500);
  assert.match(body, /const isHim = \(aid, aname\) =>/);
  assert.equal((body.match(/isHim\([pfr]\.authorId, [pfr]\.authorName\)/g) || []).length, 3);
});
