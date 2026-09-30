// 「复制给别的 AI」：别的 AI 说主题 CSS 是「空壳、没有 html」——缺的是挂点表和写法规矩（群友 2026-09-30）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");

function loadStudio() {
  const store = {};
  const el = () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} });
  const document = { readyState: "complete", addEventListener() {}, getElementById: () => null, createElement: el,
    head: el(), documentElement: el(), querySelectorAll: () => [] };
  const localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const w = { document, localStorage };
  new Function("window", "document", "localStorage", src("theme-studio.js"))(w, document, localStorage);
  return w.ThemeStudio;
}

test("aiBrief 带上规矩、这一页全部挂点和她现在的 CSS", () => {
  const S = loadStudio();
  const out = S.aiBrief("thread", '[data-wk="bubble"] { color: red !important; }');
  assert.match(out, /没有 html/);
  assert.match(out, /!important/);
  assert.match(out, /\[data-wk="headname"\]/);
  assert.match(out, /\[data-wk="photoface"\]/);
  assert.match(out, /color: red !important/);
  const common = S.aiBrief("nosuchpage", "");
  assert.doesNotMatch(common, /这一页（/);
  assert.match(common, /还是空的/);
});

test("挂点选择器旁边有「复制给别的 AI」按钮", () => {
  const ui = src("theme-studio-ui.js");
  assert.match(ui, /studio\.aiBrief\(page, css\)/);
  assert.match(ui, /复制给别的 AI/);
});
