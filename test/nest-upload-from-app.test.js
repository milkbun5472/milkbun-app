// 秋秋小窝 · 主题和聊天美化不用先导出（她 2026-10-16：「老师们上传是不是不能直接上传还得先弄成文件」）。
//   上传页直接挑：主题＝手机上正用着的那套，美化＝「我存的美化」、每个聊天窗、每个群正用着的。
//   钉三件：挑得出来、打出来的包服务端认（kind 对、assets 空）、自己传的图不带（背景图拿掉，CSS 里有图就不收）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const nest = fs.readFileSync(path.resolve(__dirname, "..", "js/nest.js"), "utf8");
const comps = fs.readFileSync(path.resolve(__dirname, "..", "js/components.js"), "utf8");

// chatLookClean 原样从 components.js 切出来（不另写一份）
const cleanSrc = comps.slice(comps.indexOf("const CHAT_LOOK_KEYS"), comps.indexOf("async function exportChatLook"));
const chatLookClean = new Function(cleanSrc + "; return chatLookClean;")();

function load(store, extra) {
  const g = Object.assign({}, extra || {});
  const loadJSON = (k, d) => (k in store ? store[k] : d);
  // 桩照 nest.js 真用到的写：保险箱取图 imgVaultFetchBlob(ref)→Blob、FileReader 读成 dataURL、打包 packChatLook（components.js 那份）
  const vault = (extra && extra.__vault) || {};
  const imgVaultFetchBlob = async ref => vault[ref] ? new Blob([vault[ref]], { type: "image/png" }) : null;
  class FileReader { readAsDataURL(b) { b.arrayBuffer().then(ab => { this.result = "data:" + b.type + ";base64," + Buffer.from(ab).toString("base64"); this.onload(); }); } }
  const packChatLook = async (look, name) => {
    const clean = chatLookClean(look), assets = {};
    for (const ref of [...new Set(JSON.stringify(clean).match(/iv_[A-Za-z0-9_-]+/g) || [])]) { const b = await imgVaultFetchBlob(ref); if (b) assets[ref] = "data:image/png;base64," + Buffer.from(await b.arrayBuffer()).toString("base64"); }
    return { kind: "chat-look", v: 1, name, look: clean, assets };
  };
  new Function("window", "React", "h", "Svg", "loadJSON", "saveJSON", "localStorage", "fetch", "qqDeviceId", "chatLookClean", "chatLookShelf", "bubbleSkinSnapshot", "imgVaultFetchBlob", "FileReader", "packChatLook", require("fs").readFileSync(require("path").join(__dirname, "..", "js", "nest-watch.js"), "utf8") + "\n" + nest)(   // 2026-10-18 起地址和管理口令在 nest-watch.js，先装它
    g, { useState: () => [], useEffect: () => {}, useRef: () => ({}) }, () => null, () => null, loadJSON, () => true,
    { getItem: () => null, setItem() {}, removeItem() {} }, async () => ({}), () => "dev-1",
    chatLookClean, () => (store.x_chatLooks || []), () => ({ ai: { bg: "#fff" } }), imgVaultFetchBlob, FileReader, packChatLook);
  return g.Nest;
}

test("美化能挑的：存过的、聊天窗、群；没动过美化的聊天窗不列", () => {
  const N = load({
    x_chatLooks: [{ id: "lk1", name: "粉的", look: { skin: "pink" } }],
    x_chatSettings: { a: { skin: "mint", remark: "阿明" }, b: { remark: "空的", layout: {} } },
    x_groups: [{ id: "g1", name: "宿舍", customCSS: ".x{color:red}" }]
  });
  const rows = N.lookSources([{ id: "a", name: "明" }, { id: "b", name: "白" }]);
  assert.deepEqual(rows.map(r => r.id), ["s:lk1", "c:a", "g:g1"]);
  assert.equal(rows[1].name, "阿明的聊天窗");
});

test("打出来的美化包：头像框、挂件、背景这些自己传的图一起装进 assets（她 2026-10-17「直接开放」）", async () => {
  const N = load({}, { __vault: { iv_frame: "PNG1", iv_bg: "PNG2" } });
  const r = await N.packLook({ name: "x", look: { skin: "pink", chatBg: "iv_bg", layout: { deco: { me: { frame: "iv_frame" } } } } });
  const d = JSON.parse(r.payload);
  assert.equal(d.kind, "chat-look"); assert.equal(d.look.chatBg, "iv_bg");
  assert.deepEqual(Object.keys(d.assets).sort(), ["iv_bg", "iv_frame"]);
});

test("主题直接用正用着的：图标、壁纸都勾上；只有自己传了字体文件才不勾字体", async () => {
  let got = null;
  const TS = { normalize: p => p, load: () => ({ icons: { chat: "iv_1" }, customFonts: [{ ref: "iv_f" }] }),
    exportPackage: async x => { got = x; return JSON.stringify({ kind: "qq-theme", assets: {} }); } };
  const N = load({ x_theme: { accent: "#123" }, x_wallpaper: "iv_w" }, { ThemeStudio: TS });
  assert.equal(JSON.parse(await N.packCurrentTheme()).kind, "qq-theme");
  assert.equal(got.pick.icons, true); assert.equal(got.pick.wall, true); assert.equal(got.wallpaper, "iv_w"); assert.equal(got.pick.fonts, false);
  assert.deepEqual(got.baseTheme, { accent: "#123" }); assert.ok(got.bubbleSkin);
});

test("CSS 也能直接挑：全 App、每一页、聊天窗、线下、群；空的不列；本机图库的图换成图本身嵌进去", async () => {
  const TS = { PAGES: [["all", "全 App"], ["thread", "聊天页"]], normalize: p => p,
    load: () => ({ globalCSS: "body{}", pageCSS: { thread: ".b{}" } }) };
  const N = load({ x_chatSettings: { a: { customCSS: ".c{}" } }, x_offlineSettings: { a: { customCSS: "" } },
    x_groups: [{ id: "g1", name: "宿舍", customCSS: ".g{}" }] }, { ThemeStudio: TS, __vault: { iv_x: "PNG" } });
  const rows = N.cssSources([{ id: "a", name: "明" }]);
  assert.deepEqual(rows.map(r => r.id), ["t:all", "t:thread", "c:a", "g:g1"]);
  assert.equal(await N.packCss(rows[2]), ".c{}");
  assert.match(await N.packCss({ css: "a{background:url(iv_x)}" }), /url\(data:image\/png;base64,/);
  await assert.rejects(() => N.packCss({ css: "a{background:url(iv_gone)}" }), /图库里找不到/);
});

test("留言板：最后一格、写帖子就是一段字、没有导入和复制、她能盖收到／修好", () => {
  const N = load({});
  assert.equal(N.KINDS[N.KINDS.length - 1].key, "post");
  assert.match(nest, /if \(isPost\) \{ const s = String\(text/);
  // 2026-10-19 起中间夹了文档那一支（复制全文），帖子照旧什么都不给
  assert.match(nest, /isPost \? null : isDoc \? h\(Btn, [^\n]*\n\s*: h\(Btn, \{ t, solid: true, wide: true, disabled: busy, onClick: doImport/);
  assert.match(nest, /api\("\/admin\/status"/);
  assert.match(nest, /isPost && admin \?/);
});

test("首页格子柜收着：只剩一行，挑完自己收回去；传东西那页照旧整格摊开", () => {
  assert.match(nest, /h\(Cubbies, \{ t, kind, onPick: setKind, fold: true \}\)/);
  assert.match(nest, /onPick = fold \? \(k => \{ setOpen\(false\); pick0\(k\); \}\)/);
  assert.match(nest, /h\(Cubbies, \{ t, kind, noAll: true, onPick: setKind \}\)/);
});

test("编辑：同一页改；没碰内容就不发；截图原来的用 keep；图地址带改过的时间不吃旧缓存", () => {
  assert.match(nest, /if \(edit && !file && !chosen\.length && !String\(text \|\| ""\)\.trim\(\)\) return null;/);
  assert.match(nest, /api\("\/item\/" \+ edit\.id, \{ method: "PUT"/);
  assert.match(nest, /x\.keep != null \? \{ keep: x\.keep \} : x\.full/);
  assert.match(nest, /\(it\.edited \? "\?v=" \+ it\.edited : ""\)/);
  assert.match(nest, /top\.v === "edit"\) return h\(Upload, \{ t, props, edit: top\.item/);
});

test("退回和称号：管理模式才有退回键、要写原因；作者改好保存就清掉退回；称号印章跟着署名、留言、借书证走", () => {
  assert.match(nest, /admin && !it\.returned \? \(retOpen/);
  assert.match(nest, /api\("\/admin\/return", \{ method: "POST", body: \{ item: it\.id, reason \} \}\)/);
  assert.match(nest, /onDone\(edit\.id, kind, \{ returned: ""/);
  assert.match(nest, /self && adminToken\(\) \? h\(BadgeSet/);
  ["\"by \" + (it.nick || \"无名\"), h(Badge, { b: it.badge })", "c.name, h(Badge, { b: c.badge })", "d.user.name, h(Badge, { b: d.user.badge })"].forEach(x => assert.ok(nest.includes(x), x));
});

test("嵌进去的图：小 SVG、压得下的位图都能传；大 SVG、字体、张数超了拦下，说是哪种、在哪段后面", () => {
  const N = load({});
  const svg = 'url("data:image/svg+xml;utf8,<svg/>")';
  assert.equal(N.imgProblem('[data-wk="bubble"]::after{background:' + svg + '}'), "");
  assert.equal(N.imgProblem('.tail{background:url(data:image/png;base64,iVBOR=)}'), "");
  const big = N.imgProblem('.tail{width:8px;background:url("data:image/svg+xml,' + "x".repeat(9000) + '")}');
  assert.match(big, /KB 的矢量图（超过 8KB）/); assert.match(big, /「background:url\("?」后面/);
  assert.match(N.imgProblem("@font-face{src:url(data:font/woff2;base64,AA)}"), /字体/);
  // 张数那道闸只防离谱（一套 iOS 图标主题本来就二三十张，群里 2026-10-22 被 12 张挡过）——
  //   钉的是「超了会说」，不是钉那个数
  const cap = Number(require("node:fs").readFileSync(require("node:path").join(__dirname, "../js/nest.js"), "utf8").match(/ASSET_COUNT = (\d+)/)[1]);
  assert.ok(cap >= 30, "一套图标主题装不下");
  assert.match(N.imgProblem(Array.from({ length: cap + 1 }, () => "a{b:url(data:image/png;base64,AA)}").join("")), new RegExp("最多 " + cap + " 张"));
  // JSON 包里（主题、整套美化）引号是转义过的，也认得出
  assert.match(N.imgProblem(JSON.stringify({ look: { customCSS: 'a{b:url("data:image/tiff;base64,AAA=")}' } })), /tiff/);
});

test("整份超了先自己往小里压，压到放得下才拿去查（2026-10-28 桌面美化四五十张）", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "../js/nest.js"), "utf8");
  const i = src.indexOf("async function fitTotal("), j = src.indexOf("function imgProblem(", i);
  assert.ok(i > 0 && j > i, "抠不出 fitTotal");
  const body = src.slice(i, j);
  assert.match(body, /text\.length <= PAYLOAD_ALL/);
  assert.match(body, /resizeImageFile\(/);
  assert.match(body, /sort\(\(a, b\) => b\[0\] - a\[0\]\)/, "从后往前换，位置不乱");
  assert.match(src, /return fitTotal\(text\);/, "shrinkImages 最后交给 fitTotal");
});
