// 论坛：自己的帖能改字；小号能换头像、改粉丝数（群友 2026-10-31）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const app = R("app.js"), ui = R("screens-ui.js"), ts = R("theme-studio.js");
test("改帖只改自己的，只动标题正文", () => {
  assert.match(app, /x\.id === id && x\.authorType === "me" \? \{ \.\.\.x, title: t, body: b, editedTs: Date\.now\(\) \}/);
  assert.match(app, /onEditPost: editForumPost,/);
  assert.match(ui, /p\.authorType === "me" && onEditPost && h\("button", \{ "data-wk": "foeditpost"/);
});
test("小号头像、粉丝数存进 forumMe，主页和帖子都用", () => {
  assert.match(ui, /altAvatar: emAltAv \|\| "", \.\.\.\(emAltFans !== "" \? \{ altFollowers:/);
  assert.match(ui, /h\(AltAvatar, \{ seed: altNm, size: 62, src: forumMe && forumMe\.altAvatar \}\)/);
  assert.match(ui, /followers: \(onAlt \? forumMe && forumMe\.altFollowers : forumMe && forumMe\.followers\) \|\| 0/);
  assert.match(ts, /\["foeditpost",/);
  assert.match(ts, /\["foaltavatar",/);
});
