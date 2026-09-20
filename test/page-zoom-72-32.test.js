// 她 2026-09-20：「字体大小能不能自定义啊每一个 app 单独，就跟 css 一样可以每个 app 单独调，
//   然后做拉条选大小」。
//
// ⚠️为什么落成 zoom 而不是 font-size：这个 App 的字号全是内联 px（fontSize: 13 这种），
//   内联样式压得过任何样式表规则；硬用 !important 压，就是把满页大小不一的字拍成同一个数，
//   版面当场塌。按比例放大、又压得住内联 px 的只有 zoom。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const studioSrc = P("js/theme-studio.js"), ui = P("js/theme-studio-ui.js");

// 照【真正在跑的那一段】取，不另抄一份实现
const cleanZoom = (() => {
  const i = studioSrc.indexOf("  const ZOOM_MIN = 0.8, ZOOM_MAX = 1.4;");
  assert.ok(i > 0, "抠不出 zoom 那一段");
  const j = studioSrc.indexOf("  const zoomFor = page =>", i);
  return new Function(studioSrc.slice(i, j) + "\nreturn cleanZoom;")();
})();

test("只收合法的倍数，1 不存", () => {
  assert.deepEqual(cleanZoom({ chat: 1.2, home: 1 }), { chat: 1.2 }, "1 是没调过，不该占一格");
  assert.deepEqual(cleanZoom({ chat: 3 }), {}, "放得没边了也照收");
  assert.deepEqual(cleanZoom({ chat: 0.1 }), {}, "缩到看不见也照收");
  assert.deepEqual(cleanZoom({ chat: "1.15" }), { chat: 1.15 }, "拉条给的是字符串，得认");
  assert.deepEqual(cleanZoom({ chat: "abc" }), {}, "脏值没挡住");
  assert.deepEqual(cleanZoom(null), {}, "空存档该给空表");
  // ⚠️页名要进选择器，不干净的键一律削掉
  assert.deepEqual(cleanZoom({ 'x"]{}': 1.2 }), { x: 1.2 }, "页名没洗——它是要拼进 CSS 选择器的");
});

test("编出来的是整页缩放，全 App 那一档是底数", () => {
  const i = studioSrc.indexOf("    Object.entries(cleanZoom(p.pageZoom)).forEach");
  assert.ok(i > 0, "compile 没编 zoom");
  const seg = studioSrc.slice(i, i + 400);
  assert.ok(/page === "all" \? "body" : 'html\[data-lisa-screen="' \+ page \+ '"\] body'/.test(seg),
    "作用域不对：全 App 该是 body，单页该挂在那一页的 html 上");
  assert.ok(/"\{zoom:" \+ z \+ ";\}"/.test(seg), "编的不是 zoom");
  // ⚠️排在她自己写的 CSS 前面，她想再压一道照样压得住
  assert.ok(i < studioSrc.indexOf("    Object.entries(p.pageCSS || {}).forEach"), "排在她的 CSS 后面了，她就盖不过它");
});

test("存档里带着它，也跟着主题包走", () => {
  assert.ok(/pageTokens: \{\}, pageZoom: \{\}/.test(studioSrc), "新存档里没有这一格");
  assert.ok(/const pageZoom = cleanZoom\(x\.pageZoom\);/.test(studioSrc), "normalize 没洗它");
  assert.ok(/pageCSS: \{ \.\.\.\(x\.pageCSS \|\| \{\}\) \}, pageTokens, pageZoom \}/.test(studioSrc), "normalize 没把它带出来");
  // 导入勾选：它跟配色、CSS 同属「这一页长什么样」，所以跟 css 那一格走
  assert.ok(/pageZoom: sel\.css \? inc\.pageZoom : cur\.pageZoom/.test(ui), "导入时它没跟着 css 那一格走");
  assert.ok(/Object\.keys\(incoming\.profile\.pageZoom \|\| \{\}\)\.length/.test(ui),
    "包里只有大小、没有 CSS 时，那一格会被标成「这份包里没有」");
});

test("拉条：每页一根，能还原，改完立刻进草稿", () => {
  const i = ui.indexOf('page === "all" ? "全 App 多大" : "这一页多大"');
  assert.ok(i > 0, "界面上没有这一格");
  const seg = ui.slice(i - 900, i + 1400);
  assert.ok(/type: "range"/.test(seg), "不是拉条");
  assert.ok(/step: 0\.05/.test(seg), "步子不对");
  assert.ok(/min: studio\.ZOOM_MIN \|\| 0\.8, max: studio\.ZOOM_MAX \|\| 1\.4/.test(seg), "上下限没问 ThemeStudio 要（两处各写一份迟早对不上）");
  assert.ok(/patchDraft\(\{ pageZoom: one \}\)/.test(seg), "改完没进草稿");
  assert.ok(/if \(n === 1\) delete one\[page\]; else one\[page\] = n;/.test(seg), "拉回 100% 之后那一格还占着");
  assert.ok(/"还原"/.test(seg), "没有还原");
  // ⚠️说实话：它放大的是整页，不是只有字
  assert.ok(/整页一起按比例放大/.test(seg), "没说清它放大的是整页");
});
