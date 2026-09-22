// 她 2026-09-22：「我们没有单独导入导出某一种美化的选项！比如只导入 app 图标
// 或者只导入背景。然后单独的聊天界面美化也没有导入导出」。
//
// 查下来：导入那头 v72.26 已经是勾选了，导出那头一直是【整套或没有】；
// 聊天气泡那一页压根没有自己的口子（只能从主题工作台整套带走）。
// 三处共用同一份名单（ThemeStudio.PACK_PARTS）和同一种文件（kind:"lisa-theme"）——
// 另造一种「气泡专用格式」的话，主题工作台那头收不了它。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const P = f => fs.readFileSync(f, "utf8");
const studioSrc = P("js/theme-studio.js"), ui = P("js/theme-studio-ui.js"), screens = P("js/screens.js");

function loadStudio() {
  const memory = new Map();
  const window = { addEventListener() {}, dispatchEvent() {} };
  const context = {
    window,
    localStorage: { getItem: k => memory.get(k) || null, setItem: (k, v) => memory.set(k, String(v)) },
    document: { readyState: "loading", addEventListener() {}, getElementById() { return null; }, createElement() { return {}; }, head: { appendChild() {} } },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
    setTimeout, clearTimeout, console, Date, JSON, Blob, FileReader: function () {}
  };
  vm.runInNewContext(studioSrc, context);
  // 字体那一支在真 app 里由 FontChoice 洗；这儿给一份最小的，不然 normalize 会把它洗成空的
  window.FontChoice = { clean: f => ({ body: (f && f.body) || "", display: (f && f.display) || "" }),
    customList: () => [], cssVars: () => "", fileRefs: () => [], ensure() {} };
  return window.ThemeStudio;
}
// 一份「什么都弄过」的样子：图标、CSS、字体、配色、壁纸、气泡各一样
const full = s => ({
  profile: s.normalize({ icons: { cast: "iv_icon" }, globalCSS: "body{color:red}", fonts: { body: "songti" } }),
  baseTheme: { ink: "#111" }, wallpaper: "iv_wall", bubbleSkin: { myBg: "#fff" }
});

test("这一样到底有没有，只有一处说了算", () => {
  const s = loadStudio();
  const parts = s.packParts(full(s));
  assert.equal(parts.map(x => x.key).join(","), "css,icons,fonts,base,wall,bubble");  // vm 里的数组跟这边不同源，比字符串
  assert.ok(parts.every(x => x.has), "全都弄过，却有一样说没有");
  const empty = s.packParts({ profile: s.normalize({}) });
  assert.ok(empty.every(x => !x.has), "什么都没有，却有一样说有");
});

test("只挑图标导出，包里就只有图标", async () => {
  const s = loadStudio();
  const pkg = JSON.parse(await s.exportPackage(Object.assign({}, full(s), { pick: { icons: true } })));
  assert.equal(pkg.kind, "lisa-theme", "换了一种文件——那头就收不了了");
  assert.equal(pkg.profile.icons.cast, "iv_icon");
  assert.equal(pkg.profile.globalCSS, "", "没挑的 CSS 也跟着装走了");
  assert.equal(pkg.profile.fonts.body, "", "没挑的字体也跟着装走了");
  assert.equal(pkg.baseTheme, undefined);
  assert.equal(pkg.wallpaper, undefined);
  assert.equal(pkg.bubbleSkin, null);
  // 装包的时候也只认这一样：拆包那头读出来的「有哪几样」要跟着变
  const has = s.packParts(pkg).filter(x => x.has).map(x => x.key);
  assert.equal(has.join(","), "icons");
});

test("只挑背景导出，包里就只有背景", async () => {
  const s = loadStudio();
  const pkg = JSON.parse(await s.exportPackage(Object.assign({}, full(s), { pick: { wall: true } })));
  assert.equal(pkg.wallpaper, "iv_wall");
  assert.equal(Object.keys(pkg.profile.icons).length, 0, "没挑的图标也跟着装走了");
  assert.equal(s.packParts(pkg).filter(x => x.has).map(x => x.key).join(","), "wall");
});

test("不传 pick 还是整套（存量那条路一个字都不用改）", async () => {
  const s = loadStudio();
  const pkg = JSON.parse(await s.exportPackage(full(s)));
  assert.equal(s.packParts(pkg).filter(x => x.has).map(x => x.key).join(","), "css,icons,fonts,base,wall,bubble");
});

// ⚠️这一条是新口子带出来的真风险：单挑一样导出的包，别的格子是空的。
//   导入那头原来【一律全勾】，勾着 CSS 就把她现在的 CSS 抹成空的了。
test("导进来只勾这份包真的带了的那几样", () => {
  assert.ok(/const sel = \{\}; studio\.packParts\(pack\)\.forEach\(x => \{ sel\[x\.key\] = x\.has; \}\);/.test(ui),
    "又变回一律全勾了——只带图标的那种包会把她的 CSS 抹平");
  assert.ok(!/const sel = \{ css: true, icons: true/.test(ui), "还留着写死全勾的那一份");
});

test("导出那头也能挑，而且跟导入共用同一排方块", () => {
  assert.ok(/const partRows = \(parts, sel, onToggle, missZh\) =>/.test(ui), "没有共用那一排");
  assert.equal((ui.match(/partRows\(/g) || []).length, 2, "导出或导入有一头没走共用那排");
  assert.ok(/pick: xPick/.test(ui), "导出没把挑的那几样带下去");
  assert.ok(/至少挑一样再导出/.test(ui), "一样都没挑也让她导出一个空包");
});

// 聊天气泡那一页自己的口子
test("聊天气泡能单独收发，而且走的还是主题包那一种文件", () => {
  const i = screens.indexOf("function BubbleSkinConfig({ toast }) {");
  const j = screens.indexOf("function ThemeConfig(", i);
  assert.ok(i > 0 && j > i, "抠不出 BubbleSkinConfig");
  const seg = screens.slice(i, j);
  assert.ok(/pick: \{ bubble: true \}/.test(seg), "导出的不是「只有气泡」那一包");
  assert.ok(/st\.exportPackage\(/.test(seg) && /st\.importPackage\(/.test(seg), "另造了一套收发，没走主题包那一处");
  assert.ok(/st\.packHas\(pack, "bubble"\)/.test(seg), "没判断这份文件里到底有没有气泡");
  assert.ok(/这份文件里没有【聊天气泡】这一样/.test(seg), "文件里没有气泡时闷着不吭声");
  // 导进来只进草稿：这一页本来就是「改草稿 → 点保存皮肤」
  assert.ok(/setS\(Object\.assign\(\{\}, BUBBLE_SKIN_DEFAULTS, pack\.bubbleSkin\)\)/.test(seg), "导入没进草稿");
  assert.ok(!/writeBubbleSkin\(pack\.bubbleSkin\)/.test(seg), "导入直接落盘了——她还没看见长什么样");
  // 手机上挑不开文件的那条路，用的是共用那一份贴框
  assert.ok(/window\.ThemePackPasteBox/.test(seg), "没有贴一份的入口");
  assert.ok(/function ThemePackPasteBox\(/.test(ui), "贴框不在共用那一处");
  assert.equal((ui.match(/function ThemePackPasteBox\(/g) || []).length, 1);
});
