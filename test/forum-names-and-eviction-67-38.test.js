// 她 2026-09-12 两件事：
//  ①「有时候新页面会改过旧的，比如我看原来是这堆回复然后过一会被全体覆盖了」
//  ②「以前名字跟他发的内容没有关系很灵的。你去研究一下固定 npc 时代前」
//
// ② 去翻了 ce1e3ac「feat(forum): add recurring regulars」之前那一版，形状是：
//    · 所有人一套字段：authorName + handle。没有 npcId / guestName 的分叉。
//    · 占位值就两个词：网名、funny_id；提示词写的是「authorName 网名马甲 + handle 有趣 id」。
//    · 代码只有一句「x.authorName || 匿名网友」——没有名字生成器、没有兜底抽签。
//    灵气长在这个形状里：名字从头到尾只有模型一个人在做，而且**没人要求名字跟这条评论有关系**。
//
// ① 这一版能钉死的那一半：淘汰旧帖时【连它的楼一起删】，而那些楼里有她自己写的字。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app);

// 淘汰那一段真跑：它只用 FORUM_NPC_CAP / FORUM_NPC_TOTAL_CAP / forumCommentsRef
const evict = (posts, board, cmts) => {
  const i = app.indexOf("  const forumTouchedPosts = fc => {");
  const j = app.indexOf("\n  });", app.indexOf("const appendForumPosts", i));
  assert.ok(i > 0 && j > i, "抠不出淘汰那一段");
  const src = app.slice(i, j + 6);
  let out = null, killedComments = null;
  new Function("FORUM_NPC_CAP", "FORUM_NPC_TOTAL_CAP", "forumCommentsRef", "setForumPosts", "setForumComments", "saveJSON", "saveForumComments", "BOARD_",
    src + "\nappendForumPosts([], BOARD_);")
    .call(null, 30, 240, { current: cmts || {} },
      fn => { out = fn(posts); }, fn => { killedComments = fn(cmts || {}); }, () => true, () => true, board);
  return { posts: out, cmts: killedComments };
};
const npcPost = (id, ts, board) => ({ id, ts, board: board || "日常吧", authorType: "npc" });

test("她在楼里回过话的那一帖，不许被当成可再生数据淘汰", () => {
  const posts = [];
  for (let i = 0; i < 40; i++) posts.push(npcPost("p" + i, 1000 - i));
  // p39 是最旧的一条，本来必被淘汰；但她在那一楼回过话
  const cmts = { p39: [{ id: "f1", authorType: "npc", content: "..." }, { id: "f2", authorType: "me", content: "我说了一句" }] };
  const r = evict(posts, "日常吧", cmts);
  assert.ok(r.posts.some(p => p.id === "p39"), "她回过话的那一帖被删了——她写的字跟着没了");
  assert.equal(r.posts.length, 31, "该淘汰的还是得淘汰，不能因为保了一帖就整批不动：" + r.posts.length);
});

test("楼中楼里追过评的也算她插过手", () => {
  const posts = [];
  for (let i = 0; i < 40; i++) posts.push(npcPost("p" + i, 1000 - i));
  const cmts = { p39: [{ id: "f1", authorType: "npc", replies: [{ authorType: "me", content: "接一句" }] }] };
  assert.ok(evict(posts, "日常吧", cmts).posts.some(p => p.id === "p39"));
});

test("没插过手的照旧淘汰，而且它的楼跟着走（5MB 池子不许留孤儿）", () => {
  const posts = [];
  for (let i = 0; i < 40; i++) posts.push(npcPost("p" + i, 1000 - i));
  const cmts = { p39: [{ id: "f1", authorType: "npc", content: "路人说的" }], p0: [{ id: "f2", authorType: "npc", content: "新的" }] };
  const r = evict(posts, "日常吧", cmts);
  assert.ok(!r.posts.some(p => p.id === "p39"), "该淘汰的没淘汰");
  assert.ok(r.cmts && !r.cmts.p39, "帖删了楼还留着＝孤儿评论又回来了");
  assert.ok(r.cmts.p0, "没被淘汰的那一帖的楼不许跟着删");
});

test("角色帖和她自己发的帖照旧免疫", () => {
  const posts = [{ id: "mine", ts: 1, board: "日常吧", authorType: "me" }, { id: "ch", ts: 2, board: "日常吧", authorType: "character" }];
  for (let i = 0; i < 40; i++) posts.push(npcPost("p" + i, 1000 - i));
  const r = evict(posts, "日常吧", {});
  assert.ok(r.posts.some(p => p.id === "mine") && r.posts.some(p => p.id === "ch"));
});

test("全库那道总闸也认这条豁免", () => {
  const i = A.indexOf("const npcAll = n.filter(");
  const line = A.slice(i, A.indexOf("\n", i));
  assert.match(line, /evictable\(x\) && !kill\.has\(x\.id\)/, "总闸还是照老写法只看 authorType，绕过了豁免");
});

// ── 落盘失败不许静默 ────────────────────────────────────────
test("楼层写不进盘要当面说，别等下次开机重新生成一套", () => {
  assert.match(A, /const saveForumComments = next => \{/);
  const i = A.indexOf("const saveForumComments = next => {");
  const blk = A.slice(i, i + 420);
  assert.match(blk, /if \(saveJSON\("x_forumComments", next\)\) return true;/);
  assert.match(blk, /forumSaveWarned\.current = true;/, "一轮只吭一声，不然写一次弹一次");
  assert.match(blk, /本地空间满了/);
  assert.match(blk, /下次打开会重新生成一套/, "得说清后果，不然她不知道这句话要她干嘛");
  // 所有落盘点都走它，别有哪一处还在直接 saveJSON
  // 定义那一行是 `= next => {`，名字后面不带括号，所以不会被这条数进来
  assert.equal((A.match(/saveForumComments\(/g) || []).length, 9, "九个落盘点都要走它");
  assert.equal((A.match(/saveJSON\("x_forumComments"/g) || []).length, 1, "还有地方绕过去直接存");
});

// ── 名字：回到固定 npc 时代前的形状 ─────────────────────────
test("人人一套字段：authorName + handle，npcId 只是熟面孔额外点个名", () => {
  const m = app.match(/const FORUM_GUEST_FIELDS = "([^;]+)";/);
  assert.ok(m, "那一份没了");
  assert.match(m[1], /authorName.*网名马甲/);
  assert.match(m[1], /handle.*有趣 id/);
  assert.ok(m[1].indexOf("guestName") < 0 && m[1].indexOf("guestHandle") < 0, "分叉字段又回来了");
  assert.ok(A.indexOf("guestName、guestHandle") < 0, "提示词里还在要那套分叉");
  assert.match(A, /他们照样填 authorName 和 handle（用名单上那一个）/, "熟面孔也得走同一套字段");
  assert.match(A, /只是\*\*额外\*\*再写一个 npcId/);
});

test("⭐她那一句：id 跟他这条说什么没有关系", () => {
  const i = A.indexOf("【论坛人口】");
  const blk = A.slice(i, i + 900);
  assert.match(blk, /id 跟他这条说什么【没有关系】/);
  assert.match(blk, /不是为这条评论现配的一件戏服/);
  assert.match(blk, /别让名字去呼应他这一楼的内容/, "v67.37 那句「名字里可以带着他是谁」正好是反的，不许长回来");
  assert.ok(blk.indexOf("名字里可以带着他是谁") < 0, "反方向那句又回来了");
  assert.match(blk, /一屋子人的名字之间也不该有共同点/);
});

test("贴吧味儿那几个词是【register】不是内容示范（照抄也对）", () => {
  const i = A.indexOf("【论坛人口】");
  const blk = A.slice(i, i + 900);
  assert.match(blk, /前排、顶、蹲一个、@楼上、抬杠、就这？、笑死、坐等后续/,
    "固定 npc 时代前就有这一句，那时候「说的话很活人」");
  // 判据（施工规则/prompt-no-content-samples.md）：逐字照抄是对的还是错的？
  // 「前排」「笑死」被照抄＝真人就这么打字，对的；所以它不算内容示范。
});

test("代码那头只剩一句兜底，没有名字生成器（固定 npc 时代前就是这样）", () => {
  assert.ok(!/const GN = \[|const GP = \[/.test(A), "又在代码里摆名词表了");
  assert.ok(A.indexOf("pool[forumHash(") < 0, "又抽签指派熟面孔了");
  assert.match(A, /const name = String\(\(x && \(x\.guestName \|\| x\.authorName\)\) \|\| \("网友" \+ hh\.toString\(36\)\.slice\(-4\)\)\);/,
    "兜底得一眼看得出是系统默认，不跟模型起的名字混在一起");
});

test("病历留在代码里：为什么回到那个形状", () => {
  const i = app.indexOf("const FORUM_GUEST_FIELDS = ");
  const doc = app.slice(Math.max(0, i - 1200), i);
  assert.match(doc, /固定 npc 时代前/);
  assert.match(doc, /ce1e3ac/, "得写明翻的是哪一个 commit");
  assert.match(doc, /没有 npcId \/ guestName 的分叉/);
  assert.match(doc, /本来就跟他今天说什么无关/);
});
