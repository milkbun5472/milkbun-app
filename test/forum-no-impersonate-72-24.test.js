// 她 2026-09-22 转来的：「论坛某一楼的回复显示是她，但她没写」。
// 病根：帖主/层主是她时，模型标了 is_op / is_owner 的那条会被原样落成 authorType:"me"——
// app 替她开了口。她的发言只能由她自己按键产生。
// 这份钉三件事：① 生成侧四个口子都丢掉那一条；② 提示词那头也不叫模型写；
// ③ 她自己真写的楼层/追评（addForumFloor、fp_me_、按键回复）一个字都不许动。
const assert = require("node:assert");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

// ① 落地那头：四个口子
const guards = app.match(/return null;/g) || [];
assert.ok(guards.length >= 4, "至少四处丢弃");
assert.match(app, /const forumIsMine = r => !!\(r && \(r\.authorType === "me" \|\| r\.authorId === "me"\)\)/);
// 楼中楼 map 的结果必须过网，不能只 filter(Boolean) 之外什么都不做
assert.match(app, /\}\)\.filter\(r => r && !forumIsMine\(r\)\)/);
assert.match(app, /const keptReps = reps\.filter\(r => r && !forumIsMine\(r\)\)/);
// 丢掉的那些绝不能进状态
assert.match(app, /\.\.\.\(f\.replies \|\| \[\]\), \.\.\.keptReps\]/);
assert.match(app, /bumpReplyBy\(post\.id, keptReps\.length\)/);
// 再没有「是她就署名成 me」的三元式
assert.doesNotMatch(app, /"me" : "npc"/);

// ② 提示词那头
assert.match(app, /const opIsMe = post\.authorType === "me"/);
assert.match(app, /const opMineBan = opIsMe/);
assert.match(app, /is_op 一条都不许设 true/);
assert.match(app, /const respIsMe = resp\.type === "me" \|\| resp\.id === "me"/);
assert.match(app, /一条都不要标 is_owner/);
assert.match(app, /一条都不要标 is_op/);

// ③ 她自己写的那三处原样还在
assert.match(app, /const floor = \{ id: fid, authorId: "me", authorType: "me"/);
assert.match(app, /authorType: "me", authorId: "me", content: text, toName: to/);
assert.match(app, /const rec = \{ id: "fp_me_" \+ base, authorId: "me", authorType: "me"/);

// 开机那次清理：只认 isOp/isOwner，绝不按 authorType 一刀切
const cleanAt = app.indexOf("把【已经生成出来的假她】");
assert.ok(cleanAt > 0, "开机清理还在");
const clean = app.slice(cleanAt, cleanAt + 1200);
assert.match(clean, /r\.isOp \|\| r\.isOwner/);
assert.ok(!/f\.replies\.filter\(r => !\(r && \(r\.authorType === "me"[^)]*\)\)\)/.test(clean.replace(/&& \(r\.isOp \|\| r\.isOwner\)/, "X")), "清理必须带 isOp/isOwner 条件");
console.log("ok forum-no-impersonate-72-24");
