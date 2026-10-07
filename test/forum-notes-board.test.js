const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("没有笔记吧（她 2026-10-07 叫删）；双列开关管排版也管格式", () => {
  assert.doesNotMatch(scr, /"笔记吧"/);
  assert.doesNotMatch(app, /"笔记吧"/);
  assert.match(scr, /cardLayout \? h\("div", \{ "data-wk": "fonotes", style: \{ columnCount: 2/);
  assert.match(scr, /localStorage\.setItem\("x_forumLayout", v \? "cards" : "list"\)/);
  assert.match(app, /const forumFmtLine = \(\) => \{ let on = false; try \{ on = localStorage\.getItem\("x_forumLayout"\) === "cards"/);
  assert.match(app, /castLine \+ forumFmtLine\(\) \+ " 生成 3-5 条/);
  assert.match(app, /instruction: forumFmtLine\(\) \+ "以「" \+ char\.name/);
  assert.match(app, /instruction: forumFmtLine\(\) \+ "用户在贴吧搜索框"/);
});
test("排版开关在论坛「我」页，不在排序那排", () => {
  assert.match(scr, /isMe && h\("div", \{ className: "flex items-center gap-2 mt-3" \},\s*h\("span", [^)]*\}, "首页排版"\)/);
  assert.match(scr, /\(!inSub && nav === "home"\) && h\("div", \{ className: "shrink-0 grid grid-cols-3 gap-2 px-4 py-2"/);
});
test("卡片点开还是同一个帖子页", () => {
  assert.match(scr, /"data-wk": "fonote", role: "button", onClick: \(\) => openPost\(p\)/);
});
test("新帖、新回复默认收着，点了才展开", () => {
  assert.match(scr, /const \[newPostsOpen, setNewPostsOpen\] = useState\(false\);/);
  assert.match(scr, /newPostsOpen && forumNewCharPosts\.slice\(0, 8\)\.map\(/);
  assert.match(scr, /newRepliesOpen && forumUnreadRows\.slice\(0, 4\)\.map\(/);
});
