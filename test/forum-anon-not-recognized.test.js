// 群友 2026-10-10：两个角色匿名回帖、现实里熟，一个张口喊「陆大人」——匿名楼中楼漏了
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

test("公共那句管到「别人也认不出」；回谁那栏不写真名", () => {
  const i = app.indexOf("  const FORUM_ID_VOICE = "), j = app.indexOf("  const FTOK = {", i);
  assert.ok(i > 0 && j > i);
  assert.match(app.slice(i, j), /小号和匿名【别人也认不出】/);
  assert.doesNotMatch(app, /网名或角色名/, "to 那栏又允许写真名了");
  assert.match(app, /匿名的就是「匿名用户」，小号就是那个小号网名/);
});

test("角色会回帖的三条路都带上这句：首批楼、后续几波、她那条底下的楼中楼", () => {
  assert.match(app, /FORUM_ID_VOICE \+ "小号\/匿名的文字仍必须贴本人/);
  assert.match(app, /who2 \+ " " \+ FORUM_ID_VOICE \+ FORUM_THREAD_LINE/);
  assert.match(app, /forumMaskNote\(myMaskTag\(post\), forumActiveChars\(\)\) : ""\) \+ FORUM_ID_VOICE \+ "生成 2-5 条接在后面的楼中楼回复/);
});
