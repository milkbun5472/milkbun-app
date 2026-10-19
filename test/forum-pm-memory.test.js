// 私信和评论区记忆互通（群里 2026-10-18：「NPC 还是没有私信和评论区记忆共通，傻的」）
const test = require("node:test"), assert = require("node:assert");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
const a = app.indexOf("const forumPublicWith = th => {"), b = app.indexOf("const sendForumPM = async");
test("私信里现找评论区里她跟TA说过的：同一个号、两人都在的那层楼", () => {
  const mk = new Function("forumCommentsRef", "forumPostsRef", app.slice(a, b) + "; return forumPublicWith;");
  const posts = [{ id: "p1", title: "猫猫", board: "日常吧", authorName: "路人" }, { id: "p2", title: "别的", board: "日常吧", authorName: "路人" }];
  const comments = { p1: [{ authorName: "阿柒", content: "这猫好胖", ts: 1, replies: [{ authorType: "me", content: "胖才可爱", ts: 2 }, { authorType: "me", alt: true, content: "小号说的", ts: 3 }] }],
    p2: [{ authorName: "阿柒", content: "没人理我", ts: 4, replies: [] }] };
  const f = mk({ current: comments }, { current: posts });
  const t = f({ npcName: "阿柒", alt: false });
  assert.match(t, /《猫猫》你：这猫好胖/);
  assert.match(t, /《猫猫》她：胖才可爱/);
  assert.doesNotMatch(t, /小号说的/);
  assert.doesNotMatch(t, /没人理我/);
  assert.equal(f({ npcName: "x", charId: "c1" }), "");
});
test("私信回复、加微信两处都带上；评论区四路生成都认得私信过的人", () => {
  assert.equal((app.match(/forumPublicWith\(th\)/g) || []).length, 2);
  assert.match(app, /return forumBoardRuleLines\(board\) \+ \(pmKnown \? "\\n" \+ pmKnown : ""\)/);
});
