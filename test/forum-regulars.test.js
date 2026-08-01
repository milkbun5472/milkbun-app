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

test("熟面孔能记住与用户公开账号碰过几次，但不保存正文或私生活", () => {
  assert.match(app, /saveJSON\("x_forumPublicTies", \{ version: 1, items: \{\} \}\)/);
  assert.match(app, /encounters: Math\.min\(999/);
  assert.match(app, /【与用户公开账号的既往碰面】/);
  assert.match(app, /不能声称知道她的私生活/);
  const helper = app.match(/const touchForumPublicTie = npcId => \{([\s\S]*?)\n  \};/);
  assert.ok(helper);
  assert.doesNotMatch(helper[1], /content|body|私聊|memLib|memory/);
  assert.match(app, /if \(post\.authorType === "npc"\) touchForumPublicTie\(post\.authorId\)/);
  assert.match(app, /targetFloor && targetFloor\.authorType === "npc"/);
});

test("论坛延迟楼层按帖子保存已读水位，不再每 30 秒全站误标已读", () => {
  assert.match(screens, /x_forumReadCursors/);
  assert.match(screens, /从旧版本升级时，把升级前已经露出的旧楼层当作读过/);
  assert.match(screens, /Number\(x\.visibleAt\) <= Date\.now\(\)/);
  assert.match(screens, /const unreadFloors = postId/);
  assert.match(screens, /if \(!open \|\| !open\.id\) return;[\s\S]{0,80}?markPostRead\(open\.id\)/);
  assert.match(screens, /setInterval\(\(\) => setForumNow\(Date\.now\(\)\), 30000\)/);
  assert.doesNotMatch(screens, /setInterval\(\(\) => \{ setForumNow\(Date\.now\(\)\); markSeen\(\); \}, 30000\)/);
});

test("论坛帖子卡、版块标签与页头展示到点的新回复数", () => {
  assert.match(screens, /"\+" \+ unread \+ " 新回复"/);
  assert.match(screens, /"论坛 · " \+ forumUnreadTotal \+ " 条新回复"/);
  assert.match(screens, /b \+ \(count > 0 \? " · " \+ count : ""\)/);
});

test("回复我的只认明确直达证据，并可逐条跳到原楼层", () => {
  assert.match(app, /replyToMe: true/);
  assert.match(app, /authorType: "me", authorId: "me", content: text, ts: Date\.now\(\)/);
  assert.match(screens, /p\.authorType === "me" && f\.authorType !== "me"/);
  assert.match(screens, /r\.replyToMe \|\| f\.authorType === "me"/);
  assert.match(screens, /document\.getElementById\("forum-floor-" \+ n\.floorId\)/);
});

test("回复通知有独立已读账本、红点和通知页，不会污染私信", () => {
  assert.match(screens, /x_forumNoticeEpoch/);
  assert.match(screens, /x_forumNoticeRead/);
  assert.match(screens, /\["notice", IPulse, "回复"\]/);
  assert.match(screens, /title = "回复我的"/);
  assert.match(screens, /unreadNoticeCount > 99 \? "99\+" : unreadNoticeCount/);
});

test("论坛支持最新、正在聊与热榜三种纯本地时间线", () => {
  assert.match(screens, /useState\("active"\).*active \| latest \| hot/);
  assert.match(screens, /\[\["active", "正在聊"\], \["latest", "最新发帖"\], \["hot", "热榜"\]\]/);
  assert.match(screens, /if \(feedSort === "latest"\)/);
  assert.match(screens, /if \(feedSort === "hot"\) return postHotScore/);
});

test("普通网友头像可进入只含公开足迹的主页，匿名身份仍不可追踪", () => {
  assert.match(screens, /const \[npcProfile, setNpcProfile\]/);
  assert.match(screens, /a\.authorType === "npc" && !anon && a\.authorId/);
  assert.match(screens, /if \(!a \|\| a\.anon \|\| a\.authorType !== "npc"/);
  assert.match(screens, /常驻熟面孔/);
  assert.match(screens, /路过网友/);
  assert.match(screens, /公开回帖足迹/);
  assert.match(screens, /x_forumPublicTies/);
  assert.match(screens, /主页只展示公开发言/);
});

test("正在聊只用已经露出的楼层顶帖，未来排队楼层不会提前泄漏", () => {
  const activity = screens.match(/const postLastActivity = p =>([\s\S]*?)\n  const postHotScore/);
  assert.ok(activity, "missing activity sorter");
  assert.match(activity[1], /filter\(forumVisible\)/);
  assert.match(activity[1], /floorArrivedAt\(f\)/);
  assert.match(screens, /新回复会把旧帖顶回来/);
});

test("热榜由互动量与时间衰减机械计算，不新增模型调用", () => {
  const hot = screens.match(/const postHotScore = p => \{([\s\S]*?)\n  \};/);
  assert.ok(hot, "missing hot score");
  assert.match(hot[1], /replyCount/);
  assert.match(hot[1], /likeCount/);
  assert.match(hot[1], /rtCount/);
  assert.match(hot[1], /Math\.pow\(ageHours \+ 2, 1\.18\)/);
  assert.doesNotMatch(hot[1], /callAI|runProbe|fetch/);
});
