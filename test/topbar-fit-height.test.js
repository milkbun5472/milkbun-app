// 顶栏写死高度、padding 写 0 的美化换到刘海高的手机上（群里 2026-10-19）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "../js/theme-studio.js"), "utf8");
const a = s.indexOf("const TOP_HOOK"), b = s.indexOf("// 全局 CSS 不加作用域");
const fit = new Function(s.slice(a, b) + ";return fitTopBody;")();
test("写死的 px 高度加上刘海那截；max() 里的 0 补成 0px", () => {
  const out = fit('[data-wk="chathead"]', "min-height: 52px !important;\n  height: 52px !important;\n  padding: 0 14px !important;");
  assert.match(out, /height: calc\(52px \+ max\(0px, calc\(var\(--app-safe-top/);
  assert.match(out, /min-height: calc\(52px \+ max\(0px, /);
  assert.match(out, /padding: max\(0px, /);
  assert.doesNotMatch(out, /max\(0,/);
});
test("别的元素不动，auto 不动", () => {
  assert.equal(fit('[data-wk="bubble"]', "height: 52px"), "height: 52px");
  assert.equal(fit('[data-wk="chathead"]', "height: auto"), "height: auto");
});
test("body 落到真的 body 上（聊天页底下那条是 body 的颜色）", () => {
  const ts = require("fs").readFileSync(require("path").join(__dirname, "../js/theme-studio.js"), "utf8");
  assert.match(ts, /if \(\/\^body\$\/i\.test\(sel\) && \/\^html\\b\/i\.test\(scope\)\) return scope \+ " body";/);
});
test("顶栏里面的头像、按钮写高度不加刘海（顶栏头像被拉成长条）", () => {
  assert.equal(fit('[data-wk="chathead"] [data-wk="avatar"]', "height: 40px"), "height: 40px");
  assert.equal(fit('[data-wk="chathead"] > button', "padding-top: 0"), "padding-top: 0");
  assert.match(fit('[data-wk="offline"] [data-wk="chathead"]::before, .x', "padding-top: 0; height: 40px"), /calc\(40px/);
});

test("做的那台手机上原样：自己算过刘海的不动，只写高度的不加，原值够低的只补差（群里 2026-10-20）", () => {
  const safeOne = "padding-top: calc(env(safe-area-inset-top) + 8px); height: 96px";
  assert.equal(fit('[data-wk="chathead"]', safeOne), safeOne);
  assert.equal(fit('[data-wk="chathead"]', "height: 96px"), "height: 96px");
  assert.match(fit('[data-wk="chathead"]', "padding-top: 50px; height: 96px"), /height: calc\(96px \+ max\(0px, calc\(.*\) - 50px\)\)/);
});

test("只动真顶栏；sticky/relative 的 top 不动，fixed 的才让", () => {
  assert.equal(fit('[data-wk="statehead"]', "padding-top: 4px"), "padding-top: 4px");
  assert.equal(fit('[data-wk="closetgrouphead"]', "padding: 2px 6px"), "padding: 2px 6px");
  assert.match(fit('[data-wk="yqhead"]', "padding-top: 4px"), /max\(4px/);
  assert.equal(fit('[data-wk="chathead"]', "position: sticky; top: 0"), "position: sticky; top: 0");
  assert.match(fit('[data-wk="head"]', "position: fixed; top: 0"), /top: max\(0px/);
});

test("全局 CSS 只补顶栏，选择器一个字不改（不改优先级）", () => {
  const a2 = s.indexOf("  const scopeCSS = (css, scope) => {"), b2 = s.indexOf("  // CSS 里也只保存 iv_ 门牌");
  const sc = new Function("const unsafeReason = () => \"\";" + s.slice(a, b) + s.slice(a2, b2) + ";return scopeCSS;").call(null);
  const css = ':root .x{color:red}[data-wk="head"]{padding-top:2px}@media (max-width:1px){.y{top:0}}';
  const out = sc(css, null);
  assert.match(out, /^:root \.x\{color:red\}\[data-wk="head"\]\{padding-top: max\(2px/);
  assert.match(out, /@media \(max-width:1px\)\{\.y\{top:0\}\}/);
  assert.match(s, /const fitTop = css => \{ try \{ return scopeCSS\(css, null\); \}/);
});
