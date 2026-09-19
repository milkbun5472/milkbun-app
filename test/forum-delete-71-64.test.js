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
test("删帖那颗要看得见，而且列表和详情页共用一处", () => {
  const i = screens.indexOf("  function actBar(p) {"), j = screens.indexOf("  // ---- 帖子行（推特式）----", i);
  assert.ok(i > 0 && j > i, "抠不出 actBar");
  const seg = screens.slice(i, j);
  assert.ok(/onDeletePost \? h\("button", \{ onClick: e => \{ e\.stopPropagation\(\); askDelPost\(p\); \}/.test(seg),
    "那一排末尾没有删除那一颗");
  assert.ok(seg.includes('title: "删掉这一帖"'), "没有提示文案");
  // 长按那一版不许留着：留着就是两套并行
  assert.ok(!/startForumPress|useLongPressMenu/.test(screens), "长按那一版还在——两套并行迟早只改一处");
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



// ⚠️「关注」「收藏」是视图不是版块：清空它们没有意义，而且很容易点错
test("清空那颗只在真版块上出现", () => {
  assert.ok(/onClearBoard && tab !== "关注" && tab !== "收藏" && arr\.length > 0/.test(screens),
    "在「关注」「收藏」上也摆了清空按钮");
  assert.ok(screens.includes('"清空「" + tab + "」这个版块（" + arr.length + " 帖）"'), "没写清要清掉几帖");
});

test("底下那行小字要说清单删在哪儿——不然她只会看见整版清空", () => {
  assert.ok(screens.includes("每一帖右下角那个 ✕ 可以单独删掉它"), "没有任何地方提示单删这条路");
  assert.ok(!screens.includes("长按一帖可以单独删掉"), "还在教她长按，可那一版已经撤了");
});
