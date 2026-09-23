// 她 2026-09-23 转来读者许愿：「老师可以许愿自定义贴吧主题吗」。
// 原来论坛只有写死的六个吧；搜索刷出来的吧是逛到的，只躺在搜索页里，不成 tab、不能刷新、角色也不会去。
// 现在她可以自己开吧：开好就挂在版块那一排，刷新、发帖、角色逛论坛都会来；拆吧只拆牌子，帖子不删。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const fn = name => { const i = scr.indexOf("function " + name + "("); assert.ok(i > 0, "抠不出 " + name); return scr.slice(i, scr.indexOf("\n}", i) + 2); };

// 桩照【写存档的那段】写（stub-from-the-writer）：Forum 里 saveBoards 存的就是 [{name, about, createdAt}]
const B = (stored) => {
  const ctx = { loadJSON: (k, d) => (k === "x_forumBoards" ? stored : d) };
  vm.createContext(ctx);
  const i = scr.indexOf("const FORUM_BOARDS = ");
  vm.runInContext(scr.slice(i, scr.indexOf("\n", i)) + "\n" + ["forumCustomBoards", "forumBoardsAll", "forumBoardAbout", "forumBoardName"].map(fn).join("\n")
    + "\nthis.all = forumBoardsAll; this.about = forumBoardAbout; this.name = forumBoardName; this.mine = forumCustomBoards;", ctx);
  return ctx;
};

test("她开的吧接在六个老吧后面，跟老吧同名的不重复", () => {
  const b = B([{ name: "足球吧", about: "周末看球的", createdAt: 1 }, { name: "吐槽吧", about: "撞名" }, { name: "" }, null]);
  assert.deepEqual(Array.from(b.all()), ["吐槽吧", "日常吧", "求助吧", "兴趣吧", "脑洞吧", "匿名吧", "足球吧"]);
  assert.equal(b.about("足球吧"), "周末看球的");
  assert.equal(b.about("吐槽吧"), "撞名");
  assert.deepEqual(Array.from(B(null).all()).length, 6, "没开过吧（老存档）就是原来那六个");
});

test("吧名统一成「某某吧」", () => {
  const b = B([]);
  assert.equal(b.name("足球"), "足球吧");
  assert.equal(b.name(" 足 球吧吧 "), "足球吧");
  assert.equal(b.name("   "), "", "空的不开");
  assert.ok(b.name("一二三四五六七八九十一二三四").length <= 13, "名字太长会把那排 tab 撑坏");
});

test("「一共有哪些吧」只有一份：tab、版块筛选、搜索页、发帖选吧全读它", () => {
  const live = scr.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.match(live, /\[\.\.\.forumBoardsAll\(\), "关注", "收藏"\]/, "tab 那一排");
  assert.match(live, /tab === "收藏" \|\| forumBoardsAll\(\)\.includes\(p\.board\)/, "版块筛选——漏了这处，她开的吧 tab 上有、帖子却跑去搜索页");
  assert.match(live, /!forumBoardsAll\(\)\.includes\(p\.board\)/, "搜索页");
  assert.match(live, /forumBoardsAll\(\)\.map\(b => chip\(b, cbBoard === b/, "发帖选吧");
  assert.ok(!/FORUM_BOARDS\.includes\(p\.board\)/.test(live), "还有地方只认那六个老吧");
});

test("开吧用居中卡片，不做半窗；拆吧只拆牌子、先问一句", () => {
  assert.match(scr, /newBoard && typeof CenterCard === "function" && h\(CenterCard/);
  assert.match(scr, /"＋ 开个吧"/);
  assert.match(scr, /requestAppConfirm\("拆掉「" \+ name \+ "」？", "帖子不会删，会挪到「搜索」那一页里。"/);
  const i = scr.indexOf("const dropBoard = name =>");
  const drop = scr.slice(i, scr.indexOf("}, \"拆吧\");", i));
  assert.ok(!/setForumPosts|x_forumPosts|onDeletePost|onClearBoard/.test(drop), "拆吧不许动帖子");
  assert.match(app, /toast: toast,\n\s*characters: liveChars,\n\s*profile: profile,\n\s*posts: forumPosts,/, "论坛没拿到 toast，开吧时的提示发不出来");
});

test("她开的吧有自己的语气；角色逛论坛也会去——内容对得上才去", () => {
  assert.match(app, /\}\[b\] \|\| forumCustomVoice\(b\)\);/);
  const i = app.indexOf("const forumCustomVoice = b =>");
  const v = app.slice(i, app.indexOf("};", i));
  assert.match(v, /真泡在这个圈子里的人/);
  assert.match(v, /不是路过的人在给外行介绍这个话题/);
  assert.match(app, /【论坛上还有她开的几个吧，也可以发去那儿】/);
  assert.match(app, /只有你这条内容本来就属于那个吧才去/);
  assert.match(app, /const board = forceAnon \? "匿名吧" : \(bmap\[rawBoard\] \|\| \(mine && mine\.name\) \|\| "日常吧"\);/, "模型挑了她的吧，落账时得认得");
});
