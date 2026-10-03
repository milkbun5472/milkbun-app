// 群友 2026-10-03：「那个全 app 的我弄了没什么效果」——全 App 那一栏先说清它管什么，再给一套看得见的起手式。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const studio = P("js/theme-studio.js"), ui = P("js/theme-studio-ui.js");

test("全 App 有一套内置起手式，只用共用挂点", () => {
  assert.match(studio, /const CSS_BUILTINS = \{ all: ALL_SKINS,/);
  const i = studio.indexOf("const ALL_SOFT_CSS"), seg = studio.slice(i, studio.indexOf("const ALL_SKINS", i));
  const used = [...seg.matchAll(/data-wk="([a-z]+)"/g)].map(m => m[1]);
  const common = [...studio.slice(studio.indexOf("const WK_COMMON"), studio.indexOf("]);", studio.indexOf("const WK_COMMON"))).matchAll(/\["([a-z]+)",/g)].map(m => m[1]);
  used.forEach(k => assert.ok(common.includes(k), k + " 不是全 App 共用挂点"));
});

test("全 App 那一栏顶上写明：整体风格去基础配色／字体／壁纸", () => {
  assert.match(ui, /page === "all" \? h\("div"/);
  assert.match(ui, /先去「基础配色」「字体」「壁纸」/);
});
