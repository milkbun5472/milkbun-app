const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 她 2026-08-25：「查查现在论坛逻辑合不合理怎么搞更活人」。
// 查下来大半其实挺活（帖子按时间铺开、熟面孔记得她、NPC 之间有交情、角色会自己去发帖），
// 死点是同一件事的三个面：她发的帖没人理、红点不认「回我的」、她的帖数字永远是 0。

test("A · 她发帖之后要排一张时间表，陆续有人来回", () => {
  const post = app.slice(app.indexOf("const postMyForum ="), app.indexOf("const postMyForum =") + 900);
  assert.match(post, /forumMineEnqueue\(rec\.id\)/, "发完就该排期，不能只弹个 toast 就结束");
  assert.match(app, /const FORUM_MINE_WAVES_MS = \[3 \* 60000, 22 \* 60000, 70 \* 60000, 3 \* 3600000, 8 \* 3600000\]/,
    "五波：3 分钟到 8 小时，像真论坛那样陆续来");
  const tick = app.slice(app.indexOf("const forumMineTick"), app.indexOf("const forumMineBumpSocial"));
  assert.match(tick, /bgActiveRef\.current \|\| active/, "走后台池，比聊天线便宜");
  assert.match(tick, /if \(forumWaveBusyRef\.current\) return;/, "一次只推进一波，别同秒并发烧调用");
  assert.match(tick, /\.slice\(0, 2\)/, "一波最多 1~2 层");
  assert.match(tick, /if \(!post\) \{ const q2 = forumMineQueue\(\); delete q2\[hitId\]/, "帖子被淘汰了要清队列，别空转");
  assert.match(tick, /q4\[hitId\]\.waves\[hitIdx\] = Date\.now\(\) \+ 10 \* 60000/, "失败不推进 done，往后挪十分钟重试");
});

test("B · 红点要认「有人回我」，不能只认「角色发帖」", () => {
  const tick = app.slice(app.indexOf("const forumMineTick"), app.indexOf("const forumMineBumpSocial"));
  assert.match(tick, /notifyApp\("forum"\)/);
  assert.match(tick, /title: "论坛有人回你了"/);
  // 原来全代码只有一处 notifyApp("forum")，条件是某个角色自己发了帖
  assert.ok((app.match(/notifyApp\("forum"\)/g) || []).length >= 2);
});

test("C · 她的帖不能永远挂着 0", () => {
  const fn = app.slice(app.indexOf("const forumMineBumpSocial"), app.indexOf("useEffect(() => {\n    if (!loaded) return;\n    const first = setTimeout(forumMineTick"));
  assert.match(fn, /likeCount: \(x\.likeCount \|\| 0\) \+ added/);
  assert.match(fn, /viewCount: \(x\.viewCount \|\| 0\) \+ added/);
  const tick = app.slice(app.indexOf("const forumMineTick"), app.indexOf("const forumMineBumpSocial"));
  assert.match(tick, /bumpReplyBy\(hitId, more\.length \+ subInserts\.length\)/, "回复数用真实新增，不是编的");
});

// 她第二问：「论坛行为怎么喂回聊天比较合理」。
// 原来 forumEcho 只喂【角色自己发的帖】——她发的帖角色一个字都不知道，
// 可他明明关注着她的账号。
test("她公开发的帖要让角色刷到，匿名和小号一个字都不许漏", () => {
  const echo = app.slice(app.indexOf("forumEcho: (() => {"), app.indexOf("// 查手机内容"));
  assert.match(echo, /p\.authorType === "me" && !p\.anon && p\.board !== "匿名吧"/,
    "只给公开的；匿名吧和小号正是她不想让人对上号的东西");
  assert.match(echo, /还没什么人回/, "没人回也要如实说，别只在有人回时才提");
  // 提示词那半边也要罩得住两种东西，否则角色会把她的帖当成自己发的
  assert.match(engine, /自己用公开账号发的帖\*\*——你关注着 TA 的账号，刷到了/);
  assert.match(engine, /TA 匿名发的、用小号发的，你【根本看不见】/);
  assert.match(engine, /别一上来就汇报「我看到你发帖了」/, "刷到了顺口一提，不是交作业");
});
