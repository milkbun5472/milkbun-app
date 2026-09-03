// v61.08 她 2026-09-03：「你把 preset 放到设置里的主题工作室那边吧」
// 钉三件事：工作台里真有【气泡皮肤】这一栏、它用的是共用那个组件（不是另抄一份）、
// 预览里的气泡吃真的皮肤值（不是写死那两块粉蓝——不然选完皮肤预览还是老样子）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const ui = fs.readFileSync("js/theme-studio-ui.js", "utf8");
const comp = fs.readFileSync("js/components.js", "utf8");

test("主题工作台里有气泡皮肤那一栏，而且是共用组件", () => {
  assert.match(ui, /tab\("skin","气泡皮肤"/);
  assert.match(ui, /section === "skin" &&/);
  assert.match(ui, /h\(BubbleSkinPresets, \{/);
  // 共用的那一个还在（一处画、两处用；这里是第三处用）
  assert.match(comp, /function BubbleSkinPresets\(/);
});

test("这一栏的预览固定看单聊，否则皮肤根本显不出来", () => {
  assert.match(ui, /section === "skin" \? "thread"/);
});

test("预览里的气泡吃真的皮肤值，不是写死的粉蓝", () => {
  const i = ui.indexOf("const skinCSS");
  assert.ok(i > 0, "skinCSS 不见了");
  const block = ui.slice(i, ui.indexOf("})();", i));
  for (const k of ["myBg", "myText", "charBg", "charText", "radius", "shadow", "chatBg"]) {
    assert.ok(block.includes("sk." + k), "预览没吃到 " + k);
  }
  // 皮肤压在页面 CSS 上面：既要 !important，也要排在 previewCSS 那张之后
  assert.ok(block.includes("!important"), "皮肤没带 !important，会被页面 CSS 压住");
  assert.ok(ui.indexOf("previewCSS + '</style>") < ui.indexOf("skinCSS + '</style>"),
    "皮肤那张 style 必须排在页面 CSS 后面");
});
