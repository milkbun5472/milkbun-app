// 她 2026-09-23：「论坛能不能搞一个刷新让角色发帖，现在刷新都是路人 NPC 发帖。
// 然后普通刷新也要可以随机掉落角色身边 NPC 的发帖。普通的一次刷新至少三个，现在只有俩。」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const seg = (a, b) => { const i = app.indexOf(a), j = app.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return app.slice(i, j); };

test("一次刷新前三帖立刻出来（原来第三帖要等二十分钟，看上去只有两条）", () => {
  const m = /const FORUM_POST_STAGGER_MS = \[([^\]]*)\];/.exec(app);
  assert.ok(m, "错峰表没了");
  const v = m[1].split(",").map(x => x.trim());
  assert.deepEqual(v.slice(0, 3), ["0", "0", "0"], "前三帖得同时到");
  assert.match(app, /生成 3-5 条不同网友刚发的新主帖/, "一次至少要三条");
});

test("请角色来发帖：挑逛论坛的角色、言秋不算；在某个吧上按就发到这个吧", () => {
  const g = seg("const genForumCharPosts = async tab => {", "\n  };\n");
  assert.match(g, /liveChars\.filter\(c => !off\.includes\(c\.id\) && !settingsFor\(c\.id\)\.engineerEyes\)/);
  assert.match(g, /\.slice\(0, FORUM_CHAR_BATCH\)/, "一按不封顶，按次计费会一下扣一大笔");
  assert.match(g, /forumBoardsAll\(\)\.includes\(tab\) \? tab : ""/, "在「关注」上按也硬塞进一个吧了");
  assert.match(g, /autoForumForChar\(c, \{ manual: true, board: board \}\)/, "又自己写了一份角色发帖");
  // 小号、匿名发的不把名字报出来——那是TA特意遮的
  assert.match(g, /r\.authorType === "character" \? r\.authorName : "有人"/);
  // 界面（她 2026-09-23 第二句：「太占位置了，改成放到刷新键，点开有一个刷新键一个『请TA们发帖』键」）：
  //   帖子流顶上那整条虚线按钮撤了；右上角刷新键点开一张小单子，两颗。在跑的时候那把钥匙按不动。
  assert.ok(scr.indexOf('tab !== "收藏" && onGenCharPosts && h("button"') < 0, "帖子流顶上那一整条又回来了");
  assert.match(scr, /onGenCharPosts && \["请TA们发帖",[^\n]*\(\) => onGenCharPosts\(tab\)\]/);
  assert.match(scr, /disabled: !!\(gen && \(gen\.forum === tab \|\| gen\.forum === "chars"\)\)/);
  assert.match(scr, /onClick: \(\) => setRefreshMenu\(false\), style: \{ position: "absolute", inset: 0/, "点单子外面收不起来");
  assert.doesNotMatch(scr.slice(scr.indexOf("refreshMenu && !inSub"), scr.indexOf("// 悬浮发帖按钮（主页/搜索）")), /h\(Sheet/, "做成半窗了");
  assert.match(app, /onGenCharPosts: genForumCharPosts,/);
});

test("角色发帖只剩一份：手动那条走自动那份（带着论坛习惯、不重复上一贴、看最近相处）", () => {
  const g = seg("const genCharForumPost = async (char, board) => {", "\n  };\n");
  assert.match(g, /await autoForumForChar\(char, \{ manual: true, board: board \}\)/);
  assert.doesNotMatch(g, /runProbe/, "手动那条又自己去调模型了");
  const a = seg("const autoForumForChar = async (char, opts) => {", "\n  };\n");
  assert.match(a, /\(!manual && !autoRefreshOn\("forum", char\.id\)\)/, "手动按的还在看自动开关——关了自动就一条都按不出来");
  assert.match(a, /catch \(e\) \{ if \(manual\) throw e; return null; \}/, "手动按的失败了闷着不吭声");
  assert.match(a, /maxTokens: FTOK\.post/, "并过来之后丢了额度");
});

test("普通刷新偶尔掉一条配角帖：掷在代码里，点名是谁，匿名吧不掉", () => {
  const b = seg("const genForumBoard = async board => {", "appendForumPosts(recs, board);");
  assert.match(app, /const FORUM_CAST_CHANCE = 0\.\d+;/);
  assert.match(b, /Math\.random\(\) < FORUM_CAST_CHANCE/, "「偶尔」交给模型了——它要么次次塞、要么从不塞");
  assert.match(b, /board === "匿名吧" \? \[\]/);
  assert.match(b, /flatMap\(c => npcsOf\(c\.id\)/, "配角名册得走公共那份 npcsOf");
  assert.match(b, /TA是 " \+ cast\.host\.name \+ " 身边的人/);
  assert.match(b, /别把别人的私事往网上发/, "配角上网照样守关系隐私");
  // 模型没标 cast 就不硬认——宁可这次没掉落，也不把路人帖安到TA头上
  assert.match(b, /items\.findIndex\(x => x && \(x\.cast === true \|\| x\.cast === "true"\)\)/);
  // 同一个配角跨帖子是同一个人
  assert.match(b, /id: "npc_guest_cast_" \+ cast\.n\.id/);
  assert.match(b, /castOf: cast\.n\.id, castHost: cast\.host\.id/);
});
