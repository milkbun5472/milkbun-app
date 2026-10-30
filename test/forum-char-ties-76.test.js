// 角色之间的论坛碰面账（2026-10-30：「做吧 只记次数和语气」）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("只记次数、调子、时间，同帖同一对只算一次，只认大号", () => {
  const a = app.indexOf("const noteForumCharMeets = "), body = app.slice(a, a + 1800);
  assert.match(body, /x_forumCharTies/);
  assert.match(body, /x.authorType === "npc" && forumRegularOf/);
  assert.match(body, /forumFixedPair/);
  assert.match(body, /if \(posts\.includes\(postId\)\) return;/);
  assert.doesNotMatch(body, /content/);
});
test("存楼层时记账；没有关系线的两人才拿碰面账说一句", () => {
  assert.match(app, /try \{ noteForumCharMeets\(next\); \} catch \(e\) \{\}\n    if \(saveJSON\("x_forumComments", next\)\)/);
  const a = app.indexOf("const forumRelLines = "), body = app.slice(a, a + 2000);
  assert.match(body, /forumCharTieLine\(a, b\)/);
});
test("meetTone 从模型那条带到角色回复上", () => {
  assert.match(app, /顺手标 meetTone/);
  assert.equal((app.match(/TIE_TONES\[(x|r)\.meetTone\]/g) || []).length, 6);
});
test("熟面孔的碰面账挂进论坛人口那一段，四路都有", () => {
  assert.match(app, /const ties = forumNpcRelationLines\(board\)\.concat\(forumRegularMeetLines\(board\)\)/);
});
