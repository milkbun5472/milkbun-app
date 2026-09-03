// v61.38 她 2026-09-03：想要照片壁纸（像她发的那两张参考），不要纯色。
// 功能本来就有（外观与壁纸 → 从相册选择），缺的是照片上那一层：
// 参考图里的照片都压着一层很淡的白纱，所以任何照片都压得住图标；
// 我们原来是照片原样直接铺，什么都没压，图挑深一点就翻车。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const scr = fs.readFileSync("js/screens.js", "utf8");

test("两个数存一处，读写共用同一把收口尺", () => {
  assert.match(app, /const clampFx = \(v, dflt, max\) =>/);
  assert.match(app, /saveJSON\("x_wallFx", n\)/);
  assert.match(app, /loadJSON\("x_wallFx", null\)/);
  // 载入和保存【都】走 clampFx —— 只在一头收口，另一头进来的脏值照样落盘
  assert.match(app, /setWallFx\(\{ veil: clampFx\(f\.veil, 22\), blur: clampFx\(f\.blur, 0, 20\) \}\)/);
  assert.match(app, /const n = \{ veil: clampFx\(f && f\.veil, 22\), blur: clampFx\(f && f\.blur, 0, 20\) \};/);
});

test("面纱那一层是 z-index:-1，而且父节点这时才开层叠上下文", () => {
  // ⚠️负层叠的孩子只有在父节点自己是层叠上下文时才停在父节点背景【上面】；
  // 否则它会掉到壁纸底下，渲染出来一点变化都没有（这一版第一稿就是这么坏的）。
  assert.match(app, /zIndex: -1, pointerEvents: "none"/);
  assert.match(app, /isolation: \(screen === "home" && wallpaper && \(wallFx\.veil > 0 \|\| wallFx\.blur > 0\)\) \? "isolate" : undefined/);
});

test("不碰根节点的布局：高度、flex、那条 safe-area 空带原样", () => {
  const i = app.indexOf('className: "w-full flex flex-col relative overflow-hidden"');
  const root = app.slice(i, i + 2600);
  assert.match(root, /height: "100vh"/);
  assert.ok(root.indexOf("isolation:") > 0, "面纱那一层没接上");
  // 空带仍旧只在主屏出现，值也没动
  assert.match(app, /const _safeTop = \{ height: screen === "home" \? "env\(safe-area-inset-top\)" : 0 \};/);
});

test("blur 要往外扩一圈，否则四边一圈淡边", () => {
  // backdrop-filter 在边缘会取到画布外的透明像素；根节点本来就 overflow-hidden，扩出去会被切掉
  assert.match(app, /inset: -\(wallFx\.blur \* 2 \+ 2\)/);
});

test("设置页有两个滑杆，滑的时候不落盘，松手才写", () => {
  assert.match(scr, /fxRow\("veil", "面纱", 60,/);
  assert.match(scr, /fxRow\("blur", "虚化", 20,/);
  assert.match(scr, /onMouseUp: \(\) => commitFx\(\), onTouchEnd: \(\) => commitFx\(\)/);
  // 缩略图上照着主屏画一遍，滑一格就看得见
  assert.match(scr, /inset: -\(fx\.blur \* 2 \+ 2\)/);
  // 没壁纸时不摆这两个滑杆（摆了也什么都改不了）
  assert.match(scr, /wallpaper \? h\("div", \{ style: \{ marginTop: 14 \} \},/);
});

test("props 一路传到设置页", () => {
  assert.match(app, /wallFx: wallFx,/);
  assert.match(app, /onSaveWallFx: f => \{/);
  assert.match(scr, /wallFx: props\.wallFx, onSaveWallFx: props\.onSaveWallFx/);
});
