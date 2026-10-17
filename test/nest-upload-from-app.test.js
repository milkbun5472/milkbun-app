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
  new Function("window", "React", "h", "Svg", "loadJSON", "saveJSON", "localStorage", "fetch", "qqDeviceId", "chatLookClean", "chatLookShelf", "bubbleSkinSnapshot", nest)(
    g, { useState: () => [], useEffect: () => {}, useRef: () => ({}) }, () => null, () => null, loadJSON, () => true,
    { getItem: () => null, setItem() {}, removeItem() {} }, async () => ({}), () => "dev-1",
    chatLookClean, () => (store.x_chatLooks || []), () => ({ ai: { bg: "#fff" } }));
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

test("打出来的美化包：chat-look、assets 空；背景是自己的图就拿掉，CSS 里有图就不收", () => {
  const N = load({});
  const r = N.packLook({ name: "x", look: { skin: "pink", chatBg: "iv_abc" } });
  const d = JSON.parse(r.payload);
  assert.equal(d.kind, "chat-look"); assert.deepEqual(d.assets, {}); assert.equal(r.dropped, true);
  assert.equal(d.look.chatBg, undefined); assert.equal(d.look.skin, "pink");
  assert.throws(() => N.packLook({ name: "y", look: { customCSS: "a{background:url(iv_zz)}" } }), /不收图/);
  assert.throws(() => N.packLook({ name: "z", look: { chatBg: "iv_only" } }), /只有一张背景图/);
});

test("主题直接用正用着的：走主题工作台的 exportPackage，不带壁纸；有自定义图标就不勾图标", async () => {
  let got = null;
  const TS = { normalize: p => p, load: () => ({ icons: { chat: "iv_1" }, customFonts: [] }),
    exportPackage: async x => { got = x; return JSON.stringify({ kind: "qq-theme", assets: {} }); } };
  const N = load({ x_theme: { accent: "#123" } }, { ThemeStudio: TS });
  const text = await N.packCurrentTheme();
  assert.equal(JSON.parse(text).kind, "qq-theme");
  assert.equal(got.pick.wall, false); assert.equal(got.pick.icons, false); assert.equal(got.pick.fonts, true);
  assert.deepEqual(got.baseTheme, { accent: "#123" }); assert.ok(got.bubbleSkin);
  TS.exportPackage = async () => JSON.stringify({ kind: "qq-theme", assets: { iv_9: "data:" } });
  await assert.rejects(() => N.packCurrentTheme(), /不收图/);
});

test("CSS 也能直接挑：全 App、每一页、聊天窗、线下、群；空的不列，带图的不收", () => {
  const TS = { PAGES: [["all", "全 App"], ["thread", "聊天页"]], normalize: p => p,
    load: () => ({ globalCSS: "body{}", pageCSS: { thread: ".b{}" } }) };
  const N = load({ x_chatSettings: { a: { customCSS: ".c{}" } }, x_offlineSettings: { a: { customCSS: "" } },
    x_groups: [{ id: "g1", name: "宿舍", customCSS: ".g{}" }] }, { ThemeStudio: TS });
  const rows = N.cssSources([{ id: "a", name: "明" }]);
  assert.deepEqual(rows.map(r => r.id), ["t:all", "t:thread", "c:a", "g:g1"]);
  assert.equal(N.packCss(rows[2]), ".c{}");
  assert.throws(() => N.packCss({ css: "a{background:url(iv_x)}" }), /不收图/);
});

test("留言板：第八格、写帖子就是一段字、没有导入和复制、她能盖收到／修好", () => {
  const N = load({});
  assert.equal(N.KINDS[N.KINDS.length - 1].key, "post");
  assert.match(nest, /if \(isPost\) \{ const s = String\(text/);
  assert.match(nest, /isPost \? null : h\(Btn, \{ t, solid: true, wide: true, disabled: busy, onClick: doImport/);
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
