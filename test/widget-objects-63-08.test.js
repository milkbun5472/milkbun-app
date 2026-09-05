// 她 2026-09-05：「这个字条放背景上看不见，然后宝宝你看看这几个组件也改改样式，太普通了」。
//
// 判据还是那一条（tabs-not-plain-pills.md）：**这个东西原样搬到另一个 app 里还成立吗？**
// 成立 → 写坏了。所以每一条判词都对着【它是个什么东西】问，不对着"有没有改过"问。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => path.resolve(__dirname, "..", f);
const comp = fs.readFileSync(P("js/components.js"), "utf8");
const rw = fs.readFileSync(P("js/recent-widget.js"), "utf8");
const html = fs.readFileSync(P("index.html"), "utf8");
const cut = (a, b) => { const i = comp.indexOf(a), j = comp.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return comp.slice(i, j); };

test("字条夹自己有底：铺了照片壁纸也看得见", () => {
  const w = rw.slice(rw.indexOf("function RecentWidget("), rw.indexOf("function UnreadBack("));
  // 原来夹板是 ink 4% 的一层薄色，壁纸一铺整只夹子就没了，只剩三张白纸飘在树林上
  assert.doesNotMatch(w, /background: skinAlpha\(ink, "0a"\)/, "夹板又变回那层看不见的薄色了");
  assert.match(w, /background: paper,/, "夹板得铺主题的纸色，不能只靠一层半透明");
  assert.match(w, /useOnWallpaper\(\)/, "没问「底下是不是壁纸」，就没法在花底子上加厚");
  assert.match(w, /onWall \? "0 10px 26px/, "壁纸上要更重的投影把夹子从背景里拎出来");
});

test("标题和未读挪到压条上——字要待在自己有底的东西上", () => {
  const bar = rw.slice(rw.indexOf("function clampBar("), rw.indexOf("function RecentWidget("));
  assert.match(bar, /title/, "标题没写在压条上");
  assert.match(bar, /unread \+ " 条没看"/, "未读数没写在压条上");
  // 压条是墨色的，字一律 t.bg——深色主题里 ink 是浅的，写死 #fff 就是白底白字
  assert.match(bar, /var fg = t\.bg \|\| "#fff";/);
  assert.doesNotMatch(bar, /color: "rgba\(255,255,255/, "压条上的字写死了白色，深色主题会看不见");
});

test("转盘是一只木转盘，不是一张饼图", () => {
  const disc = cut("function WheelDisc(", "// 转盘顶上那根【簧片指针】");
  assert.match(disc, /url\(#wkWheelRim\)/, "外面那圈木框没了");
  assert.match(disc, /nails\.push/, "框上那圈铜钉没了");
  assert.match(disc, /url\(#wkWheelHub\)/, "正中那颗铜轴没了");
  // 扇区之间是墨线，不是白线；白线是饼图的画法
  assert.match(disc, /stroke: "rgba\(58,44,30,\.5\)"/, "扇区之间又变回白线了");
  // 扇区半径必须给木框让出地方
  assert.match(comp, /const R = 39;/, "扇区又铺到边上了，木框和铜钉会被压没");
  assert.doesNotMatch(comp, /const WHEEL_COLORS = \["#f2cfd2"/, "又退回那八个糖果色了");
});

test("指针是一根簧片，不是一个填色三角", () => {
  const nd = cut("function WheelNeedle(", "// 全屏大转盘");
  assert.match(nd, /url\(#wkNeedle\)/);
  // 小组件和全屏共用同一根：只写一处，别哪天只改了其中一个
  const uses = comp.match(/h\(WheelNeedle, \{ size: \d+ \}\)/g) || [];
  assert.equal(uses.length, 2, "簧片指针该有两处在用（小组件 + 全屏），实际 " + uses.length);
  assert.doesNotMatch(comp, /borderTop: "18px solid #e8b04d"/, "全屏那个填色三角还在");
  assert.doesNotMatch(comp, /borderTop: "8px solid " \+ t\.accent/, "小组件那个填色三角还在");
});

test("一起听是一张唱片从纸套里抽出来，不是圆头像加进度条", () => {
  const mw = cut("function MusicWidget(", "// 全局悬浮迷你播放器");
  assert.match(mw, /repeating-radial-gradient\(circle at 50% 50%, #26262b/, "碟上的纹路没了");
  assert.match(mw, /inset -6px 0 10px -6px rgba\(0,0,0,\.5\)/, "纸套的套口没了");
  // 进度＝唱针走到哪儿，不是通用那条圆角条
  assert.match(mw, /left: "calc\(4px \+ " \+ \(frac \? frac \* 100 : 0\) \+ "% \* 0\.96\)"/, "唱针没了");
  assert.doesNotMatch(mw, /height: 3, borderRadius: 999, background: "rgba\(0,0,0,0\.08\)"/, "又退回那条通用进度条了");
});

test("木鱼放在蒲团上，不是浮在一块发白的玻璃碟上", () => {
  const my = cut("function MuyuWidget(", "// 情侣空间轮播组件");
  assert.match(my, /id: "wkPuTuan"/);
  assert.match(my, /stroke: "#c99a5e"/, "蒲团的绲边没了");
  assert.doesNotMatch(my, /radial-gradient\(ellipse at 50% 36%/, "又退回那层发白的玻璃托盘了");
});

test("地图上那行版权缩回角落，但一个字都没删", () => {
  // 选择器和缩字号必须是同一条规则：分开判的话，只把选择器改坏、规则体留着也照样过
  assert.match(html, /\.wk-mapwidget \.leaflet-control-attribution \{[^}]*font-size: 6\.5px !important/,
    "没有这条，Leaflet 默认那行会横穿整张图");
  // ⚠️Esri 的免 key 瓦片要求署名：只许缩小，不许删
  assert.match(fs.readFileSync(P("js/map.js"), "utf8"), /attribution: 'Tiles &copy; Esri'/, "署名不许删");
});
