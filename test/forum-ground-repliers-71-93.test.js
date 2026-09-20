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

// ---- 3. 三处该接的都接上了 ----
// 第二轮追评：楼主 + 这帖里已经回过话的角色
assert.match(app, /forumCharGrounding\(opChar, post, "楼主"\)/, "第二轮没给楼主接上");
assert.match(app, /replied\.slice\(0, FORUM_GROUND_MAX\)/, "第二轮没给已经冒泡过的角色接上");
assert.match(app, /forumCharGrounding\(c, post, "这帖里已经回过话的"\)/, "已经回过话的角色拿不到真实背景");
// 她评论之后那几条楼中楼：帖主 + 必回她的那个层主，检索带上她刚说的那句
assert.match(app, /forumCharGrounding\(oc, post, "楼主", myText\)/, "楼中楼那一处楼主的检索词没带她刚说的那句");
assert.match(app, /forumCharGrounding\(ownerChar, post, "这层楼的层主", myText\)/,
  "【必回她的那个人】还是没有真实背景——她报的正是这一处");

// ---- 4. 第一轮不接，但必须写着为什么（four-surfaces：漏的那处要写明理由）----
const r1 = app.indexOf("    // ── 第一轮（首次点进帖）");
assert.ok(r1 > 0, "第一轮那段的位置找不到了");
assert.match(app.slice(r1, r1 + 400), /故意/, "第一轮不注入背景这件事没写理由");

// ---- 5. 封顶还在：一帖里真正说话的就那么几个，别拿预算喂不会出场的人 ----
assert.match(app, /const FORUM_GROUND_MAX = 3;/, "没有封顶，一池子角色每人一份会把预算吃光");

console.log("✓ 论坛：楼主、已回过话的角色、必回她的层主都拿得到真实背景＋最近相处");
