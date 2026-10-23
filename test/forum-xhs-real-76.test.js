// 她 2026-10-23「双列小红书只是改了排版，改成真的更像小红书」：笔记页、评论区、评论区腔调
const assert = require("node:assert/strict"), fs = require("fs");
const ui = fs.readFileSync("js/screens-ui.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8"), ts = fs.readFileSync("js/theme-studio.js", "utf8");
// 评论的三处提示词都走同一个口子，xhs 笔记带上评论区那一句
assert.match(app, /const forumPostVoice = post => forumBoardVoice\(post && post\.board\) \+ \(post && post\.fmt === "xhs" \? FORUM_XHS_CMT : ""\)/);
assert.equal((app.match(/forumPostVoice\(post\)/g) || []).length, 3);
assert.ok(!/forumBoardVoice\(post\.board\)/.test(app));
// 页面：笔记页、按赞排、作者签、回复折叠
assert.match(ui, /const xhs = p\.fmt === "xhs";/);
assert.match(ui, /sort\(\(a, b\) => Number\(b\.likeCount \|\| 0\) - Number\(a\.likeCount \|\| 0\)\)/);
assert.match(ui, /xhs \? xhsBar\(p\) : actBar\(p\)/);
assert.match(ui, /"展开 " \+ \(reps\.length - 1\) \+ " 条回复"/);
for (const k of ["foxhsbar", "foxhsbody", "foauthor", "foxhsmore"]) { assert.match(ui, new RegExp('"data-wk": "' + k + '"')); assert.match(ts, new RegExp('\\["' + k + '", "')); }
console.log("ok");
