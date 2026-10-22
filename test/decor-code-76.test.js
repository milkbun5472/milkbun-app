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

test("秋秋的 widget 卡：new 新摆一件、d_ id 换代码，都走主屏那一处", () => {
  const calls = [];
  global.window = { __homePutCodeDecor: (id, code, size) => { calls.push([id, code, size]); return id || "d_new"; }, __homeReg: { d_a: { kind: "decor", decor: { type: "code", detail: "<b>x</b>" } } } };
  delete require.cache[require.resolve("../js/assistant-extras.js")];
  const X = require("../js/assistant-extras.js");
  X.TARGETS.widget.write("new", { text: "<div>hi</div>", name: "wide" });
  X.TARGETS.widget.write("d_a", { text: "<div>yo</div>", name: "" });
  assert.deepEqual(calls, [["", "<div>hi</div>", "wide"], ["d_a", "<div>yo</div>", ""]]);
  assert.match(X.docLines(), /widget 桌面上「自己写」的小组件/);
  delete global.window;
});
test("主屏那一处跟编辑页「放上去」共用 placeNewDecoration", () => {
  assert.match(comp, /function placeNewDecoration\(item, preset, size, stickers\)/);
  assert.match(comp, /placeNewDecoration\(item, decorDraftPreset, size, decorDraftStickers\);/);
  assert.match(comp, /window\.__homePutCodeDecor = function \(id, code, size\)/);
});
