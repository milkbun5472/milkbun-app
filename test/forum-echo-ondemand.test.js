const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 她 2026-08-25：「怎么喂不会太多内容分散模型注意力失去活人感」。
// 判据不是【喂多少】，是【这一轮用不用得上】——论坛回声十轮里九轮用不上，
// 而它以前每轮都在。这一轮已经撞过两次同类事故（群聊堆到一万五千字反而更像模板；
// 「批发市场」是上下文多、输入只有八个字，模型只好抓先验）。
const a = app.indexOf("    forumEcho: (() => {");
const b = app.indexOf("    // 查手机内容", a);
const body = app.slice(a, b).replace(/^\s*forumEcho: \(\(\) => \{/, "").replace(/\}\)\(\),\s*$/, "");
const now = Date.now(), H = 3600000, D = 86400000;
const run = (said, posts, cmts) => new Function(
  "ctxOpts", "settingsFor", "char", "profile", "forumPostsRef", "forumCommentsRef",
  "isForumCharAuthor", "lastUserTurnText", "chatsRef",
  "return (()=>{" + body + "})();")(
  { chat: true }, () => ({}), { id: "c1", name: "沈屿白" }, { name: "Lisa" },
  { current: posts }, { current: cmts }, p => p.authorId === "c1", () => said, { current: { c1: [] } });

const oldPost = [{ id: "p1", authorId: "c1", title: "两天前发的", board: "日常吧", ts: now - 2 * D }];
const oldFloorOldReply = { p1: [{ id: "f1", authorId: "c1", content: "我那条", ts: now - 2 * D, isOp: true, replies: [{ authorName: "路人", content: "旧回复", ts: now - 2 * D }] }] };
const oldFloorNewReply = { p1: [{ id: "f1", authorId: "c1", content: "我那条", ts: now - 2 * D, isOp: true, replies: [{ authorName: "路人", content: "刚看到，绝了", ts: now - 1 * H }] }] };

test("① 没人提也没新动静 → 一个字都不发", () => {
  assert.equal(run("今天吃什么", oldPost, oldFloorOldReply), "");
});

test("① 她提到帖子 → 发；刚有人回他 → 也发（不用她开口）", () => {
  assert.match(run("你那个帖子怎么样了", oldPost, oldFloorOldReply), /两天前发的/);
  assert.match(run("在干嘛", oldPost, oldFloorNewReply), /刚看到，绝了/, "新动静自己会触发");
});

test("② 他在别人帖子下的话：没人理的那句不占额度", () => {
  const posts = [{ id: "p2", authorId: "npc_x", authorName: "摸鱼办主任", title: "周一了", board: "吐槽吧", ts: now - 5 * H }];
  const cmts = { p2: [
    { id: "f3", authorId: "c1", content: "有人回我的这句", ts: now - 5 * H, replies: [{ authorName: "摸鱼办主任", content: "你懂个der", ts: now - 3 * H }] },
    { id: "f4", authorId: "c1", content: "没人理的这句", ts: now - 5 * H, replies: [] }
  ] };
  const out = run("论坛", posts, cmts);
  assert.match(out, /有人回我的这句/, "活着的那条要给——那时才可能被提起");
  assert.doesNotMatch(out, /没人理的这句/, "她永远不会提，不该占额度");
});

test("③ 别人在他帖子下的话：只给他会在意的", () => {
  const posts = [{ id: "p1", authorId: "c1", title: "实验室通宵", board: "日常吧", ts: now - 2 * H }];
  const cmts = { p1: [
    { id: "f1", authorId: "c1", content: "我自己那层", ts: now - 2 * H, isOp: true, replies: [{ authorName: "甲", content: "哈哈哈", ts: now - H }] },
    { id: "f2", authorId: "npc_z", authorName: "乙", content: "无关路人的楼", ts: now - 2 * H, likeCount: 3, replies: [{ authorName: "丙", content: "嗯", ts: now - 2 * H }] },
    { id: "f6", authorId: "npc_w", authorName: "丁", content: "点赞很高的热评", ts: now - 2 * H, likeCount: 300, replies: [{ authorName: "戊", content: "同意", ts: now - H }] }
  ] };
  const out = run("论坛", posts, cmts);
  assert.match(out, /我自己那层/);
  assert.match(out, /点赞很高的热评/, "热评他会看见");
  assert.doesNotMatch(out, /无关路人的楼/, "一个热帖能有几十层，不筛就把额度塞满");
});

test("④ 三天以外的掉出去，最近的先占位，总量封在 6 条", () => {
  const posts = [{ id: "px", authorId: "c1", title: "三周前的老帖", board: "日常吧", ts: now - 20 * D }];
  const cmts = { px: [{ id: "fx", authorId: "c1", content: "老话", ts: now - 20 * D, isOp: true, replies: [{ authorName: "谁", content: "回老帖", ts: now - 20 * D }] }] };
  assert.equal(run("论坛", posts, cmts), "", "三周前的不该再占位置");
  assert.match(body, /cand\.sort\(\(a, b\) => b\.ts - a\.ts\)\.slice\(0, 6\)/);
  assert.match(body, /WINDOW = 3 \* 86400000/);
});

// v56.13 定的边界不许被这次重写弄丢
test("匿名吧和小号一个字都不许漏", () => {
  const anon = [{ id: "pa", authorId: "me", authorType: "me", anon: true, board: "匿名吧", title: "我不想让他知道的事", ts: now - H }];
  assert.equal(run("论坛", anon, {}), "");
  assert.match(body, /p\.authorType === "me" && !p\.anon && p\.board !== "匿名吧"/);
});
