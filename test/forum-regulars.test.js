const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

test("论坛常驻网友使用稳定 id，并且匿名身份不与公开身份混池", () => {
  const block = app.match(/const FORUM_NPC_REGISTRY = \[([\s\S]*?)\n\];/);
  assert.ok(block, "missing forum NPC registry");
  const ids = [...block[1].matchAll(/id: "([^"]+)"/g)].map(m => m[1]);
  assert.ok(ids.length >= 12, "常驻网友数量不足");
  assert.equal(new Set(ids).size, ids.length, "常驻网友 id 必须唯一");
  assert.match(app, /exact\.length \? exact : FORUM_NPC_REGISTRY\.filter\(n => !\(n\.boards \|\| \[\]\)\.includes\("匿名吧"\)\)/);
});

test("发帖、评论和楼中楼都按 npcId 回填稳定公开身份", () => {
  assert.match(app, /authorId: npc\.id, authorType: "npc"/);
  assert.match(app, /authorName: npc\.name, authorHandle: npc\.handle/);
  assert.match(app, /同一 npcId 必须保持对应习惯/);
  assert.match(app, /schemaHint: "\{\\"comments\\":\[\{\\"npcId\\"/);
  assert.match(app, /const rn = rc \? null : forumPublicNpcOf\(r,/);
});

test("常驻网友档案只存公开习惯，不接入私聊或记忆库", () => {
  const block = app.match(/const FORUM_NPC_REGISTRY = \[([\s\S]*?)\n\];/)[1];
  assert.doesNotMatch(block, /memory|memLib|chat|private|私聊|记忆/);
  assert.match(app, /saveJSON\("x_forumNpcs", \{ version: 1, items: FORUM_NPC_REGISTRY \}\)/);
});

test("角色大号、固定小号与匿名身份是三条独立展示路径", () => {
  assert.match(app, /const FORUM_ALT_NAMES = \[/);
  assert.match(app, /const altName = m\.altName \|\|/);
  assert.match(app, /authorType: "character_alt"/);
  assert.match(app, /authorType: "character_anon"/);
  assert.match(app, /identity=main（大号）、alt（固定小号）或 anonymous/);
});

test("角色主动论坛帖包含匿名周期，而不是只能靠刷新网友帖", () => {
  assert.match(app, /const forceAnon = myAutoPosts\.length >= 2/);
  assert.match(app, /const board = forceAnon \? "匿名吧"/);
  assert.match(app, /"兴趣": "兴趣吧", "脑洞": "脑洞吧", "匿名": "匿名吧"/);
});

test("主页增加兴趣与脑洞两个结构不同的板块", () => {
  assert.match(screens, /"兴趣吧", "脑洞吧", "匿名吧"/);
  assert.match(app, /"兴趣吧": "「兴趣吧」：聊作品、游戏、吃喝、设备、收藏、学习进度和具体爱好/);
  assert.match(app, /"脑洞吧": "「脑洞吧」：发假设题、投票、接龙、挑战/);
});

test("论坛批次允许常驻熟面孔与一次性路人混合", () => {
  assert.match(app, /guestName、guestHandle/);
  assert.match(app, /const forumGuestOf =/);
  assert.match(app, /const forumPublicNpcOf =/);
  assert.match(app, /同一批至少有 1 个一次性路人/);
});

test("每个角色有稳定论坛习惯，并参与发帖与评论决策", () => {
  assert.match(app, /const FORUM_HABIT_PRESETS = \[/);
  assert.match(app, /boardPrefs: Array\.isArray\(m\.boardPrefs\)/);
  assert.match(app, /【Ta 长期稳定的论坛习惯】常逛：/);
  assert.match(app, /论坛习惯：常逛/);
  assert.match(app, /\(mode \|\| m\.identityBias\) === "alt"/);
});

test("角色主页只展示公开的常逛板块，不展示小号归属", () => {
  assert.match(screens, /"常逛"/);
  assert.match(screens, /meta\.boardPrefs\.map/);
  const profileHabit = screens.match(/!isMe && Array\.isArray\(meta\.boardPrefs\)[\s\S]{0,900}?meta\.participation/);
  assert.ok(profileHabit, "missing public forum habit row");
  assert.doesNotMatch(profileHabit[0], /altName|altHandle|小号/);
});

test("常驻网友之间有稳定公开关系网，且明确不进入私聊记忆", () => {
  assert.match(app, /const FORUM_NPC_RELATIONS = \[/);
  assert.match(app, /saveJSON\("x_forumNpcRelations", \{ version: 1, items: FORUM_NPC_RELATIONS \}\)/);
  assert.match(app, /【熟面孔之间已经存在的公开交情】/);
  assert.match(app, /自然接旧梗、附和或抬杠/);
  const block = app.match(/const FORUM_NPC_RELATIONS = \[([\s\S]*?)\n\];/);
  assert.ok(block);
  assert.doesNotMatch(block[1], /私聊|memory|memLib/);
});
