// 装饰「自己写」（群友 2026-10-22「能不能出一个自定义小组件」）：贴 HTML，画在隔离小窗里
const test = require("node:test");
const assert = require("node:assert/strict");
const comp = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
test("类型表里有「自己写」，存在 detail 里、有上限", () => {
  assert.match(comp, /\{ id: "code", glyph: "<\/>", name: "自己写", text: "", detail: "" \}/);
  assert.match(comp, /A\.type === "code" \? String\(A\.detail \|\| ""\)\.slice\(0, HOME_DECOR_CODE_MAX\)/);
});
test("画在 sandbox 只给 allow-scripts 的 iframe 里，不给同源、不吞触摸", () => {
  const i = comp.indexOf('if (item.type === "code") {');
  const seg = comp.slice(i, i + 900);
  assert.match(seg, /sandbox: "allow-scripts"/);
  assert.ok(!/allow-same-origin/.test(seg), "给了同源，脚本就读得到本机数据");
  assert.match(seg, /pointerEvents: "none"/);
});
