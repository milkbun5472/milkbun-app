// 群友 2026-11-27：论坛发帖带投票；相机电影能重拍某一场（平行人生能重来某一张）
const assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8"), ui = fs.readFileSync("js/screens-ui.js", "utf8"), st = fs.readFileSync("js/camera-story.js", "utf8");
// 投票：没投票的帖子提示词一个字不变；有投票才加那句和 vote 字段
assert.match(app, /if \(!forumPollLine\(post\)\) return pr;/);
assert.match(app, /replace\(\/"content":"回复"\/g, '"content":"回复","vote":0'\)/);
assert.match(app, /const buildForumFloor = \(x, floorNo, base, idx, post\) => \{ const f = buildForumFloorRaw\(x, floorNo, base, idx, post\); return typeof forumWithVote === "function" \? forumWithVote\(f, x, post\) : f; \};/);
assert.match(app, /r = typeof forumWithVote === "function" \? forumWithVote\(r0, x, post\) : r0;/);
const eng = fs.readFileSync("js/engine.js", "utf8"); const fw = new Function(eng.slice(eng.indexOf("function forumWithVote"), eng.indexOf("async function pumpSSE")) + ";return forumWithVote;")();
assert.deepEqual(fw({a:1}, {vote:2}, {poll:{options:["x","y"]}}), {a:1, vote:1}); assert.deepEqual(fw({a:1}, {vote:3}, {poll:{options:["x","y"]}}), {a:1}); assert.deepEqual(fw({a:1}, {vote:1}, {}), {a:1});
assert.match(app, /pollOpts\.length >= 2 \? \{ poll: \{ options: pollOpts, mine: null \} \}/);
assert.match(app, /onVotePoll: voteForumPoll,/);
assert.match(ui, /function ForumPoll\(\{ post, floors, onVote \}\)/);
assert.match(ui, /if \(!f \|\| \(f\.visibleAt && f\.visibleAt > now\)\) return;/, "还在排队的楼不算票");
assert.match(ui, /\(cbPoll \|\| \[\]\)\.map\(x => String\(x \|\| ""\)\.trim\(\)\)\.filter\(Boolean\)\); setCbTitle\(""\); setCbBody\(""\); setCbPoll\(null\);/);
// 重拍：新的成了才换掉旧图
assert.match(st, /const shootAt = async idx =>/);
assert.match(st, /"data-part": "reshoot"/);
assert.match(st, /const visitAt = async idx =>/);
assert.match(st, /"data-part": "redoworld"/);
console.log("ok");
