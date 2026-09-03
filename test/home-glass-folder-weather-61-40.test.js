// 她 2026-09-03 一次报了三件，全在主屏：
//   ①「我自己放了个图标上去但是他在文件夹里显示不出来更新的图标」
//   ②「放了背景日历也太透了看不见了，其他的组件基本上也是」
//   ③「我点了天气组件的话翻回上一页才会看到一个半屏的玩意还关不掉」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const rule = fs.readFileSync(path.join(root, ".claude/rules/no-half-sheet.md"), "utf8");
const cut = (from, to, what) => {
  const i = comp.indexOf(from); assert.ok(i > 0, "抠不出" + what);
  const j = comp.indexOf(to, i); assert.ok(j > i, "抠不出" + what + "的结尾");
  return comp.slice(i, j);
};

test("① 文件夹盖着的时候也用她换的那张图标", () => {
  const fi = cut("function FolderIcon(", "function FolderOverlay(", "文件夹磁贴");
  // v61.44：「这个 app 显示哪张图」收成了一个 appIconSrc（她自己换的 → 自带图 → 线稿）。
  // 这一格自己抄一份优先级，正是它两次显示错图标的原因。
  assert.match(fi, /const src = appIconSrc\(a\.key\);/, "文件夹磁贴没查自定义图标");
  assert.match(fi, /h\("img", \{ src: src/, "查了却没画出来");
  // 有自定义图时不许再垫那层白底——她那张图自己就是一整块画面
  assert.match(fi, /src \? "transparent" : "rgba\(255,255,255,0\.52\)"/, "自定义图标底下还垫着白块");
  // 展开层那一侧本来就是对的（用 GlassIcon），所以「点开对、盖上错」才更像坏了
  const fo = cut("function FolderOverlay(", "\nfunction ", "文件夹展开层");
  assert.match(fo, /GlassIcon/, "展开层不再用 GlassIcon 的话，这条推理要重写");
});

test("② 铺了壁纸时玻璃厚一档——而且只有铺了壁纸才厚", () => {
  assert.match(comp, /function glassFill\(onWallpaper\)/, "玻璃的配方没抽出来");
  const gf = cut("function glassFill(onWallpaper)", "\n}", "glassFill");
  const a = [...gf.matchAll(/rgba\(255,255,255,(0\.\d+)\)/g)].map(m => Number(m[1]));
  assert.ok(a.length >= 6, "两档填色抠不全");
  const wall = a.slice(0, 3), plain = a.slice(3, 6);
  wall.forEach((v, i) => assert.ok(v > plain[i],
    "壁纸那一档第 " + (i + 1) + " 个停点没有更厚（" + v + " vs " + plain[i] + "）"));
  // ⚠️没壁纸时那份薄才是她要的玻璃感，不许无条件加厚
  assert.ok(Math.max.apply(null, plain) <= 0.4, "素色底下的玻璃被顺手加厚了");
  // 素色那一档用的是 GLASS_BLUR 常量，不是字面量，所以拿常量去比
  const base = Number((comp.match(/const GLASS_BLUR = "blur\((\d+)px\)/) || [])[1]);
  const wallBlur = Number((gf.match(/blur\((\d+)px\) saturate/) || [])[1]);
  assert.ok(base > 0 && wallBlur > base,
    "壁纸那一档没有糊得更狠（" + wallBlur + " vs " + base + "）");
});

test("② 这块玻璃只有一份配方，日历不许再自己抄一遍", () => {
  // 原来 CalWidget 里逐字抄了一份一模一样的渐变 + GLASS_BLUR，
  // 于是「加厚」得记着改两处——迟早只改一处。
  const cal = cut("function CalWidget(", "\nfunction ", "日历组件");
  assert.match(cal, /\.\.\.glassFill\(onWall\)/, "日历没用共用的那份配方");
  assert.doesNotMatch(cal, /linear-gradient\(160deg, rgba\(255,255,255,0\.38\)/, "日历里那份抄来的还在");
  const card = cut("function GlassCard(", "\n// ====", "GlassCard");
  assert.match(card, /\.\.\.glassFill\(onWall\)/, "GlassCard 没用共用配方");
});

test("② 壁纸这件事挂在 context 上，不是一路当 props 传", () => {
  assert.match(comp, /const OnWallpaperCtx = createContext\(false\);/);
  // 主屏那些组件有九个，各自又往 GlassCard 里传一遍，那就是「一层写在九处」
  assert.match(app, /OnWallpaperCtx\.Provider[\s\S]{0,600}?value: !!wallpaper/,
    "app.js 里没把 Provider 套上，context 永远是 false");
  // ⚠️不许顺手动主屏根节点（home-screen-layout.md）
  const home = cut('className: "flex flex-col relative"', "overflow-hidden pt-3", "Home 根节点");
  assert.match(home, /height: "100vh"/, "主屏根节点被动了");
  assert.match(home, /background: "transparent"/, "主屏根节点被动了");
});

test("③ 天气详情是整页，而且 portal 到 body", () => {
  const w = cut("function WeatherWidget(", "\nfunction LedgerWidget(", "天气组件");
  // 病根：Sheet 是 absolute inset-0，主屏是横向分页的，它锚到的是那一页的格子容器，
  // 不是屏幕——所以半窗掉在上一页上，关闭用的背景也跟着错位，点不到。
  assert.doesNotMatch(w, /h\(Sheet, \{/, "天气详情还是半窗");
  assert.match(w, /ReactDOM\.createPortal/, "没 portal 出去，还会被主屏的 transform 容器锚住");
  assert.match(w, /document\.body\) : null;/, "portal 的落点不是 body");
  assert.match(w, /position: "fixed", inset: 0/, "不是整页");
  assert.match(w, /h\(Head, \{ zh: "天气"/, "整页没有那条紧凑顶栏，就没有返回键——照样关不掉");
  // 规矩自己也得还在：不然下一个人又会顺手摆个半窗
  assert.match(rule, /默认用整页，不要用半窗/);
});
