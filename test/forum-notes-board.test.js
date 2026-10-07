const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("笔记吧：内置的吧，有吧规、颜色、腔调", () => {
  assert.match(scr, /const FORUM_BOARDS = \[[^\]]*"笔记吧"/);
  assert.match(scr, /"笔记吧": \["标题要让人想点开/);
  assert.match(app, /"笔记吧": "「笔记吧」：小红书那种笔记/);
});
test("笔记吧列表是双列瀑布流，点开还是同一个帖子页", () => {
  assert.match(scr, /tab === "笔记吧" \? h\("div", \{ "data-wk": "fonotes", style: \{ columnCount: 2/);
  assert.match(scr, /"data-wk": "fonote", role: "button", onClick: \(\) => openPost\(p\)/);
});
test("新帖、新回复默认收着，点了才展开", () => {
  assert.match(scr, /const \[newPostsOpen, setNewPostsOpen\] = useState\(false\);/);
  assert.match(scr, /newPostsOpen && forumNewCharPosts\.slice\(0, 8\)\.map\(/);
  assert.match(scr, /newRepliesOpen && forumUnreadRows\.slice\(0, 4\)\.map\(/);
});
