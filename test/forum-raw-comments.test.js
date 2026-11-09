// 她 2026-11-03 截图：论坛整个评论区变成「（还没人接话）」底下一串楼中楼。
//   首批楼被模型塞进一条空楼的 replies / 字段叫 text，原来只认 content → 落成占位楼；下一轮又全挂到占位楼底下。
const assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
const i = app.indexOf("const FORUM_EMPTY_FLOOR"), j = app.indexOf("const loadForumComments");
const F = new Function(app.slice(i, j) + ";return {forumRawComments, isForumEmptyFloor, FORUM_EMPTY_FLOOR};")();
const nested = { comments: [{ content: "", replies: [{ content: "二次元男生最好追了" }, { text: "从约稿切入" }] }] };
assert.deepEqual(F.forumRawComments(nested).map(x => x.content), ["二次元男生最好追了", "从约稿切入"], "空楼里的楼中楼拆出来各成一楼");
assert.deepEqual(F.forumRawComments({ comments: [{ text: "楼一" }, { body: "楼二" }, { content: "楼三" }] }).map(x => x.content), ["楼一", "楼二", "楼三"]);
assert.deepEqual(F.forumRawComments({ floors: [{ content: "a" }] }).map(x => x.content), ["a"]);
assert.ok(F.isForumEmptyFloor({ content: F.FORUM_EMPTY_FLOOR, replies: [] }));
assert.equal((app.match(/let cs = forumRawComments\(d\);/g) || []).length, 2);
const g = app.slice(app.indexOf("const genMoreComments = async post =>"));
assert.match(g, /existing\.filter\(f => !\(f && f\.content === FORUM_EMPTY_FLOOR\)\)/, "占位楼不接楼中楼");
assert.match(g, /list\.filter\(f => !isForumEmptyFloor\(f\)\)/, "真楼来了占位楼退场");
