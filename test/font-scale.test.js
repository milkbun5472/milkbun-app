// 她 2026-10-20：「为什么不能单独改字体」→ 主题工作台「字体」里加「字号」，只放大字，头像间距不动。
// 写死的字号写成 "calc(Npx * var(--app-fs, 1))"，主题那头只设 --app-fs 一个变量。主屏和主屏小组件不跟着变。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const comp = rd("js/components.js"), studio = rd("js/theme-studio.js"), ui = rd("js/theme-studio-ui.js");
const naked = seg => (seg.match(/fontSize: \d+(?:\.\d+)?\s*[,}]/g) || []).length;
test("单聊、线下、群聊、心声卡、日记、查手机：写死的字号都接上", () => {
  const slices = [["function ChatThread(", "function CallSubtitle("], ["function OfflineStylePromptPreview(", "function GroupThread("],
    ["function GroupThread(", "function PollCard("], ["function StateCard(", "function OfflineStylePromptPreview("]];
  for (const [a, b] of slices) assert.equal(naked(comp.slice(comp.indexOf(a), comp.indexOf(b))), 0, a);
  const sui = rd("js/screens-ui.js");
  assert.equal(naked(sui.slice(sui.indexOf("function setDiaryPaper("), sui.indexOf("function MyWallet("))), 0, "日记");
  assert.equal(naked(rd("js/phone-ui.js")), 0, "查手机");
});
test("主屏和主屏小组件一个都不动", () => {
  const home = comp.slice(comp.indexOf("function GlassIcon("), comp.indexOf("function MusicCardEdit("));
  assert.ok(!/--app-fs/.test(home), "主屏小组件被接上了");
  // ⚠️只查主屏【画出来】的那半。装饰那一页的编辑面板也写在 Home 函数体里（贴 HTML 的框、「＋ 加一张图」、
  //   底下那行说明），它是普通设置界面、跟字号走才对（2026-10-22 加「自己写」时撞上）：从「写什么」那一节
  //   到「什么样子」那一节之间挖掉再查。
  const hi = comp.indexOf("function Home({");
  const hAll = comp.slice(hi, comp.indexOf("\nfunction ", hi + 10));
  const ed0 = hAll.indexOf('section("words"'), ed1 = hAll.indexOf('section("look"', ed0);
  assert.ok(ed0 > 0 && ed1 > ed0, "装饰编辑面板那两节的界找不到了");
  const h = hAll.slice(0, ed0) + hAll.slice(ed1);
  assert.ok(!/--app-fs/.test(h), "主屏被接上了");
});
test("线下自己的正文字号、气泡字号再乘上它", () => {
  assert.match(comp, /fontSize: "calc\(var\(--off-fs, 14px\) \* var\(--app-fs, 1\)\)"/);
  assert.match(comp, /font-size:calc\(' \+ fs \+ 'px \* var\(--app-fs, 1\)\) !important;/);
});
test("主题存档带 fontScale，编出 --app-fs，跟着字体那一格进出主题包", () => {
  assert.match(studio, /const fontScale = cleanFontScale\(x\.fontScale\);/);
  assert.match(studio, /:root\{--app-fs:" \+ p\.fontScale \+ ";\}"/);
  assert.match(studio, /fontScale: sel\.fonts \? p\.fontScale : blank\.fontScale/);
  assert.match(ui, /fontScale: sel\.fonts \? inc\.fontScale : cur\.fontScale/);
  assert.match(ui, /"data-wk": "fontscale"/);
});
