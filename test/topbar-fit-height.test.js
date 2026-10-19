// 顶栏写死高度、padding 写 0 的美化换到刘海高的手机上（群里 2026-10-19）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "../js/theme-studio.js"), "utf8");
const a = s.indexOf("const TOP_HOOK"), b = s.indexOf("// 全局 CSS 不加作用域");
const fit = new Function(s.slice(a, b) + ";return fitTopBody;")();
test("写死的 px 高度加上刘海那截；max() 里的 0 补成 0px", () => {
  const out = fit('[data-wk="chathead"]', "min-height: 52px !important;\n  height: 52px !important;\n  padding: 0 14px !important;");
  assert.match(out, /height: calc\(52px \+ var\(--app-safe-top/);
  assert.match(out, /min-height: calc\(52px \+ var\(--app-safe-top/);
  assert.match(out, /padding: max\(0px, /);
  assert.doesNotMatch(out, /max\(0,/);
});
test("别的元素不动，auto 不动", () => {
  assert.equal(fit('[data-wk="bubble"]', "height: 52px"), "height: 52px");
  assert.equal(fit('[data-wk="chathead"]', "height: auto"), "height: auto");
});
