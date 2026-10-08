const fs = require("fs"), assert = require("assert");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
// ctx 上没有 userName 这个函数：调它＝每次都抛错，日记评论永远「评论失败」
["engine.js", "study.js"].forEach(f => assert.ok(!/ctx\.userName\(/.test(R(f)), f + " 还在调不存在的 ctx.userName"));
const e = R("engine.js"), a = e.indexOf("async function generateDiaryComment("), b = e.indexOf("async function summarizeChat(", a);
assert.ok(a > 0 && b > a);
assert.ok(e.slice(a, b).includes("userName(ctx.profile)"));
assert.ok(/function userName\(profile\)/.test(R("core.js")));
assert.ok(/评论失败：" \+ \(\(e && e\.message\) \|\| e\)/.test(R("app.js")), "失败要说出原因");
console.log("diary comment ok");
