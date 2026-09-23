// 她 2026-09-19 转小红书群里：Sunghoon「论坛的帖子可以删除吗？」
//   阿久「同问，我就是删不了尴尬死了」→ 她：「论坛的话搞能单独删也可以某个版块删吧」
//
// 查下来确实一个入口都没有：Forum 只收 onBack / onStartPM / onPostMine / onRefreshPMs。
// 会自己消失的只有 NPC 帖（版块封顶淘汰），而那段淘汰**明确跳过非 NPC 的帖子**
// （evictable = x.authorType === "npc" && …），所以她自己发的那几条永远躺在那儿。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), screens = P("js/screens.js");

const drop = () => {
  const i = app.indexOf("  const forumDropPosts = ids => {"), j = app.indexOf("\n  };", i);
  assert.ok(i > 0 && j > i, "抠不出 forumDropPosts");
  return app.slice(i, j);
};

// ⚠️只删帖不删楼＝每留一条 1~3KB 永远躺在本地空间里（NPC 淘汰那儿踩过一次，有注释）
test("楼跟着帖一起删，不留孤儿评论", () => {
  const seg = drop();
  assert.ok(/Object\.keys\(cur\)\.forEach\(pid => \{ if \(!kill\.has\(pid\)\) keep\[pid\] = cur\[pid\]; \}\);/.test(seg),
    "只删了帖，楼里的回复留成了孤儿");
  assert.ok(seg.includes("saveForumComments(keep)"), "楼没落盘");
  assert.ok(seg.includes('saveJSON("x_forumPosts", next)'), "帖没落盘");
  // 落盘之外还要把 ref 同步上，不然下一次删会拿着旧的那份算
  assert.ok(/forumPostsRef\.current = next;/.test(seg), "ref 没跟上，连删两次会把第一次删掉的又带回来");
});

// ⚠️v71.76：长按是隐形的（她「宝宝没看到删帖啊」「这里也没有删除」），而且在一条条
//   滑过去的列表里，长按十次有八次被当成滚动。改成那一排图标末尾一颗看得见的 ✕。
// ⚠️v71.79：我先把这颗 ✕ 塞进了 actBar 末尾，当场又把那一排顶出屏幕
//   （她「这个叉在屏幕外」）。那一排本来就挤——上面那条注释写着她 2026-09-01
//   报过同一件事（赞和阅读一上万就顶出去）。space-between 只管间距，管不了总宽度。
//   删除不该跟那几个数字抢宽度，挪到卡片右上角就永远不用抢。
test("删帖那颗在卡片右上角，不进那一排数字", () => {
  const i = screens.indexOf("  function actBar(p) {"), j = screens.indexOf("  function delBtn(p) {", i);
  assert.ok(i > 0 && j > i, "抠不出 actBar");
  assert.ok(!/askDelPost/.test(screens.slice(i, j)), "又把删除塞回那一排了——它会再顶出去一次");
  // 一处画、两处用：列表卡片和详情页头部
  assert.ok(screens.includes("  function delBtn(p) {"), "没抽成一处");
  assert.equal((screens.match(/delBtn\(p\)/g) || []).length, 3, "该是一处定义、两处调用（列表 + 详情页）");
  assert.ok(screens.includes('title: "删掉这一帖"'), "没有提示文案");
  // ⚠️它跟「+N 新回复」并排，所以那一格得是 flexShrink:0，不然长标题会把它挤走
  assert.ok(/h\("div", \{ className: "flex items-center", style: \{ flexShrink: 0 \} \},\n\s*unread > 0/.test(screens),
    "右上角那一格没写 flexShrink:0——长标题会把它挤出去");
});

// ⚠️她 2026-09-19 两次定：先说「长按删除也要二次确认」，隔一句又
//   「算了长按删除去掉不要了，就留叉」。最终就是【只有那颗 ✕ 一条路】。
test("删帖只有那颗 ✕ 一条路，而且绕不过确认", () => {
  assert.ok(!/startForumPress|useLongPressMenu/.test(screens), "长按那一版又回来了——她明确说了不要");
  // ⚠️谁也不许绕过确认直接删：全库调 onDeletePost 的地方都该在确认回调里
  const calls = (screens.match(/onDeletePost\(p\.id\)/g) || []).length;
  assert.equal(calls, 2, "有人绕过 askDelPost 直接删了（两处都该在确认回调里）");
  const i = screens.indexOf("  function askDelPost(p) {"), j = screens.indexOf("\n  }", i);
  assert.equal((screens.slice(i, j).match(/onDeletePost\(p\.id\)/g) || []).length, 2,
    "那两处调用不在 askDelPost 里——说明别处有一条直通的删除");
});

// ⚠️她自己写的回不来；网友的帖子刷新一下就重新生成
test("两种都问一句，但说的后果不一样", () => {
  const i = screens.indexOf("  function askDelPost(p) {"), j = screens.indexOf("\n  }", i);
  assert.ok(i > 0 && j > i, "抠不出 askDelPost");
  const seg = screens.slice(i, j);
  assert.ok(/p\.authorType === "me"\) requestAppConfirm/.test(seg), "删自己的帖不问就删了");
  assert.ok(seg.includes("删了回不来"), "没说清自己那帖的后果");
  assert.ok(seg.includes("刷新一下还会有新的"), "没说清网友那帖的后果");
  // ⚠️摆到明面上之后两种都得问：一颗一直亮着的 ✕ 比长按好点得多，误触也就更容易
  assert.equal((seg.match(/requestAppConfirm/g) || []).length, 2, "有一种不问就删了");
});

// ⚠️她 2026-09-19 截图：「发送」两个字断成两行、还被切掉一半
test("回复栏的发送键不许被挤出去", () => {
  const i = screens.indexOf("      h(\"div\", { className: \"shrink-0\", style: { borderTop: \"1px solid \" + FORUM_SKIN.line");
  assert.ok(i > 0, "抠不出回复栏");
  const seg = screens.slice(i, i + 1600);
  assert.ok(/className: "shrink-0 px-4 py-2 rounded-full active:opacity-70"/.test(seg),
    "按钮没写 shrink-0——输入框是 flex-1，它会被压到比两个字还窄");
  assert.ok(/whiteSpace: "nowrap"/.test(seg), "没拦换行，「发送」会断成两行");
  assert.ok(/className: "flex-1 min-w-0 outline-none/.test(seg), "输入框没写 min-w-0，它会撑着不肯让");
  assert.ok(seg.includes("env(safe-area-inset-right)"), "右边距没吃安全区");
});

test("整版清空要把数报清楚，尤其是她自己那几帖", () => {
  const i = app.indexOf("  const clearForumBoard = board => {"), j = app.indexOf("\n  };", i);
  assert.ok(i > 0 && j > i, "抠不出 clearForumBoard");
  const seg = app.slice(i, j);
  assert.ok(seg.includes("requestAppConfirm"), "整版清空不问一句就删了");
  assert.ok(/x\.authorType === "me"\)\.length/.test(seg), "没单独数她自己发了几帖");
  assert.ok(seg.includes("删了就回不来了"), "没说清哪些回不来");
  assert.ok(seg.includes("刷新一下会重新生成"), "没说清哪些还会回来——不说她会以为全没了");
  assert.ok(seg.includes("本来就是空的"), "空版块也弹确认框");
});

test("两条路都接上了，中间没掉层", () => {
  assert.ok(app.includes("onDeletePost: deleteForumPost"), "app 那头没传");
  assert.ok(app.includes("onClearBoard: clearForumBoard"), "app 那头没传");
  assert.ok(/onDeletePost, onClearBoard/.test(screens), "Forum 的参数表里没接住");
  assert.ok(screens.includes("onClearBoard(tab)"), "清空那颗没接上");
  assert.ok(screens.includes("onDeletePost(p.id)"), "长按删那一路没接上");
});



// ⚠️v71.80：这颗原来躺在帖子流【最底下】——要滑过整版帖子才够得着，底下还压着
//   一条固定导航栏，等于根本不存在（她「整个版块在哪儿删啊」）。
//   现在它跟吧规并排坐在那条横杠上：版块级的横杠永远一行高、永远在屏幕上。
test("清空那颗长在吧规横杠上，不在滚动列表里", () => {
  assert.ok(screens.includes('h("button", { onClick: () => onClearBoard(tab), className: "shrink-0 active:opacity-60"'),
    "清空那颗不在横杠上（或者又被塞回滚动列表里了）");
  assert.equal((screens.match(/onClearBoard\(tab\)/g) || []).length, 1, "该只有一个入口");
  // 横杠整条只在真版块上渲染（FORUM_BOARD_RULES 没有「关注」「收藏」这两个键），
  // 所以清空那颗也就天然不会出现在那两个视图上。
  // v73.2x 她开的吧也走这一条横杠（boardRules：写死的吧规，或她写的简介）——
  //   「关注」「收藏」既不在吧规表里、也开不成吧（吧名一律以「吧」结尾），所以照旧不出现
  assert.ok(/nav === "home" && boardRules\) && h\("div"/.test(screens),
    "横杠的渲染条件变了——清空那颗可能漏到「关注」「收藏」上");
  assert.match(screens, /const boardRules = FORUM_BOARD_RULES\[tab\] \|\| \(myBoardNow \? \[/);
  assert.ok(!/FORUM_BOARD_RULES = \{[^}]*关注/.test(screens), "吧规表里多了「关注」，清空会跟着漏出去");
  // 吧规和清空是两颗并排的兄弟按钮：套在一起点哪儿都会展开吧规
  assert.ok(/onClick: \(\) => setRulesOpen\(!rulesOpen\), className: "flex-1 min-w-0/.test(screens),
    "吧规那颗不是 flex-1 的独立按钮——清空可能被套在它里面");
});

test("底下那行小字要说清单删在哪儿、整版清空在哪儿", () => {
  assert.ok(screens.includes("整版清空在吧规那条横杠右边"), "没告诉她整版清空搬去哪儿了");
  assert.ok(/单独删它|单独删掉它/.test(screens), "没有任何地方提示单删这条路");
  assert.ok(!screens.includes("长按一帖可以单独删掉"), "还在教她长按，可那一版已经撤了");
});
