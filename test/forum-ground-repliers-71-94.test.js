// 楼里回话的人也得知道最近发生了什么（她 2026-09-20 转来的：「我哥应该是知道我今天调班的」）。
//
// 病根：真实背景（人设＋记忆）这一份【只给楼主】。楼下回她的那个角色手上只有 80 字人设
// 和一个心情标签，今天刚发生的事一个字都没有——发帖那一处早就带着「最近亲历的共同相处」，
// 楼里回复这一处从来没跟上（four-surfaces-same-context.md 的老形状）。
//
// 而且光给记忆库不够：记忆是抽取出来的，今天刚说的「今天调班」多半还没进库，
// 所以这一份同时带一段最近相处，口子复用发帖那处的 ambientMaterialFor。
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 切片两头钉函数名，不钉注释（anchor-on-code.md）
const i = app.indexOf("  const forumCharGrounding = (ch, post, role, extraQuery) => {");
const j = app.indexOf("  const forumCommentProbe = (post, n, opts = {}) => {", i);
assert.ok(i > 0 && j > i, "app.js 里抠不出 forumCharGrounding");
const ground = app.slice(i, j);

// ---- 1. 这一份里到底有什么 ----
assert.match(ground, /retrieveMemories\(memLibRef\.current, ch\.id, q,/, "没按话题检索这个人的真实记忆");
assert.match(ground, /ambientMaterialFor\(ch, \{ limit: FORUM_GROUND_LIVED \}\)/,
  "没带最近相处——只有记忆库的话，今天刚说的事还没进库就等于没有");
assert.match(ground, /ch\.persona/, "人设没带");
// 检索词必须吃得下调用方额外给的那句（她那句「调班」只在评论里，帖子标题正文一个字都没有）
assert.match(ground, /String\(extraQuery \|\| ""\)/, "检索词没把调用方多给的那句话算进去");

// ---- 2. 旧的那个只给楼主的口子不许留着（one-public-mechanism.md：开了公共的，旧的也要搬过来）----
const stale = app.split("\n").filter(l => l.includes("forumOpGroundingFor") && !l.trim().startsWith("//"));
assert.strictEqual(stale.length, 0, "还有地方在用老的 forumOpGroundingFor：\n" + stale.join("\n"));

// ---- 3. 四处该接的都接上了 ----
// 两轮刷楼：楼主 + 这帖里可能开口的每一个角色（不挑人、不封顶）
assert.match(app, /forumCharGrounding\(opChar, post, "楼主"\)/, "没给楼主接上");
const grounds = app.match(/poolChars\.map\(c => forumCharGrounding\(c, post, "这帖里可能开口的"\)\)/g) || [];
assert.strictEqual(grounds.length, 2, "两轮刷楼里只有 " + grounds.length + " 轮给了全体角色背景");
// 她评论之后那几条楼中楼：帖主 + 必回她的那个层主，检索带上她刚说的那句
assert.match(app, /forumCharGrounding\(oc, post, "楼主", myText\)/, "楼中楼那一处楼主的检索词没带她刚说的那句");
assert.match(app, /forumCharGrounding\(ownerChar, post, "这层楼的层主", myText\)/,
  "【必回她的那个人】还是没有真实背景——她报的正是这一处");

// 她评论之后那几条楼中楼里，允许冒出来接话的角色同样要有
assert.match(app, /forumCharGrounding\(c, post, "这层楼里可能开口的", myText\)/,
  "楼中楼里冒出来接话的角色还是没有背景");

// ---- 4. 不许再按「只给已知会说话的那几个」挑人 ----
// 赌对了才准，赌错的那个一开口就现编；她 2026-09-20 明确说了不要想着省钱。
assert.ok(!/FORUM_GROUND_MAX/.test(app), "又按人数封顶了——被筛掉的那个角色一开口就会现编");
assert.ok(!/故意.{0,40}不注入/.test(app), "还留着「第一轮故意不给背景」那条");

console.log("✓ 论坛：两轮刷楼＋她评论之后的楼中楼，可能开口的每个角色都拿得到真实背景＋最近相处");
