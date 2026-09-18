// 她 2026-09-18 转了小红书群里读者的一句：「老大问问秋秋怎么换字体呀！」
//   然后问：「这个换字体咋弄没有的话能加吗」
//
// 这个功能全部的分量就在一句话上：**全 App 的字体只有两个出口，而且它们是变量**。
// 只要 core.js 那两行还是 var()，换字体就永远不用碰那四十来个文件、五千来处行内样式；
// 一旦有谁把它改回写死的字体名，这一栏当场变成一个点了没反应的按钮——所以下面第一条最要紧。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const F = require("../js/font-choice.js");

const root = path.join(__dirname, "..");
const core = fs.readFileSync(path.join(root, "js/core.js"), "utf8");
const studio = fs.readFileSync(path.join(root, "js/theme-studio.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "js/theme-studio-ui.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("字体的唯一出口：core.js 那两支必须是变量，不许写死", () => {
  assert.match(core, /const F_DISPLAY = "var\(--f-display,/, "F_DISPLAY 被写死了就换不动标题");
  assert.match(core, /const F_BODY = "var\(--f-body,/, "F_BODY 被写死了就换不动正文");
  // 兜底值要还在：没挑过字体、或者主题 CSS 没加载出来时，原样得是原来那套
  assert.ok(core.includes("'Fraunces',serif)"), "F_DISPLAY 的兜底丢了");
  assert.ok(core.includes("'Archivo','Noto Serif SC',system-ui,sans-serif)"), "F_BODY 的兜底丢了");
  assert.match(html, /font-family: var\(--f-body,/, "index.html 的 body 也得跟着走变量");
});

test("名单只有一份：工作台和界面都问 FontChoice 要", () => {
  assert.ok(studio.includes("g.FontChoice"), "theme-studio 没接上字体那一层");
  assert.ok(ui.includes("FC.facesWith(customFonts)"), "界面自己另抄了一份名单");
  assert.ok(!/FACES\.concat|\.\.\.FACES/.test(ui), "界面在自己拼名单——内置和自己传的怎么合，只归 FontChoice 管");
  // 另抄一份的样子：界面里直接出现具体字体名
  assert.ok(!/ZCOOL|Ma Shan Zheng|Noto Sans SC/.test(ui), "界面里不许出现具体字体名——名单只有 FontChoice 那一份");
});

test("挑了才发 CSS；一支都没挑就一个字都不发", () => {
  assert.equal(F.cssVars({ body: "", display: "" }), "");
  assert.equal(F.cssVars(null), "");
  const css = F.cssVars({ body: "heiti", display: "" });
  assert.ok(css.includes("--f-body"), "挑了正文却没写变量");
  assert.ok(!css.includes("--f-display"), "标题没挑，不许顺手把它也写掉");
});

test("认不出的一律落回默认，不许把变量写成空值", () => {
  // 存档是别人导出来的、或者名单以后删过某一支，都会走到这儿
  assert.deepEqual({ ...F.clean({ body: "不存在的字", display: 42 }) }, { body: "", display: "" });
  assert.equal(F.cssVars({ body: "不存在的字" }), "", "认不出还硬写，屏幕上会变成没有字");
  assert.equal(F.stackOf("不存在的字"), "");
});

test("自带的那几支不去联网拉，拉的只有真要下载的", () => {
  assert.deepEqual(F.googleSpecs({ body: "sysKai", display: "sysSong" }), [], "系统自带的还去拉就是白跑一趟");
  assert.equal(F.googleSpecs({ body: "heiti", display: "heiti" }).length, 1, "同一支挑了两处只拉一次");
  assert.equal(F.googleSpecs({ body: "heiti", display: "maobi" }).length, 2);
});

test("默认那一档是名单里的第一张卡，而且它什么都不改", () => {
  assert.equal(F.FACES[0].key, "", "默认必须排在最前面，不然她找不到回头路");
  assert.equal(F.cssVars({ body: F.FACES[0].key }), "");
});

test("每一支都得有中文名和字体栈（默认那档除外）", () => {
  F.FACES.forEach(f => {
    assert.ok(/[一-龥]/.test(f.zh), f.key + " 没有中文名（标题不留英文）");
    if (f.key) assert.ok(f.stack, f.key + " 没写字体栈");
  });
});

test("工作台：字体跟着主题包一起走，safe-theme 那一路不拉字体", () => {
  const i = studio.indexOf("const compile = p =>"), j = studio.indexOf("const cancelPreview =", i);
  assert.ok(i > 0 && j > i, "抠不出 compile～cancelPreview 这一段");
  const seg = studio.slice(i, j);
  assert.ok(seg.includes("FontChoice.cssVars"), "compile 没把字体变量编进去");
  assert.ok(seg.includes("FontChoice.ensure"), "apply 没去真拉字体文件");
  assert.ok(/safeMode\(\) && g\.FontChoice/.test(seg), "safe-theme 那一路不该去拉字体");
  assert.ok(studio.includes('fonts: { body: "", display: "" }'), "fresh() 里没有 fonts，导出的主题包就带不上字体");
});

test("界面：字体是工作台的一栏，挑完走的还是原来那套预览/应用", () => {
  const i = ui.indexOf("function ThemeStudioConfig(");
  assert.ok(i >= 0, "抠不出 ThemeStudioConfig");
  assert.ok(ui.includes('tab("fonts"'), "字体没有自己的抽屉");
  assert.ok(ui.includes('section === "fonts"'), "字体那一栏没画出来");
  // 它必须改的是同一份 draft，这样「先预览 30 秒」和「正式应用」白得
  assert.ok(/patchDraft\(\{ fonts:/.test(ui), "字体没写进同一份草稿，预览和应用就接不上");
  assert.ok(!/studio\.commit\(\{ fonts/.test(ui), "不许绕开草稿直接落盘");
});

// ── 自己传的字体（她 2026-09-18：「能不能搞一个可以上传自定义字体的，
//    不知道一般这是啥格式？文件？链接？」——两种都是，所以两条路都给）─────────
const F1 = { id: "a1", kind: "file", name: "霞鹜文楷", ref: "iv_zzz" };
const L1 = { id: "b2", kind: "link", name: "思源柔黑", family: "Source Han", href: "https://cdn.test/a.css" };

test("两条路都认：文件走保险箱，链接走 <link>", () => {
  const faces = F.facesWith([F1, L1]);
  assert.equal(faces.length, F.FACES.length + 2, "自己传的没进名单，就在选单里看不见");
  assert.deepEqual(F.fileRefs({ body: "u:a1" }, [F1, L1]), ["iv_zzz"]);
  assert.deepEqual(F.linkHrefs({ display: "u:b2" }, [F1, L1]), ["https://cdn.test/a.css"]);
  // 反过来不许串：链接那支不占保险箱，文件那支不挂 <link>
  assert.deepEqual(F.fileRefs({ body: "u:b2" }, [F1, L1]), []);
  assert.deepEqual(F.linkHrefs({ body: "u:a1" }, [F1, L1]), []);
});

test("文件那一路的字族名由我们自己造，不问文件里写的是什么", () => {
  // 中文字体内部的字族名十有八九是英文缩写，猜错就是一个字都不生效
  const css = F.cssVars({ body: "u:a1" }, [F1], () => "blob:x");
  assert.ok(css.includes("@font-face"), "没发 @font-face，变量指了个空字族");
  assert.ok(css.includes("font-family: 'lisa-u-a1'"), "字族名不是我们自己造的那个");
  assert.ok(css.includes("--f-body: 'lisa-u-a1'"), "@font-face 发了，变量却没指过去");
});

// ⚠️这一条是整个自定义字体里唯一会【让她屏幕上没有字】的地方
test("保险箱里找不到那份文件时整支跳过，不许把变量指向空地址", () => {
  assert.equal(F.cssVars({ body: "u:a1" }, [F1], () => ""), "", "指了个空地址，屏幕上会变成没有字");
  assert.equal(F.faceBlocks([F1], () => ""), "");
  // 另一支还在的话，它不受连累
  const css = F.cssVars({ body: "u:a1", display: "u:b2" }, [F1, L1], () => "");
  assert.ok(!css.includes("--f-body"), "文件丢了还硬写正文");
  assert.ok(css.includes("--f-display: 'Source Han'"), "链接那支不该被文件那支连累");
});

test("洗进存档的只有干净的那份：名字里的引号大括号一律过不去", () => {
  const dirty = [{ id: "a 1!", kind: "file", name: '文楷";}html{display:none', ref: "iv_z" }];
  const kept = F.customList(dirty).map(f => f.custom);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].id, "a1");
  assert.ok(!/["{};]/.test(kept[0].name), "名字要原样写进 CSS，标点必须洗掉");
});

test("缺胳膊少腿的一律不进名单，宁可少一张卡也不要点了没反应的卡", () => {
  assert.equal(F.customList([{ id: "a", kind: "file", name: "x" }]).length, 0, "文件那一路没有 ref");
  assert.equal(F.customList([{ id: "a", kind: "file", name: "x", ref: "不是保险箱的键" }]).length, 0);
  assert.equal(F.customList([{ id: "a", kind: "link", name: "x", family: "Y" }]).length, 0, "链接那一路没有地址");
  assert.equal(F.customList([{ id: "a", kind: "link", name: "x", family: "Y", href: "http://不加密" }]).length, 0, "http 不许过");
  assert.equal(F.customList([{ id: "a", kind: "别的", name: "x" }]).length, 0);
  assert.equal(F.customList(null).length, 0);
});

test("最多八支，多的直接不要", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: "x" + i, kind: "file", name: "f" + i, ref: "iv_a" }));
  assert.equal(F.customList(many).length, F.CUSTOM_MAX);
});

test("删掉一支之后，挑中它的那一头必须落回默认", () => {
  // 洗的顺序要紧：先洗名单，再拿【洗完的名单】去认那两支
  assert.deepEqual({ ...F.clean({ body: "u:a1", display: "u:b2" }, [L1]) }, { body: "", display: "u:b2" });
  assert.equal(F.cssVars({ body: "u:a1" }, [], () => "blob:x"), "", "字体删了，变量还指着它");
  // 界面那一侧也要跟着抹，不然草稿里留着一个指不着的键
  assert.match(ui, /if \(fonts\.body === key\) fonts\.body = "";/);
  assert.match(ui, /if \(fonts\.display === key\) fonts\.display = "";/);
});

test("传文件那一路接的是原来那个保险箱，没另开一个仓", () => {
  assert.ok(ui.includes("imgToVault("), "自己另写了一套存法（那个保险箱本来就是通用 blob 仓）");
  assert.ok(studio.includes("FontChoice.fileRefs"), "导出主题包时没把字体文件一起打包");
  assert.ok(/customFonts \|\| \[\]\)\.forEach\(f => \{ if \(f && map\[f\.ref\]\)/.test(studio), "导入换机器之后没换键，字体会是哑的");
});

test("只认那四种格式，太大的挡在门外", () => {
  assert.deepEqual([...F.FILE_EXT], [".woff2", ".woff", ".ttf", ".otf"]);
  assert.ok(/FILE_EXT\) \|\| \[\]\)\.indexOf\(ext\) < 0/.test(ui), "没挡格式");
  assert.ok(/f\.size > 30 \* 1024 \* 1024/.test(ui), "没挡体积——中文字体动辄十几兆");
});
