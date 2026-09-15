// 她 2026-09-15 让我评论坛还有哪儿死板。她自己先纠正了两条：
//   · 「固定 NPC 出场太多」v67.36 已经翻过来了（熟面孔必须点名，点不上按路人落账）；
//   · 「角色在论坛上遇不见彼此」也早有了（角色能在别人帖下冒泡、挑大号/小号/匿名）。
// 剩下三条这一刀做了：① 熟面孔跟她的交情只有「见过几次」② 数字死的 ③ 帖子之间没关系。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// ── ① 碰面账：从一个数变成四个数 ──
const tieFns = (() => {
  const i = app.indexOf("  const TIE_TONES = {");
  const j = app.indexOf("  const forumNpcRule = board => {");
  const src = app.slice(i, j);
  const store = { version: 1, items: {} };
  const ctx = {
    FORUM_NPC_REGISTRY: [{ id: "n1", name: "老张", handle: "z", boards: ["日常吧"] },
      { id: "anon1", name: "匿", handle: "a", boards: ["匿名吧"] }],
    forumPublicTies: () => store, saveJSON: () => {},
    forumNpcPool: () => ctx.FORUM_NPC_REGISTRY.filter(n => n.id === "n1"),
    forumMe: { handle: "阿花" }, userName: () => "阿花", loadJSON: () => store
  };
  const f = new Function(...Object.keys(ctx), src + "\nreturn { touch: touchForumPublicTie, lines: forumPublicTieLines, store: () => arguments };")(...Object.values(ctx));
  return { ...f, store };
})();

test("碰面账记得住【谁先开的口】和【什么调子】，不只是次数", () => {
  const t = tieFns.store;
  tieFns.touch("n1", "mine");
  assert.equal(t.items.n1.encounters, 1);
  assert.equal(t.items.n1.mine, 1);
  assert.equal(t.items.n1.theirs, 0);
  tieFns.touch("n1", "theirs", "spar");
  assert.equal(t.items.n1.theirs, 1);
  assert.equal(t.items.n1.spar, 1);
  assert.equal(t.items.n1.warm, 0);
  // 认不出来的调子当没说，不许往里塞野值
  tieFns.touch("n1", "theirs", "随便写的");
  assert.equal(t.items.n1.spar, 1);
  assert.equal(t.items.n1.warm, 0);
});

test("匿名吧那几位一个字都不记（那一层边界没变）", () => {
  const t = tieFns.store;
  tieFns.touch("anon1", "mine", "warm");
  assert.equal(t.items.anon1, undefined);
});

test("差得明显才说立场，差不多就不硬分——说错了比不说更糟", () => {
  const t = tieFns.store;
  t.items.n1 = { encounters: 9, mine: 8, theirs: 1, warm: 1, spar: 7, lastTs: Date.now() };
  const one = tieFns.lines("日常吧")[0];
  assert.match(one, /先去接他的话/);
  assert.match(one, /抬两句杠/);
  // 五五开的时候两句都不说
  t.items.n1 = { encounters: 9, mine: 4, theirs: 5, warm: 3, spar: 4, lastTs: Date.now() };
  const flat = tieFns.lines("日常吧")[0];
  assert.doesNotMatch(flat, /先去接|主动来接|搭得上话|抬两句杠/);
  // 边界那句一个字都不许少
  assert.match(flat, /不能声称知道她的私生活/);
});

test("调子由模型顺手报，而且明说不许因此改内容", () => {
  assert.match(app, /"toMe\\":\\"warm或spar，只是路过就留空\\"/);
  assert.match(app, /这一栏不许影响你写什么/);
  // 同一个人连回两句，调子按第一句算
  assert.match(app, /同一个人连回两句，调子按第一句算/);
  assert.match(app, /toneById\.has\(r\.authorId\)\) return;/);
});

// ── ② 数字会长 ──
const live = (() => {
  const i = scr.indexOf("const forumLiveCounts = (p, now) => {");
  const src = scr.slice(i, scr.indexOf("\n};", i) + 3);
  // ⚠️桩要跟真的 forumHash 一样【看内容】：按长度算的话 fp_1 和 fp_2 会撞成同一个数，
  //   那是桩的毛病，不是代码的（第一版就这么假红了一次）。
  const h = x => { let n = 0; for (const c of String(x)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n; };
  return new Function("forumHash", src + "\nreturn forumLiveCounts;")(h);
})();

test("数字随时间长，但是减速的——老帖不会涨到天上", () => {
  const now = Date.now();
  const p = { id: "fp_1", ts: now - 3600000, replyCount: 10, likeCount: 40, viewCount: 900, rtCount: 3 };
  const h1 = live(p, now), d2 = live({ ...p, ts: now - 48 * 3600000 }, now), d30 = live({ ...p, ts: now - 720 * 3600000 }, now);
  assert.ok(h1.viewCount > p.viewCount, "一点都没长");
  assert.ok(d2.viewCount > h1.viewCount && d30.viewCount > d2.viewCount, "越久应该越多");
  assert.ok((d30.viewCount - d2.viewCount) < (d2.viewCount - h1.viewCount), "没减速——一个月后会涨疯");
  // 回复数不许由它编：那是真数出来的
  assert.equal(d30.replyCount, p.replyCount);
});

test("同一小时内看多少次都是同一个数（不然列表排序会抖）", () => {
  const now = Date.now();
  const p = { id: "fp_1", ts: now - 5 * 3600000, replyCount: 3, likeCount: 8, viewCount: 90, rtCount: 1 };
  assert.deepEqual(live(p, now), live(p, now + 59 * 60000));
  // 每个帖自己的势头不同，不是一条曲线套所有帖
  assert.notDeepEqual(live(p, now), live({ ...p, id: "fp_2" }, now));
});

test("没有 ts 的老数据原样返回，不硬编一个", () => {
  const p = { id: "x", replyCount: 1, likeCount: 2, viewCount: 3, rtCount: 4 };
  assert.deepEqual(live(p, Date.now()), { replyCount: 1, likeCount: 2, viewCount: 3, rtCount: 4 });
});

test("显示和排序都用现算那份，不然「热」永远停在建帖那一刻", () => {
  assert.match(scr, /const lc = forumLiveCounts\(p, forumNow\);/);
  assert.match(scr, /fmtNum\(lc\.viewCount \|\| 0\)/);
  assert.match(scr, /fmtNum\(\(lc\.likeCount \|\| 0\) \+ \(isL \? 1 : 0\)\)/);
  assert.match(scr, /const interaction = \(Number\(lc\.replyCount\)/);
});

// ── ③ 帖子挂帖子 ──
test("新帖可以接着吧里最近那件事，但只给标题、最多一条、可以不接", () => {
  const g = app.slice(app.indexOf("  const genForumBoard = async board => {"), app.indexOf("  // 一条原始评论 → 楼层对象"));
  assert.match(g, /【这个吧最近在聊的几件事】/);
  assert.match(g, /最多一条/);
  assert.match(g, /接不出自然的就一条都别接/);
  assert.match(g, /别复述人家的正文/, "给了正文它会去复述，出来就是同一个帖写两遍");
  // 只给标题
  assert.match(g, /"· 《" \+ String\(x\.title \|\| ""\)\.slice\(0, 40\) \+ "》"/);
});

test("接的那一条必须真的接得上——模型随口编的标题当没接", () => {
  const g = app.slice(app.indexOf("  const genForumBoard = async board => {"), app.indexOf("  // 一条原始评论 → 楼层对象"));
  assert.match(g, /const hit = want && hotLately\.find\(h0 => String\(h0\.title \|\| ""\)\.trim\(\) === want\);/);
  assert.match(g, /return hit \? \{ refPostId: hit\.id, refTitle: hit\.title \} : \{\};/);
  // 列表上看得见，而且点得进去
  assert.match(scr, /"接着《" \+ String\(p\.refTitle\)\.slice\(0, 22\) \+ "》"/);
  assert.match(scr, /const t0 = \(posts \|\| \[\]\)\.find\(x => x && x\.id === p\.refPostId\); if \(t0\) openPost\(t0\);/);
});
