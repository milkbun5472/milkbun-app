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
