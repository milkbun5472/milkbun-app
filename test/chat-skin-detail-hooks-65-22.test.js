const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const R = file => fs.readFileSync("js/" + file, "utf8");

test("单聊和群聊公开每颗聊天键及气泡细分挂点", () => {
  const comp = R("components.js"), recent = R("recent-widget.js"), studio = R("theme-studio.js");
  ["chatback", "chatmore", "chatplus", "chatinput", "send", "chatreply", "chattool",
    "quote", "voice", "voicebar", "translation", "translatebutton", "translatebody", "transferribbon"].forEach(k => {
    assert.match(studio, new RegExp('\\["' + k + '",'), "工作台没登记 " + k);
    assert.ok(comp.includes('"data-wk": "' + k + '"') || recent.includes('"data-wk": "' + k + '"'), "DOM 没挂 " + k);
  });
  assert.equal((comp.match(/"data-wk": "chatplus"/g) || []).length, 2, "单聊、群聊都要有加号挂点");
  assert.equal((comp.match(/"data-wk": "chatinput"/g) || []).length, 2, "单聊、群聊都要有输入框挂点");
  assert.equal((comp.match(/"data-wk": "chattool", "data-chat-tool": k/g) || []).length, 2, "工具键要靠真实 action 区分");
});

function loadStudio(resolveImg) {
  const window = { addEventListener() {}, dispatchEvent() {}, resolveImg };
  const context = {
    window, localStorage: { getItem() { return null; }, setItem() {} },
    document: { readyState: "loading", addEventListener() {}, getElementById() { return null; }, createElement() { return {}; }, head: { appendChild() {} } },
    CustomEvent: function () {}, setTimeout, clearTimeout, console, Date, JSON, Blob, FileReader: function () {}
  };
  vm.runInNewContext(R("theme-studio.js"), context);
  return window.ThemeStudio;
}

test("CSS 的 iv_ 门牌编译成保险箱地址，丢图当场报错", () => {
  const studio = loadStudio(ref => ref === "iv_bear" ? "blob:bear-image" : "");
  const css = studio.compile({ pageCSS: { thread: '[data-wk="chatback"]{background-image:url("iv_bear")}' } });
  assert.match(css, /background-image:url\("blob:bear-image"\)/);
  assert.throws(() => studio.compile({ globalCSS: 'a{background:url(iv_missing)}' }), /图片保险箱里找不到 iv_missing/);
});

test("工作台能插入图库图，主题包会收集并改写 CSS 图片门牌", () => {
  const ui = R("theme-studio-ui.js"), studio = R("theme-studio.js");
  assert.match(ui, /插入图库图片/);
  assert.match(ui, /imgToVault\(await resizeImageFile\(f, 1600, \.92\)\)/);
  assert.match(studio, /cssImageRefs\(profile\.globalCSS\)/);
  assert.match(studio, /p\.globalCSS = remapCSSImages/);
});

test("秋秋只可复用真实 iv_ 贴纸门牌，并能改贴纸大小", () => {
  const engine = R("engine.js"), assistant = R("assistant.js");
  assert.match(engine, /BUBBLE_AI_STICKER_KEYS = \["mySticker", "charSticker"\]/);
  assert.match(engine, /resolveImg\(ref\)/);
  assert.match(engine, /if \(obj\.stickerSize != null\) num\("stickerSize", 32, 72\)/);
  assert.match(assistant, /mySticker: "我的气泡贴纸"/);
  assert.match(assistant, /贴纸门牌不许编/);
});
