// v63.54 她 2026-09-05：「一起听这些页面没弄 UI 弄一弄，然后播放音乐时封面背景
// 应该透到上面但是不是直接把主体移上去做 fade?」
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");

test("封面往上长到顶栏后面，正文一格没动", () => {
  // v62.96 那版把封面挂进滚动区，容器一裁它就永远上不去；现在挂在【外壳】上，跟顶栏平级
  assert.match(scr, /coverField,\n\s*h\("div", \{ style: \{ position: "relative", zIndex: 1 \} \}, h\(Head, \{ zh: "一起听"/);
  assert.match(scr, /h\("div", \{ className: "flex-1 overflow-y-auto", style: \{ position: "relative", zIndex: 1 \} \}, nav === "play"/);
  assert.doesNotMatch(scr, /isolation: "isolate" \} \}, coverField/, "封面还在滚动区里，那它上不去顶栏");
  // 正文没被上移：playTab 里那些位置一个字没改（还是同一个外壳类名）
  assert.match(scr, /const playTab = now \? h\("div", \{ className: "flex flex-col items-center px-6 pb-6" \}/);
});

test("顶栏那一带有薄底色，返回键和标题在任何封面上都读得清", () => {
  assert.match(scr, /顶栏那一带的薄底色/);
  assert.match(scr, /height: safeTop\(96\)/);
  assert.match(scr, /linear-gradient\(to bottom," \+ t\.bg \+ "b8 0%," \+ t\.bg \+ "6b 55%,transparent 100%\)/);
  // 主题色不是六位 hex 时不许拼出废值（底纹静默消失那条老账）
  assert.match(scr, /hex6\(t\.bg\) \? "linear-gradient\(to bottom," \+ t\.bg/);
});

test("那条分隔线只在这一处撤，不是六十多页跟着一起变", () => {
  assert.match(comp, /, noLine/);
  assert.match(comp, /borderBottom: noLine \? "none" : "1px solid " \+ LINE/);
  assert.match(comp, /不做成「bg 透明就自动不画」/);
  // 只有播放页有封面时才撤
  assert.match(scr, /noLine: nav === "play" && !!now/);
});

test("歌单不是一叠圆角白卡，是插在箱子里的碟套", () => {
  const sl = scr.slice(scr.indexOf("function sleeve(extra, lit)"), scr.indexOf("const cvPlRow"));
  // 左右两边长得不一样：左边是脊（厚、暗），右边是开口（圆、有内影）
  assert.match(sl, /borderRadius: "3px 12px 12px 3px"/);
  assert.match(sl, /borderLeft: "3px solid " \+ edge/);
  assert.match(sl, /inset -7px 0 10px -9px/);
  // 主题墨色不是六位 hex 时退回纯色，不拼废值
  assert.match(sl, /hex6\(t\.ink\)\s*\?/);
  // 四处都用上了：网易云我喜欢的 / 本地收藏 / 歌单行 / 云歌单行 / 静音保活
  assert.ok((scr.match(/sleeve\(\{/g) || []).length >= 5, "碟套没铺开，还有地方是白卡");
  // ⚠️不许再铺纹理：她 2026-09-05 否过一次
  assert.match(scr, /不铺纹理：她 2026-09-05 已经否过一次/);
});

test("设置页是唱机背后那块板：直角、刻线、螺丝、槽", () => {
  assert.match(scr, /这一页是【唱机背后那块板】/);
  assert.match(scr, /borderRadius: 4, borderTop: "2px solid "/);
  assert.match(scr, /\[\["l", 6, 6\], \["r", null, 6\]\]/, "四角的螺丝是程序画的");
  // 输入框＝刻进去的槽，不是浮着的圆角框
  assert.match(scr, /输入框＝【刻在板子上的槽】/);
  assert.match(scr, /boxShadow: hex6\(t\.ink\) \? "inset 0 2px 4px -2px "/);
});
