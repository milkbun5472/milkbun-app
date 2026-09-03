const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const grab = (a, b, cap) => {
  const i = comp.indexOf(a), j = comp.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return comp.slice(i, j);
};
const pane = grab("function GlassPane({", "function GlassCard({", 1400);
const card = grab("function GlassCard({", "function GlassIcon({", 1400);
const layers = grab("function glassLayers(radius)", "// 图标底下那行字", 2200);

// 她 2026-08-30：「主界面背景和图标能不能弄更液态玻璃风格，
// 然后就算放背景图也会保留液态显示」——原来那块是 85% 白的塑料板，铺了壁纸也只看得见奶白。
test("玻璃是透的：填色压到一半以下，靠 backdrop-filter 把底下的东西吸上来", () => {
  // ⚠️这条线只对【没铺壁纸】那一档成立。v61.40 起玻璃分两档：
  //   她 2026-09-03 报「放了背景日历也太透了看不见了」——花壁纸底下 0.3 的白
  //   压不住日历那些细线和小号数字，那一档必须更厚。
  //   所以分开钉：素色那档照旧压到一半以下，壁纸那档准它厚、但也不许厚成白板。
  const fill = pane.slice(pane.indexOf("background:"), pane.indexOf("backdropFilter:"));
  const all = (fill.match(/rgba\(255,255,255,([\d.]+)\)/g) || [])
    .map(x => parseFloat(x.match(/,([\d.]+)\)$/)[1]));
  assert.ok(all.length >= 4, "两档填色抠不全，只有 " + all.length + " 个停点");
  const wall = all.slice(0, 3), plain = all.slice(3);
  assert.ok(Math.max.apply(null, plain) <= 0.5,
    "素色底下又糊成不透明的白板了：最厚一层 " + Math.max.apply(null, plain));
  assert.ok(Math.max.apply(null, wall) > Math.max.apply(null, plain),
    "铺了壁纸那一档没有更厚，日历还是会看不见");
  assert.ok(Math.max.apply(null, wall) <= 0.7,
    "壁纸那一档厚过头了，玻璃变成白板：最厚一层 " + Math.max.apply(null, wall));
});

// saturate 是「磨砂白 → 玻璃」的分水岭：玻璃把背后的颜色提亮加浓，磨砂只把它磨白
test("模糊里带 saturate 和 brightness，不是单纯磨白", () => {
  const i = comp.indexOf("const GLASS_BLUR =");
  const lineEnd = comp.indexOf("\n", i);
  const def = comp.slice(i, lineEnd);
  assert.match(def, /blur\(/);
  assert.match(def, /saturate\(1\.[5-9]\d*\)/, "没有 saturate，铺了壁纸只会磨成一片白");
  assert.match(def, /brightness\(/, "没有 brightness，没壁纸时在米白底上看不出是玻璃");
});

test("边缘要有折光和镜面高光两层", () => {
  assert.match(layers, /key: "spec"/, "镜面高光那层没了");
  assert.match(layers, /key: "rim"/, "折光边那层没了");
  assert.match(layers, /inset 0 1\.2px/, "内圈上沿那道亮线没了");
  assert.match(layers, /pointerEvents: "none"/, "装饰层挡住点击了");
  assert.match(layers, /"aria-hidden": "true"/, "纯装饰层要对读屏隐藏");
});

// 一层做法只写一处：图标、文件夹、组件卡、dock 用的必须是同一份配方
test("同一份配方，四处共用，没人自己另配一套", () => {
  // ⚠️钉的是「用的是公共那份」，不是「写着 GLASS_BLUR 这五个字」。
  //   v61.40 玻璃分成两档之后，公共那份从常量变成了 glassFill(onWallpaper)——
  //   意思没变（还是一处画、处处用），这条却会红。那冻的是长相不是行为。
  const shared = /backdropFilter: GLASS_BLUR|glassFill\(onWall\)|fill\.backdropFilter/;
  assert.match(pane, shared, "GlassPane 没用公共配方");
  assert.match(card, shared, "组件卡没用公共配方");
  assert.match(comp, /function glassFill\(onWallpaper\)/, "公共那份不见了");
  const dock = grab('// dock 跟图标同一块玻璃', "}\n  }, dock.map(", 900);
  assert.match(dock, /saturate\(1\.9\) brightness\(1\.05\)/, "dock 没跟上");
  // 凡是白玻璃就不许再有人手写自己那套模糊（压暗的遮罩、深色药丸不算白玻璃）。
  // 合法的例外：HOME_WIDGET_PRESETS 里的「雾面」——那是她一个一个组件自己挑的外观预设
  // （六选一），本来就该跟系统那层玻璃长得不一样，名字就叫雾面。
  const from = comp.indexOf("function GlassPane({"), to = comp.indexOf("function HomeCard(");
  assert.ok(from > 0 && to > from, "抠不出主屏那一段");
  const raw = comp.slice(from, to).split("\n").filter(l => /backdropFilter: "blur\(\d+px\)"/.test(l)
    && /background: "rgba\(255,255,255/.test(l)
    && !/id === "soft"/.test(l)
    // 主屏拖拽时跟着手指走的那个影子：pointerEvents:none，它不是一块要看的玻璃
    && !/pointerEvents: "none"/.test(l));
  assert.deepEqual(raw, [], "还有白玻璃自己另配了一套模糊：\n" + raw.join("\n"));
});

test("图标磁贴的尺寸和圆角一个都没动", () => {
  const icon = grab("function GlassIcon({", "// 文件夹磁贴", 2600);
  assert.match(icon, /radius: 17/);
  assert.match(icon, /width: 62, height: 62/);
});

// 壁纸亮起来的地方墨字会糊掉；深色壁纸上墨字直接没了
test("铺了壁纸时字翻成白的，四处都翻", () => {
  const ink = grab("function glassLabelInk(", "// 一片玻璃：", 700);
  assert.match(ink, /onWallpaper[\s\S]*color: "#fff"[\s\S]*textShadow/, "没壁纸就该墨字，有壁纸就该白字");
  assert.match(ink, /color: t\.sub/, "没壁纸那一支没了");
  // 每一个用到 GlassIcon / FolderIcon 的地方都得把这件事告诉它
  const sites = comp.split("\n").filter(l => /h\(GlassIcon,|React\.createElement\(GlassIcon|h\(FolderIcon,/.test(l));
  assert.ok(sites.length >= 3, "找不到图标的调用处");
  // dock 那处是多行写法，下面单独看
  const missed = sites.filter(l => !/onWallpaper/.test(l) && !/dock\.map/.test(l));
  assert.deepEqual(missed, [], "这几处没接上壁纸判断：\n" + missed.join("\n"));
  // dock 那个是多行写法，单独看
  const dockIcon = grab("}, dock.map(a => /*#__PURE__*/React.createElement(GlassIcon, {", "})))), editMode", 500);
  assert.match(dockIcon, /onWallpaper: !!wallpaper/, "dock 上那四个没接");
  // 时钟和页码点也是同一件事
  assert.match(comp, /wallpaper \? \{ color: "#fff", textShadow: "0 2px 10px/, "时钟没跟着翻");
  assert.match(comp, /pi === page \? \(wallpaper \? "rgba\(255,255,255,0\.95\)"/, "页码点没跟着翻");
});

// .claude/rules/home-screen-layout.md：主屏的骨架一个都不许动，这次只动上色
test("主屏骨架没被这次改玻璃碰到", () => {
  // v58.48 起 Home 只剩一支（没壁纸那块底搬去了根节点，两支合并成一支）
  assert.equal((comp.match(/height: "100vh"/g) || []).length, 1);
  assert.match(comp, /className: "relative flex-1 min-h-0 overflow-hidden pt-3 flex flex-col"/);
  assert.match(comp, /env\(safe-area-inset-top\)/);
  assert.match(comp, /COMPOSER_PAD_BOTTOM|calc\(env\(safe-area-inset-bottom\) \+ 26px\)/);
});
