// 她 2026-09-15：「论坛现在生成回复就会把全部陆续出现的回帖全部放出来了，但是我只是
// 想要一部分按顺序来。比如原来有20条，刷新会多刷5条然后把全部25条放出来，但是我想要的
// 是生成了放出前面5条，新生成的5条和原本排着队的剩余15条还是随时间出现」。
//
// 病根是两处，加起来正好是「刷一次全看完」：
// ① 点「更多回复」时把【尚在队列里的楼全部】push 出来；
// ② 新生成的那一批直接 visibleAt:0（注释写着「手动请求的这一批生成完就直接显示」）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const more = app.slice(app.indexOf("  const genMoreComments = async post => {"),
  app.indexOf("  // 角色发帖（可被未来"));

// 排队那把尺子本身照旧：前三楼立刻，其余按分钟表往后排
const visibleAt = (() => {
  const i = app.indexOf("  const forumCommentVisibleAt = (base, index, salt) => {");
  const src = app.slice(i, app.indexOf("\n  };", i) + 5);
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(src + "\nthis.f = forumCommentVisibleAt;", ctx);
  return ctx.f;
})();

test("排队那把尺子没动：前三楼立刻，其余按分钟表往后", () => {
  const b = 1000000;
  assert.equal(visibleAt(b, 0, 0), b);
  assert.equal(visibleAt(b, 2, 0), b);
  assert.ok(visibleAt(b, 3, 0) > b);
  assert.ok(visibleAt(b, 8, 0) > visibleAt(b, 3, 0), "越靠后越晚");
});

test("⚠️不再把队列倒空——只放出最前面那几条", () => {
  assert.doesNotMatch(more, /先把首批尚在活动队列里的楼全部 push 出来/, "旧那版注释还在");
  assert.match(app, /const FORUM_MORE_RELEASE = 5;/);
  assert.match(more, /const releaseSet = new Set\(queued\.slice\(0, FORUM_MORE_RELEASE\)\.map\(f => f\.id\)\)/);
  // 而且是【该轮到谁就是谁】：按 visibleAt 先后取，不是随手取几条
  assert.match(more, /\.sort\(\(a, b\) => Number\(a\.visibleAt\) - Number\(b\.visibleAt\)\)/);
  // 没被选中的一条都不许改
  assert.match(more, /if \(!f \|\| !releaseSet\.has\(f\.id\)\) return f;/);
});

test("⚠️新生成的那一批也要排队，不再生成完就全显示", () => {
  assert.doesNotMatch(more, /手动请求的这一批生成完就直接显示/, "旧那版注释还在");
  assert.doesNotMatch(more, /visibleAt: 0, ts: base \+ i/, "新楼还是立刻可见");
  assert.match(more, /forumCommentVisibleAt\(base, i - shortfall \+ 3, moreSalt\)/);
});

test("新楼接在旧队列最后一条之后——那才是「别接一段她看不见的空气」的正解", () => {
  assert.match(more, /const lastQueued = beforeFlush\.reduce\(\(n, f\) => Math\.max\(n, Number\(f && f\.visibleAt \|\| 0\)\), 0\);/);
  assert.match(more, /const base = Math\.max\(Date\.now\(\), lastQueued \+ 1,/);
});

test("旧的不够就用新的补满，但绝不插队", () => {
  assert.match(more, /const shortfall = Math\.max\(0, FORUM_MORE_RELEASE - released\);/);
  assert.match(more, /i < shortfall \? base :/);
  // 补的那几条用的是 base，而 base 已经排在所有旧队列之后——所以补也不会越过旧楼
  const i = more.indexOf("const base = Math.max(Date.now(), lastQueued + 1,");
  const j = more.indexOf("i < shortfall ? base :");
  assert.ok(i > 0 && j > i, "补位用的 base 得先算出来（而且是排在旧队列之后的那个）");
});

test("点完要说清楚：几条现在有、几条还排着", () => {
  assert.match(more, /先放出 " \+ nowCount \+ " 条，还有 " \+ waiting \+ " 条排着队陆续来/);
  assert.match(more, /const waiting = Math\.max\(0, queued\.length - released\)/);
});

test("首批（点进帖子那一下）照旧排队，没被顺手改坏", () => {
  const first = app.slice(app.indexOf("  const loadForumComments = async post => {"),
    app.indexOf("  // 更多回复（第二轮起"));
  assert.match(first, /visibleAt: forumCommentVisibleAt\(base, i, salt\)/);
});
