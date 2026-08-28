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
