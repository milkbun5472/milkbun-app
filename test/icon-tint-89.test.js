// 图标颜色一键换（她 2026-11-17）：主题工作台存 iconTint，编进 :root 的两个变量
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const st = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio-ui.js"), "utf8");
test("iconTint 进 normalize、compile、导出", () => {
  assert.match(st, /iconTint: cleanTint\(x\.iconTint\)/);
  assert.match(st, /:root\{--iconfill-hue:" \+ p\.iconTint\.h \+ ";--iconfill-sat:" \+ p\.iconTint\.s \+ "%;\}/);
  assert.match(st, /iconTint: sel\.icons \? p\.iconTint : blank\.iconTint/);
});
test("换图标那页有一排预设和一颗自己挑", () => {
  assert.match(ui, /"data-wk": "icontint"/);
  assert.match(ui, /studio\.ICON_TINTS\.map/);
  assert.match(ui, /type: "color", onChange: e => \{ const tt = studio\.tintFromHex/);
});
test("格子的淡彩底也认那两个变量", () => {
  const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
  const i = core.indexOf("function appTone");
  const body = core.slice(i, core.indexOf("\n}\n", i));
  assert.match(body, /wash: "radial-gradient\(125% 118% at 18% 104%, hsla\(var\(--iconfill-hue,/);
});
