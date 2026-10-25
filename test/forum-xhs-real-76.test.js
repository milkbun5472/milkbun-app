// 她 2026-10-23「双列小红书只是改了排版，改成真的更像小红书」：笔记页、评论区、评论区腔调
const assert = require("node:assert/strict"), fs = require("fs");
const ui = fs.readFileSync("js/screens-ui.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8"), ts = fs.readFileSync("js/theme-studio.js", "utf8");
// 评论的三处提示词都走同一个口子，xhs 笔记带上评论区那一句
assert.match(app, /const forumPostVoice = post => forumBoardVoice\(post && post\.board\) \+ \(post && post\.fmt === "xhs" \? FORUM_XHS_CMT : ""\)/);
assert.equal((app.match(/forumPostVoice\(post\)/g) || []).length, 3);
assert.ok(!/forumBoardVoice\(post\.board\)/.test(app));
// 页面：笔记页、按赞排、作者签、回复折叠
assert.match(ui, /const xhs = p\.fmt === "xhs";/);
assert.match(ui, /xhs \? xhsBar\(p\) : actBar\(p\)/);
assert.match(ui, /"展开 " \+ \(reps\.length - 1\) \+ " 条回复"/);
for (const k of ["foxhsbar", "foxhsbody", "foauthor", "foxhsmore"]) { assert.match(ui, new RegExp('"data-wk": "' + k + '"')); assert.match(ts, new RegExp('\\["' + k + '", "')); }
console.log("ok");
// 第一轮：主页双列＋三栏、发笔记先放图后挑 #话题、评论热度（作者回过／被接话多的顶上去）
assert.match(ui, /function xhsProfile\(arr, isMe\)/);
assert.match(ui, /cardLayout \? xhsProfile\(mine, isMe\) : null/);
assert.match(ui, /cardLayout\?xhsProfile\(authored,false\)/);
assert.match(ui, /cardLayout \? xhsProfile\(authored, false\)/);
assert.match(ui, /const xhsLikes = \(post, cm\) =>/);
assert.match(ui, /xhsLikes\(p, b\) - xhsLikes\(p, a\)\)/);   // 作者回过的先排（v76.47x），同一档里再按热度
assert.match(ui, /cardLayout \? "发笔记" : "发帖"/);
for (const k of ["foxhsprofile", "foxhsproftab", "foauthorliked", "foxhsphoto", "foxhstopics"]) { assert.match(ui, new RegExp('"data-wk": "' + k + '"')); assert.match(ts, new RegExp('\\["' + k + '", "')); }
console.log("ok2");
// 第二轮：顶上关注/发现/收藏＋话题、消息三栏、搜索双列最热最新、一左一右的双列
assert.match(ui, /else if \(tab !== "发现"\) arr = arr\.filter\(p => p\.board === tab\)/);
assert.match(ui, /function xhsNoticeTabs\(\)/);
assert.match(ui, /if \(cardLayout && noticeTab !== "cmt"\) return/);
assert.match(ui, /const xhsGrid = \(list, wk\) =>/);
assert.ok(!/columnCount: 2/.test(ui), "双列都走 xhsGrid");
assert.match(ui, /onGenBoard\(tab === "发现" \? xhsRandBoard\(\) : tab\)/);
for (const k of ["foxhstop", "foxhstoptab", "foxhstopicrow", "foxhstopic", "foxhsnotice", "foxhsnoticetab", "foxhslikerow", "foxhsfanrow", "foxhssearchsort"]) { assert.match(ui, new RegExp('"data-wk": "' + k + '"')); assert.match(ts, new RegExp('\\["' + k + '", "')); }
console.log("ok3");
// 第三轮：多图笔记。第一张照旧 photo，第二张起 morePhotos；模型读帖子时也读得到每一张
const scr0 = fs.readFileSync("js/screens.js", "utf8");
const more = new Function(scr0.slice(scr0.indexOf("function forumPhotoOf"), scr0.indexOf("\n}\n", scr0.indexOf("function forumWithPhoto")) + 3) + ";return {forumMorePhotos, forumWithPhoto};")();
assert.deepEqual(more.forumMorePhotos({ morePhotos: ["a", { desc: "b" }, ""] }), [{ desc: "a" }, { desc: "b" }]);
assert.equal(more.forumWithPhoto("正文", { photo: { desc: "一" }, morePhotos: [{ desc: "二" }] }), "正文 〔第1张图：一〕 〔第2张图：二〕");
assert.equal(more.forumWithPhoto("正文", { photo: { desc: "一" } }), "正文 〔配图：一〕");
assert.equal((app.match(/\.\.\.forumMoreTag\((x|content)\)/g) || []).length, 3, "网友帖、角色帖、搜索帖三处都挂上");
assert.equal((app.match(/forumFmtField\(\)/g) || []).length, 4);
assert.match(ui, /xhs \? xhsPhotos\(p\) : forumPhotoCard\(p, 280\)/);
for (const k of ["foxhsphotos", "foxhspageno"]) { assert.match(ui, new RegExp('"data-wk": "' + k + '"')); assert.match(ts, new RegExp('\\["' + k + '", "')); }
console.log("ok4");
// 配色跟着排版换：双列用小红书那份，单列用原来那份；论坛里的底色都从 FORUM_SKIN 取
assert.match(ui, /const FORUM_SKIN_XHS = \{[^}]*accent: "#ff2442"/);
assert.match(ui, /forumSkinUse\(cardLayout\);/);
{ const a = ui.indexOf("function Forum({"), b = ui.indexOf("\nfunction ", a + 20); assert.ok(!/rgba\(244,247,240|rgba\(248,250,245/.test(ui.slice(a, b)), "顶栏底栏的底色走 FORUM_SKIN.bar"); }
console.log("ok5");
