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
  assert.match(app, /const buildExportPack = async \(opts\) => \{/, "没有公共那一份");
  const i = app.indexOf("const doExport = "), j = app.indexOf("const inAppBrowser = ", i);
  assert.ok(i > 0 && j > i, "抠不出 doExport");
  const seg = app.slice(i, j);
  assert.match(seg, /const pack = await buildExportPack\(\)/, "存文件那条自己又攒了一份");
  assert.match(seg, /saveTextFile\(pack\.name, pack\.text/);
  // 图库读失败那道闸还在，而且现在要返回 null（不然复制那条会照样吐出一份残档）
  assert.match(app, /图库却一张都读不出来/);
  assert.match(app, /return null;\n {4}\}/, "那道闸没有返回 null，复制那条会绕过它");
  const cp = app.slice(app.indexOf("const doCopyExport = "), app.indexOf("// ⚠️导入分两条路"));
  assert.match(cp, /const pack = await buildExportPack\(\{ noImages: true \}\)/, "复制那条自己又攒了一份，或者又把图打进去了");
  assert.match(app, /if \(!box \|\| partNo == null\)/, "点第 2、3 段时又把整份备份重打了一遍");
  assert.match(cp, /if \(!pack\) return;/, "复制那条没认那道闸");
});

// ⚠️复制这件事 v71.12 刚把全库四处手写的搬进 components.js 的 copyText。
//   这儿再手写一份就是第五处（新接口 → execCommand 老路那两段会各缺各的）。
test("复制走公共那一处，不自己再写一份", () => {
  const cp = app.slice(app.indexOf("const doCopyExport = "), app.indexOf("// ⚠️导入分两条路"));
  assert.match(cp, /const ok = await copyText\(body\)/, "没走公共那处复制");
  assert.doesNotMatch(app, /navigator\.clipboard/, "又有人自己写 navigator.clipboard 了");
  assert.match(cp, /这个浏览器不让复制这么大一段/, "复制失败闷着不吭声 —— 又一颗看着像死的按钮");
  assert.match(cp, /数据还在，没有丢/, "没说清失败之后数据怎么样");
});

// 她 2026-09-22：「复制直接崩了」——图是 base64 塞进 JSON 的，一份几十 MB，
// 往剪贴板／textarea 里塞，手机上就是把页面撑崩。
test("复制那一份不带图，而且太大了要先说一声", () => {
  const cp = app.slice(app.indexOf("const doCopyExport = "), app.indexOf("// ⚠️导入分两条路"));
  assert.match(cp, /noImages: true/, "复制又去打包图库了 —— 那正是崩的原因");
  assert.match(app, /const COPY_MAX = 8 \* 1024 \* 1024;/, "没有大小闸，够大照样崩");
  assert.match(cp, /太大了——换 Chrome／夸克/, "太大的时候没当面说，她只会以为又坏了");
  // 不带图这件事必须写在脸上，不许悄悄少图
  assert.match(app, /只有文字：角色、聊天、记忆、手机、情侣空间这些；⚠️不含图片和自拍/);
  assert.match(screens, /不含图片和自拍/, "界面上没说这一份没带图");
  // ⚠️最要命的一条：拿这份不含图的备份去恢复，绝不许把本机的图清空
  const imp = app.slice(app.indexOf("const doImportText = "), app.indexOf("// ---- routing ----"));
  assert.match(imp, /const vaultRows = parsed\.vault \? Object\.entries\(parsed\.vault\) : \[\];/);
  assert.match(imp, /if \(vaultRows\.length &&/, "备份里没带图也照样清仓 —— 那会把她的头像壁纸全清光");
});

// 她 2026-09-22：「太大了可以复制但是粘贴不了」——微信输入框、备忘录、
// 连我们自己这个文本框，对一次粘贴多大各有各的脾气。整份切成段一段一段发。
test("切段：先转 base64 再切，所以粘贴路上被加的空白不会改坏正文", () => {
  assert.match(app, /const COPY_PART = 200 \* 1024;/, "每段多大没定死");
  const cp = app.slice(app.indexOf("const doCopyExport = "), app.indexOf("// 贴进来的可能是"));
  assert.match(cp, /blobToDataUrl\(new Blob\(\[pack\.text\]\)\)/, "没转 base64 就切 —— 切口落在某条聊天的字符串中间，空白一改正文就变了");
  assert.match(cp, /for \(let i = 0; i < b64\.length; i \+= COPY_PART\)/, "切的不是 base64");
  assert.match(app, /const partHead = \(i, n, id\) =>/, "段没有段头，贴回去认不出是第几段");
});

test("拼回去：顺序不重要，空白一律删，缺段要说清还差哪几段", () => {
  const seg = app.slice(app.indexOf("const doImportPasted = "), app.indexOf("// ⚠️导入分两条路"));
  assert.ok(seg.length > 200, "抠不出 doImportPasted");
  assert.match(seg, /replace\(\/\\s\+\/g, ""\)/, "没把粘贴路上加进来的空白删掉");
  assert.match(seg, /for \(let k = 1; k <= n; k\+\+\) joined\.push\(bin\.got\[k\]\)/, "按贴进来的顺序拼 —— 她贴乱了就全错");
  assert.match(seg, /还差 " \+ miss\.join/, "缺段时没说还差哪几段");
  assert.match(seg, /这几段拼不回去/, "拼不回去时闷着，还会把半份数据导进去");
  // 段头认不出来的就当整份 JSON：存文件导出的那种照旧走得通
  assert.match(seg, /if \(!m\) \{ pasteBinRef\.current = null; return doImportText\(text\.trim\(\)\); \}/);
  // 碎片攒在内存里：几 MB 写进 localStorage 会把那 5MB 顶爆，而她正在恢复数据
  assert.match(app, /const pasteBinRef = useRef\(null\);/);
  assert.doesNotMatch(seg, /localStorage/, "碎片落盘了");
});

test("界面：分了段就把每一段摆出来，点过的打勾", () => {
  assert.match(screens, /这份备份切成了 " \+ copyParts\.parts\.length \+ " 段/);
  assert.match(screens, /onCopyExport\(k \+ 1\)/, "段按钮没把段号传下去");
  assert.match(screens, /copyParts\.done && copyParts\.done\[k \+ 1\] \? "✓ " : ""/, "复制过的那几段没记号，她会忘了发到哪一段");
  assert.match(screens, /一段一段贴，顺序不重要/, "没告诉她顺序不重要");
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
  assert.match(screens, /复制文字备份（下载不下来时用这个）/);
  assert.match(screens, /贴一份备份（复制来的那一段）/);
  assert.match(screens, /window\.ThemePackPasteBox/, "又自己画了一个贴框");
  assert.match(screens, /会把下载接管成它自己的「文件下载」页/);
  // ⚠️QQ 浏览器自己就是浏览器，没有「用浏览器打开」那个菜单
  //   （她 2026-09-22：「qq浏览器就是没有用浏览器打开的选项啊」）——别再教她去点那个。
  assert.doesNotMatch(screens, /用系统浏览器打开再导出/, "又在教她点一个不存在的菜单");
  assert.match(screens, /复制本页网址/, "没给她把网址搬去别的浏览器的路");
  assert.match(screens, /用 Chrome／夸克／手机自带的浏览器打开，再导出文件/);
  assert.match(app, /const inAppBrowser = \(\) =>/);
  ["MicroMessenger", "QQBrowser", "Weibo", "baiduboxapp"].forEach(ua =>
    assert.ok(app.includes(ua), "UA 名单里少了：" + ua));
  // ⚠️复制那颗不许藏在「判出内置浏览器才显示」后面：UA 永远判不全
  const i = screens.indexOf("复制文字备份（下载不下来时用这个）");
  const before = screens.slice(i - 300, i);
  assert.doesNotMatch(before, /inAppBrowser \?[^:]*$/, "复制那颗被藏进 UA 判断里了");
});
