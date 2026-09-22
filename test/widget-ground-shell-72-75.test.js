// 她 2026-09-22 转来的两条：「这个日历换了背景图变成这样了」（卡缩窄了一截，右边露出一条底图）、
// 「时间下面的那个自带小组件，换了背景图以后也会飘闪」（底图是个硬方块，四个角从圆角卡外面支出来）。
//
// 病根同一处：她一调过这个组件（材质/底/倾斜/角标任意一样），就会在【格子和组件之间】
// 多夹一层壳，底图画在那层壳上。而那层壳：
//   · 是个普通 div —— 日历那个 button 本来是 grid 的亲儿子、靠 stretch 撑满整格，
//     夹进来之后成了 inline-block，缩成内容那么宽（真浏览器里量过：291 → 214）；
//   · 没挑过材质的那一档（native）走的是裸兜底：没有圆角、没有裁剪，
//     底图就是一个方块铺在圆角玻璃卡背后。
// 挑过材质的那几档（soft/paper/polaroid…）一直都有圆角和 overflow:hidden——是兜底那一档漏了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// ⚠️锚只钉代码：这一段的起点是那句 if，终点是紧跟着的 badge 分支。
const seg = (() => {
  const i = comp.indexOf('if (it.kind === "widget") {\n        delete presetStyle.textAlign;');
  const j = comp.indexOf("if (look.badge) {", i);
  assert.ok(i > 0 && j > i, "抠不出组件那一支");
  return comp.slice(i, j);
})();

test("组件的壳要像一张卡那样收住底图：圆角＋裁剪", () => {
  assert.match(seg, /presetStyle\.borderRadius == null\) presetStyle\.borderRadius = HOME_WIDGET_RADIUS/);
  assert.match(seg, /if \(!presetStyle\.overflow\) presetStyle\.overflow = "hidden"/);
  // 挑过材质的那几档自己带圆角和裁剪，不许被这一层盖掉
  assert.match(comp, /const HOME_WIDGET_RADIUS = \d+;/);
});

test("壳不许把组件的宽度吃掉：里面那个照旧撑满", () => {
  // grid 的单格子女默认 stretch——日历那个 button 没写 width，靠的就是这个。
  assert.match(seg, /presetStyle\.display = "grid"/);
});

test("底图还是画在这一层，没有第二处再画一遍", () => {
  assert.match(seg, /Object\.assign\(presetStyle, decorGroundStyle\(look\)\)/);
  assert.equal((comp.match(/Object\.assign\(presetStyle, decorGroundStyle\(look\)\)/g) || []).length, 1);
});

test("没调过的组件一格都不动：没有 look 就没有这层壳", () => {
  // ⚠️主屏的布局是她和言秋一次次试出来的（施工规则/home-screen-layout.md）。
  //   这一层只在【她真的调过这个组件】时才存在，所以没调过的桌面跟以前一模一样。
  assert.match(comp, /var look = it\.kind === "decor" \? it\.decor : \(it\.kind === "widget" && widgetLooks\[key\]\) \? lookOf\(key\) : null;/);
  assert.match(comp, /if \(presetStyle\) inner = h\("div", \{ style: HOME_SHRINK\[key\]/);
});
