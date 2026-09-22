// 她 2026-09-22 转来的截图：QQ 内置浏览器把下载接管成自己那个「文件下载」页
// （archive-ba…json · 231.73KB · 使用QQ下载文件），文件进了它的沙盒，人再也找不着 ——
// 「宝宝这个导不出来数据」。
//
// 剪贴板不归内置浏览器管，所以退路是【复制走 / 贴回来】。
// 这一份钉住：两条导出路只攒一份备份文本，两条导入路只有一份实现，
// 失败的时候她贴的那一大段不许被清掉。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const screens = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");

test("备份文本只攒一份，存文件和复制都问它要", () => {
  assert.match(app, /const buildExportPack = async \(\) => \{/, "没有公共那一份");
  const i = app.indexOf("const doExport = async () => {"), j = app.indexOf("const inAppBrowser = ()", i);
  assert.ok(i > 0 && j > i, "抠不出 doExport");
  const seg = app.slice(i, j);
  assert.match(seg, /const pack = await buildExportPack\(\)/, "存文件那条自己又攒了一份");
  assert.match(seg, /saveTextFile\(pack\.name, pack\.text/);
  // 图库读失败那道闸还在，而且现在要返回 null（不然复制那条会照样吐出一份残档）
  assert.match(app, /图库却一张都读不出来/);
  assert.match(app, /return null;\n {4}\}/, "那道闸没有返回 null，复制那条会绕过它");
  const cp = app.slice(app.indexOf("const doCopyExport = async () => {"), app.indexOf("// ⚠️导入分两条路"));
  assert.match(cp, /const pack = await buildExportPack\(\)/, "复制那条自己又攒了一份");
  assert.match(cp, /if \(!pack\) return;/, "复制那条没认那道闸");
});

// ⚠️复制这件事 v71.12 刚把全库四处手写的搬进 components.js 的 copyText。
//   这儿再手写一份就是第五处（新接口 → execCommand 老路那两段会各缺各的）。
test("复制走公共那一处，不自己再写一份", () => {
  const cp = app.slice(app.indexOf("const doCopyExport = async () => {"), app.indexOf("// ⚠️导入分两条路"));
  assert.match(cp, /const ok = await copyText\(pack\.text\)/, "没走公共那处复制");
  assert.doesNotMatch(app, /navigator\.clipboard/, "又有人自己写 navigator.clipboard 了");
  assert.match(cp, /这个浏览器不让复制这么大一段/, "复制失败闷着不吭声 —— 又一颗看着像死的按钮");
  assert.match(cp, /数据还在，没有丢/, "没说清失败之后数据怎么样");
});

test("导入两条路只有一份实现", () => {
  assert.match(app, /const doImportText = async raw => \{/, "没有公共那一份");
  assert.match(app, /JSON\.parse\(raw\)/);
  assert.equal((app.match(/if \(!parsed\.__archive \|\| !parsed\.data\)/g) || []).length, 1, "校验写成了两份");
  const fi = app.indexOf("const doImport = file => {");
  const seg = app.slice(fi, fi + 420);
  assert.match(seg, /doImportText\(String\(e\.target\.result \|\| ""\)\)/, "选文件那条没走公共那处");
  assert.match(seg, /r\.onerror/, "文件读不出来的时候闷着不吭声");
});

test("失败要返回 false，她贴的那一大段不许被清掉", () => {
  assert.match(app, /toast\("导入失败：内容损坏或不是备份文件"\);\s*\n\s*return false;/);
  assert.match(app, /toast\("格式不对，这不像是这个 app 的备份"\);\s*\n\s*return false;/);
  assert.match(screens, /onText: text => onImportText\(text\)/, "包了一层 return true，失败也会把她贴的清掉");
});

test("界面：复制那一颗和贴那一格都在，内置浏览器多一句提醒", () => {
  assert.match(screens, /复制整份备份（下载不下来时用这个）/);
  assert.match(screens, /贴一份备份（复制来的那一大段）/);
  assert.match(screens, /window\.ThemePackPasteBox/, "又自己画了一个贴框");
  assert.match(screens, /你现在是在 QQ／微信这类 app 自带的浏览器里打开的/);
  assert.match(app, /const inAppBrowser = \(\) =>/);
  ["MicroMessenger", "QQBrowser", "Weibo", "baiduboxapp"].forEach(ua =>
    assert.ok(app.includes(ua), "UA 名单里少了：" + ua));
  // ⚠️复制那颗不许藏在「判出内置浏览器才显示」后面：UA 永远判不全
  const i = screens.indexOf("复制整份备份（下载不下来时用这个）");
  const before = screens.slice(i - 300, i);
  assert.doesNotMatch(before, /inAppBrowser \?[^:]*$/, "复制那颗被藏进 UA 判断里了");
});
