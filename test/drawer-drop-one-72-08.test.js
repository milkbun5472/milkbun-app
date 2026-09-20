// 情侣空间抽屉里的东西要能单个拿掉（她 2026-09-20：「抽屉里的能不能单个删除，有些不想要的」）。
//
// ⚠️不做成长按：她 2026-09-19 为论坛删帖定过同一件事——「算了长按删除去掉不要了，就留叉」。
//   理由写在那次的测试里：长按是隐形的（她「这里也没有删除」），而且在一条条滑过去的列表里，
//   长按十次有八次被当成滚动。抽屉正是这种列表。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("一颗一直看得见的 ✕，不是长按", () => {
  const i = scr.indexOf("function CoupleDrawer(");
  // 下界钉【下一个顶格函数】：组件里面自己还有 `= function (x)`，随手 indexOf 会切太短
  const j = scr.indexOf("\nfunction ", i + 10);
  assert.ok(i > 0 && j > i, "抠不出 CoupleDrawer");
  const c = scr.slice(i, j);
  assert.match(c, /const dropX = function \(x\)/, "那颗 ✕ 没了");
  assert.match(c, /"aria-label": "拿掉这一样"/, "✕ 没有无障碍标签");
  // 封着的那一格是 <button>，✕ 不能套在按钮里——外面得包一层
  assert.match(c, /h\("div", \{ key: x\.id, style: \{ position: "relative" \} \}, dropX\(x\)/, "封着那一格的 ✕ 套进按钮里了（按钮里不能套按钮）");
  assert.ok(!/pressProps|startPress/.test(c), "又做成长按了——她明确说过这种列表里不要");
  // 点 ✕ 不能顺手把东西拆开
  assert.match(c, /onClick: function \(e\) \{ e\.stopPropagation\(\); askDrop\(x\); \}/, "点 ✕ 会连带把它拆开");
  // ⚠️热区 30×30 是给指头的，可热区一居中那个叉就掉到卡片中间去了
  //   （她 2026-09-20：「这个❌有点太下了」）。热区不动，用负 top 把它提到跟第一行字齐平。
  assert.match(c, /width: 30, height: 30/, "热区被缩小了，指头点不准");
  assert.match(c, /top: -7/, "叉又掉下去了");
  assert.match(c, /gap: 7, paddingRight: 22/, "抬头没给叉让位，时间戳会跟它叠在一起");
});

test("删之前先问，而且问得出是哪一样", () => {
  const i = scr.indexOf("const askDrop = function (x) {");
  assert.ok(i > 0, "抠不出抽屉那句确认");
  const c = scr.slice(i, i + 700);
  assert.match(c, /requestAppConfirm\("从抽屉里拿掉"/, "没问就删");
  // 拆过的印出它是什么；还封着的说清楚「拿掉就再也不知道里面是什么」
  assert.match(c, /x\.openedTs\s*\?/, "拆过的和还封着的说的是同一句话");
  assert.match(c, /它还封着——拿掉就再也不知道里面是什么了。/, "封着的那种没说清代价");
});

test("落盘只动这一条，别的一个字不碰", () => {
  const i = app.indexOf("  const dropDrawerItem = id =>");
  assert.ok(i > 0, "app.js 里没有 dropDrawerItem");
  const fn = app.slice(i, app.indexOf("\n  };", i));
  assert.match(fn, /p\.filter\(x => x\.id !== id\)/, "不是按 id 单独拿掉的");
  assert.match(fn, /coupleDrawerRef\.current = n; saveJSON\("x_coupleDrawer", n\)/, "没落盘或没同步 ref");
  // 拆开那一路不许被带着改（它只该盖时间戳）
  const op = app.slice(app.indexOf("  const openDrawerItem = id =>"), i);
  assert.ok(op.indexOf("filter") < 0, "拆开那一路被顺手改成删了");
});

test("接线接到底：组件签名、调用处、app 那头都要有", () => {
  assert.match(scr, /function CoupleDrawer\(\{ partner, items, onOpen, onDrop,/, "组件没收这一格");
  assert.match(scr, /h\(CoupleDrawer, \{ partner, items: coupleDrawer, onOpen: onOpenDrawer, onDrop: onDropDrawer,/, "调用处没传");
  assert.match(scr, /function Us\(\{[^}]*onOpenDrawer, onDropDrawer/, "Us 的签名里没有这一格——传了也接不住");
  assert.match(app, /onDropDrawer: dropDrawerItem,/, "app 那头没接上");
});
