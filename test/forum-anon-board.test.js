// 匿名吧里谁都没有 id（群友 2026-10-01）——显示层一次收口
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");

const s = src("screens.js");
const fn = s.slice(s.indexOf("function forumAnonView("), s.indexOf("function ForumAnonWrap("));
const forumAnonView = new Function(fn + "; return forumAnonView;")();

test("匿名吧的帖、楼、楼中楼一律匿名；别的吧不动", () => {
  const posts = [
    { id: "a", board: "匿名吧", authorType: "npc", authorId: "npc_x", authorName: "三楼的猫", authorHandle: "third_floor_cat" },
    { id: "b", board: "日常吧", authorType: "npc", authorId: "npc_y", authorName: "路人甲", authorHandle: "lurenjia" }
  ];
  const comments = {
    a: [{ authorType: "npc", authorName: "末班车乘客", authorHandle: "last_bus", replies: [{ authorType: "me", authorName: "Lisa", authorHandle: "lisa" }] }],
    b: [{ authorType: "npc", authorName: "路人乙", authorHandle: "lry" }]
  };
  const v = forumAnonView(posts, comments);
  assert.strictEqual(v.posts[0].anon, true);
  assert.strictEqual(v.posts[0].authorName, "匿名用户");
  assert.strictEqual(v.comments.a[0].authorName, "匿名用户");
  assert.strictEqual(v.comments.a[0].authorHandle, "anonymous");
  assert.strictEqual(v.comments.a[0].replies[0].authorName, "匿名者");
  assert.strictEqual(v.posts[1].authorName, "路人甲");
  assert.strictEqual(v.comments.b[0].authorName, "路人乙");
  assert.strictEqual(posts[0].authorName, "三楼的猫", "不许改到存档里的原对象");
});

test("论坛走的是带匿名收口的那一层", () => {
  assert.match(src("app.js"), /React\.createElement\(ForumAnonWrap, \{/);
  assert.match(s, /return forumAnonView\(posts, props\.comments\);/);
});

test("角色的真实经历只给 TA 本人用：路人只看得见帖子正文", () => {
  const a = src("app.js");
  const i = a.indexOf("const forumCharGrounding = ");
  const g = a.slice(i, a.indexOf("const forumCommentProbe = ", i));
  assert.match(g, /路人、熟面孔、其他角色都【只看得见帖子标题和正文】/);
});
