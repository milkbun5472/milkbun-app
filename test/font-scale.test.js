// 她 2026-10-20：「为什么不能单独改字体」→ 字体里加「字号」，只放大字。先接线上单聊。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const core = rd("js/core.js"), comp = rd("js/components.js"), studio = rd("js/theme-studio.js"), ui = rd("js/theme-studio-ui.js");
test("fsz 写成跟着 --app-fs 的 calc", () => {
  const f = new Function(core.match(/function fsz\(px\) \{[^}]*\}/)[0] + ";return fsz;")();
  assert.equal(f(14.5), "calc(14.5px * var(--app-fs, 1))");
});
test("线上单聊里写死的字号都接上 fsz", () => {
  const a = comp.indexOf("function ChatThread("), b = comp.indexOf("function CallSubtitle(");
  const seg = comp.slice(a, b);
  assert.equal((seg.match(/fontSize: \d+(?:\.\d+)?[,\s}]/g) || []).length, 0, "还有没接上的字号");
  assert.ok((seg.match(/fontSize: fsz\(/g) || []).length > 100);
});
test("主题存档带 fontScale，编出 --app-fs，跟着字体那一格进出主题包", () => {
  assert.match(studio, /const fontScale = cleanFontScale\(x\.fontScale\);/);
  assert.match(studio, /:root\{--app-fs:" \+ p\.fontScale \+ ";\}"/);
  assert.match(studio, /fontScale: sel\.fonts \? p\.fontScale : blank\.fontScale/);
  assert.match(ui, /fontScale: sel\.fonts \? inc\.fontScale : cur\.fontScale/);
  assert.match(ui, /"data-wk": "fontscale"/);
});
