// 她 2026-09-06：「主题台的 css 还是不显示啊」。
//
// ⚠️主题台那条链是好的（commit → <style> → 落到 html[data-lisa-screen="home"] 上，
//   刷新也还在）。病根是【主屏上一个挂点都没有】：全屏只有最外那层 data-wk="app"，
//   图标、dock、组件卡、时钟、页码点一个都没挂。给主屏写的 CSS 因此抓不到任何东西——
//   写得再对也一条不生效，界面上还什么都不说。
//
// 这一版给主屏埋上挂点，并且把「哪几页有哪些钩子」收成一张表（WK_SCOPED）：
// 聊天页是第一组，主屏是第二组；来第三组也不用再动秋秋和编辑器那两处。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const comp = R("js/components.js"), studio = R("js/theme-studio.js"), ui = R("js/theme-studio-ui.js");
const home = comp.slice(comp.indexOf("function Home({"), comp.indexOf("function HomeCard({"));
assert.ok(home.length > 5000, "抠不出主屏那一段");

test("主屏那一组挂点登记在表里，页名就是 home", () => {
  const blk = studio.slice(studio.indexOf("const WK_SCOPED"), studio.indexOf("const SLOT_KEY"));
  assert.match(blk, /zh: "主屏", pages: Object\.freeze\(\["home"\]\)/, "主屏没在表里");
  // ⚠️页名必须是 core.js 那份【全库唯一的页名单】里真有的那一个，
  //   不然作用域 html[data-lisa-screen="home"] 永远匹配不到（写歪了也不会报错）。
  assert.match(R("js/core.js"), /^\s*home: "主屏"/m, "core.js 里没有 home 这一页");
  ["icon", "iconlabel", "dock", "widget", "decor", "homeclock", "homeclockink", "homedate", "pager", "pagerdot"]
    .forEach(n => assert.ok(blk.indexOf('["' + n + '", "') >= 0, "表里少了 " + n));
});

test("主屏那几个挂点真的挂在主屏上，不是只写在名单里", () => {
  // ⚠️桩钉在【画它那一头】：谁改了这几行，这条当场红——
  //   不然秋秋和她都会照着一张过期的地图写 CSS，而且照样不报错。
  const icon = comp.slice(comp.indexOf("function GlassIcon("), comp.indexOf("function FolderIcon("));
  assert.match(icon, /"data-wk": "icon"/, "自带底那一支的图标格没挂");
  assert.match(icon, /wk: "icon"/, "玻璃那一支的图标格没挂");
  assert.match(icon, /"data-wk": "iconlabel"/, "图标底下那行字没挂");
  const folder = comp.slice(comp.indexOf("function FolderIcon("), comp.indexOf("function FolderOverlay("));
  assert.match(folder, /wk: "icon"/, "文件夹磁贴没挂（它也是主屏上的一格）");
  assert.match(folder, /"data-wk": "iconlabel"/, "文件夹的名字没挂");
  // GlassPane 得真的把 wk 转成 data-wk，不然上面两处传了也白传
  const pane = comp.slice(comp.indexOf("function GlassPane("), comp.indexOf("function GlassCard("));
  assert.match(pane, /children, wk \}/, "GlassPane 没收这个参数");
  assert.match(pane, /"data-wk": wk \|\| undefined/, "GlassPane 收了却没挂上去");
  // 主屏自己那几处
  assert.match(home, /"data-wk": "dock"/, "dock 那一条没挂");
  assert.match(home, /"data-homeclock": "1", "data-wk": "homeclock"/, "时钟那一块没挂");
  assert.match(home, /"data-wk": "homeclockink"/, "时钟的数字没挂");
  assert.match(home, /"data-wk": "homedate"/, "日期那行没挂");
  assert.match(home, /"data-wk": "pager"/, "页码点那一行没挂");
  assert.match(home, /"data-wk": "pagerdot", "data-on": pi === page \? "1" : "0"/, "单个点没挂（或者认不出当前页）");
  assert.match(home, /"data-wk": it\.kind === "widget" \? "widget" : it\.kind === "decor" \? "decor" : undefined/, "组件格/装饰格没挂");
});

test("页码点浮在上面，不占一条实块", () => {
  // 她 2026-09-06：「那几个点是在一条实块上面的导致这个实块挡住了可以显示的内容，
  // 没有实块的话木鱼和转盘能露出来的部分会多一点」。
  // 量过：格子区比可视区高出 68px、超出的被 overflow-hidden 切掉，而这一条在流里还吃掉 14px。
  const dots = home.slice(home.indexOf('"data-wk": "pager"'));
  assert.match(dots.slice(0, 200), /className: "absolute left-0 right-0 flex justify-center gap-1\.5 pointer-events-none"/,
    "页码点又回到流里了（或者会挡住底下那一排的点击）");
  assert.ok(dots.slice(0, 300).indexOf("shrink-0") < 0, "页码点还占着一条实块");
});

test("编辑器把这一页抓得住的挂点列给她看，名单只问 ThemeStudio 要", () => {
  // ⚠️她自己在主题台里写 CSS，界面上却从没说过能抓什么——只能猜类名，
  //   而这个 App 没有语义 class（只有 Tailwind 工具类），猜出来的一条都不生效。
  const css = ui.slice(ui.indexOf('section === "css"'), ui.indexOf("内置（点一下灌进上面的编辑框"));
  assert.match(css, /studio\.WK_COMMON \|\| \[\]/, "没列每页都有的那几个");
  assert.match(css, /\(studio\.WK_SCOPED \|\| \[\]\)\.filter/, "没按当前这一页去表里找专有的那一组");
  // ⚠️名单不许在这儿另抄一份（抄了迟早跟表对不上）
  assert.ok(!/\["icon", "/.test(ui) && !/\["bubble", "/.test(ui), "编辑器里又抄了一份钩子表");
  assert.match(css, /每一条声明都要带 !important/, "没告诉她内联样式压不过");
  assert.match(css, /这一页只有上面这几个通用的/, "没在没有专有挂点的页面上说实话");
});
