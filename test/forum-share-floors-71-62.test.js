"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("node:fs").readFileSync("js/app.js", "utf8");

// 她 2026-09-19：「主要就是得确定转发论坛进来后他能看到啥」
// 原来转发只给楼主那一段（板块/标题/正文前160字/作者名）：她转一个帖多半就是想让他
// 看楼里怎么说，结果他只看得见楼主，一句「你看评论区」就接不住。
test("转发的帖子把楼里的话一起带过去", () => {
  assert.match(app, /const forumShareFloors = post =>/, "楼里那几层没带上");
  const fn = app.slice(app.indexOf("const forumShareFloors = post =>"), app.indexOf("const forumShareText ="));
  assert.ok(fn.length > 200, "抠不出 forumShareFloors");
  assert.match(fn, /forumCommentsRef\.current\[post\.id\]/, "没去读真正的楼");
  assert.match(fn, /f\.replies \|\| \[\]/, "楼中楼那一层没带");
  assert.match(app, /\+ forumShareFloors\(post\) \+ \(tags \|\| ""\)/, "拼进去的那一步没了");
});

// ⚠️匿名和小号在论坛里显示的就是「匿名用户／匿名者」：这儿照抄显示名，不去还原是谁。
test("楼里的名字照抄显示名，不许还原身份", () => {
  const fn = app.slice(app.indexOf("const forumShareFloors = post =>"), app.indexOf("const forumShareText ="));
  assert.match(fn, /x\.authorName \|\| "有人"/, "不是照抄显示名了");
  assert.doesNotMatch(fn, /authorId|authorType/, "去翻真实身份了——匿名当场破功");
});

// 施工规则/four-surfaces-same-context.md：私聊和群聊转的是同一张卡，不许一处有一处没有。
test("私聊和群聊共用同一份转发正文", () => {
  assert.equal((app.match(/content: forumShareText\(post,/g) || []).length, 2,
    "两处转发不再走同一份 forumShareText 了");
  assert.equal((app.match(/kind: "forumshare"/g) || []).length, 2, "转发的口子数变了，上面那条就不作数了");
});

// 她 2026-09-19：「朋友圈那 40 字截得挺狠」。这一栏是常驻的，所以放宽也要有个准数。
test("朋友圈那一栏的字数只有一处，而且比原来宽", () => {
  const m = app.match(/const MOMENT_LOG_LEN = (\d+), MOMENT_LOG_COMMENT_LEN = (\d+);/);
  assert.ok(m, "没有那两个常量，又回到写死的魔数了");
  assert.ok(Number(m[1]) > 40, "正文没放宽");
  assert.ok(Number(m[2]) > 30, "评论没放宽");
  const log = app.slice(app.indexOf("momentLog: (() => {"), app.indexOf("forumPmLog:"));
  assert.ok(log.length > 400, "抠不出 momentLog");
  assert.doesNotMatch(log, /slice\(0, (40|30)\)/, "还留着写死的 40/30");
});
