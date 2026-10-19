// 她 2026-10-18：别人的美化到自己手机上「顶栏不适配会飘到最上面点不了」，要一键适配
const test = require("node:test");
const assert = require("node:assert/strict");
global.window = global; global.document = { documentElement: {} };
require("../js/theme-studio.js");
const S = window.ThemeStudio;

test("顶栏写死的 padding-top / top / padding 简写：自动跟刘海取大的", () => {
  const out = S.scopeCSS('[data-wk="chathead"]{padding-top:10px !important;color:red}[data-wk="head"]{padding:6px 12px}[data-wk="head"]{top:0}', "X");
  assert.match(out, /padding-top: max\(10px, calc\(var\(--app-safe-top[^;]*\) !important;color:red/);
  assert.match(out, /padding: max\(6px, calc\([^)]*\)[^)]*\) \+ 4px\)\) 12px 6px 12px/);
  assert.match(out, /top: max\(0px, /);   // max() 里不认不带单位的 0（2026-10-19）
});
test("别的挂点、已经用了安全区的顶栏：一个字不动", () => {
  const css = '[data-wk="bubble"]{padding-top:3px;top:2px}[data-wk="head"]{padding-top:calc(var(--app-safe-top) + 2px)}[data-wk="headink"]{padding-top:1px}';
  assert.equal(S.scopeCSS(css, "X").replace(/X /g, ""), css);
});
test("全局 CSS 也过这一遍；读不懂（不支持的 @ 规则）就原样用，不拖垮主题", () => {
  const p = S.normalize({ globalCSS: '[data-wk="chathead"]{padding-top:8px !important}' });
  assert.match(S.compile(p), /html \[data-wk="chathead"\]\{padding-top: max\(8px,/);
});
test("一键适配：按宽度比例乘到「全 App 多大」上，点完记成这台，再点不会越缩越小", () => {
  const plan = S.fitPlan({ madeOn: { w: 430 }, pageZoom: { all: 1.1 } }, 390);
  assert.equal(plan.zoom, 1);
  assert.deepEqual(plan.patch, { pageZoom: {}, madeOn: { w: 390 } });
  assert.equal(S.fitPlan({ madeOn: { w: 390 }, pageZoom: {} }, 390), null);
  assert.equal(S.fitPlan({}, 390), null, "旧包没记宽度：不出按钮");
  assert.equal(S.fitPlan({ madeOn: { w: 300 } }, 600).zoom, S.ZOOM_MAX, "夹在拉条范围里");
});
test("导出记下这台手机的宽度；按钮挂在「全 App 多大」那一格", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "theme-studio.js"), "utf8");
  assert.match(src, /if \(myW\) profile\.madeOn = \{ w: myW \};/);
  const ui = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "theme-studio-ui.js"), "utf8");
  assert.match(ui, /const fit = page === "all" \? fitNow : null;/);
  assert.match(ui, /fitNow \? fitBtn\(fitNow\) : null,/, "导入那一格也要有这颗，不能只藏在「全 App 多大」");
  assert.match(ui, /madeOn: sel\.css \? inc\.madeOn : cur\.madeOn,/, "导入合并时丢了宽度，按钮就永远不出");
  assert.match(ui, /"data-wk": "themefit"/);
});
