// 图标颜色一键换（她 2026-11-17）：主题工作台存 iconTint，编进 :root 的两个变量
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const st = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio-ui.js"), "utf8");
test("iconTint 进 normalize、compile、导出", () => {
  assert.match(st, /iconTint: cleanTint\(x\.iconTint\)/);
  assert.match(st, /p\.iconTint\.raw \? "--iconfill-hue:initial;--iconfill-sat:initial;" : "--iconfill-hue:" \+ p\.iconTint\.h/);
  assert.match(st, /--iconfill-lm:initial;--iconfill-ld:initial;--iconfill-ll:initial;--iconfill-dot:initial;/);
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

// 出厂冰白（她 2026-11-17）：默认值挂在零权重的 :root 上，「原色」是 { raw: true }
test("出厂冰白、原色可退回", () => {
  const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
  assert.match(core, /const ICONFILL_DEFAULT_CSS = ":where\(:root\)\{--iconfill-hue:214;/);
  assert.match(st, /const ICON_TINTS = \[\["冰白", null\], \["原色", \{ raw: true \}\]/);
  assert.match(st, /if \(t\.raw\) return \{ raw: true \};/);
  global.window = undefined;
  const i = core.indexOf("function filledIconSvg"), fn = core.slice(i, core.indexOf("\n}\n", i) + 2);
  const FILLED_ICONS = { x: "<path fill='{m}' d='M0'/><path fill='#fff' d='M1'/><ellipse fill='#fff' opacity='.5' cx='1'/>" };
  const svg = new Function("FILLED_ICONS", fn + "; return filledIconSvg('x', 30);")(FILLED_ICONS);
  assert.match(svg, /var\(--iconfill-lm,64%\)/);
  assert.match(svg, /d='M1' style='fill:var\(--iconfill-dot,#fff\)'/);
  assert.match(svg, /<ellipse fill='#fff' opacity='\.5' cx='1'\/>/);
});
