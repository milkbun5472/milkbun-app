const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
// 群里 2026-11-08 许愿：线下能单独调字体（线上很好看，线下换不了）
test("换字那几排只有一份：聊天窗和线下都用 FontPickRows", () => {
  assert.match(c, /function FontPickRows\(\{ t, font, setFont \}\)/);
  assert.equal((c.match(/h\(FontPickRows, /g) || []).length, 3);   // 聊天窗、单人线下、群见面
  assert.equal((c.match(/F\.facesWith\(cus\)/g) || []).length, 1);
});
test("线下设置存 font，线下那一层照它换字（限在这个人的线下）", () => {
  assert.match(c, /fontSize: sFont, font: \(window\.FontChoice \? window\.FontChoice\.clean\(sFace/);
  assert.match(c, /"data-wk": "offfontface"/);
  assert.match(app, /fontCSS = window\.FontChoice\.cssVars\(os0\.font, _cf, window\.resolveImg, scope\)/);
  assert.match(app, /applyOfflineLook\(\[fontCSS, css\]\.filter\(Boolean\)\.join\("\\n"\)\)/);
});
test("群见面也能换字：存进 g_ 那份，限在这个群开着的那一层", () => {
  assert.match(c, /"这个群线下的字"/);
  assert.match(app, /document\.documentElement\.setAttribute\("data-lisa-offgroup", gid\)/);
  assert.match(app, /\(offlineSettings\["g_" \+ offlineGroup\.id\] \|\| \{\}\)\.font/);
});
