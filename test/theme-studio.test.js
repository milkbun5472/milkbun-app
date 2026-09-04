const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadStudio() {
  const memory = new Map();
  const window = { addEventListener() {}, dispatchEvent() {} };
  const context = {
    window,
    localStorage: { getItem: k => memory.get(k) || null, setItem: (k,v) => memory.set(k,String(v)) },
    document: { readyState: "loading", addEventListener() {}, getElementById() { return null; }, createElement() { return {}; }, head: { appendChild() {} } },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
    setTimeout, clearTimeout, console, Date, JSON, Blob, FileReader: function () {}
  };
  vm.runInNewContext(fs.readFileSync("js/theme-studio.js", "utf8"), context);
  return window.ThemeStudio;
}

test("页面 CSS 会自动限定到选择的页面", () => {
  const s = loadStudio();
  const css = s.compile({ pageCSS: { thread: ".bubble, body { color:red }" } });
  assert.match(css, /html\[data-lisa-screen="thread"\] \.bubble/);
  assert.match(css, /html\[data-lisa-screen="thread"\]\{ color:red \}/);
});

test("危险远程导入和脚本式 CSS 会被拒绝", () => {
  const s = loadStudio();
  assert.throws(() => s.compile({ globalCSS: '@import url("https://bad.example/x.css")' }), /不允许/);
  assert.throws(() => s.compile({ pageCSS: { home: "a{background:expression(alert(1))}" } }), /不安全/);
});

test("主题配置归一化且保留图标和页面草稿", () => {
  const s = loadStudio();
  const p = s.normalize({ name: "晚霞", icons: { cast: "iv_1" }, pageCSS: { home: ".x{}" } });
  assert.equal(p.name, "晚霞");
  assert.equal(p.icons.cast, "iv_1");
  assert.equal(p.pageCSS.home, ".x{}");
  assert.equal(p.version, 1);
});

// v62.02 撤了：「应用前预览」那个 iframe 删掉了（她 2026-09-04：「这个页面下面的
// 应用前预览也根本没有，删了吧」）。它是自己搭的一套假页面，跟真页面只共享挂点名字；
// 修过两轮还是对不上，她照着它调、上机就不是那样——比没有预览更坏。
// 真正管用的是「先预览 30 秒」：它改的是【真 app 本身】。这条改成钉那一个。
test("主题工作台的预览改的是真 app 本身，不是 iframe 里一套假页面", () => {
  const ui = fs.readFileSync("js/theme-studio-ui.js", "utf8");
  const code = ui.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.match(code, /先预览 30 秒/);
  assert.match(code, /studio\.preview\(draft\)/);
  assert.match(code, /30 秒后自动撤销/);
  assert.doesNotMatch(code, /h\("iframe"/, "那个假页面又回来了");
});
