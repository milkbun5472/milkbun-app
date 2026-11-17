// 主屏实心图标（她 2026-11-17）：底栏四个画实心版，铺满格子；她换过的图标不走这里
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("底栏四个都在 FILLED_ICONS 里", () => {
  const m = core.match(/const FILLED_ICONS = (\{[\s\S]*?\});\n/);
  assert.ok(m);
  const map = JSON.parse(m[1]);
  for (const k of ["messages", "forum", "diary", "config"]) assert.ok(map[k], k);
});
test("GlassIcon 先看自定义图，再看实心图，最后才是线条", () => {
  const i = comp.indexOf("function GlassIcon");
  const body = comp.slice(i, comp.indexOf("\n}\n", i));
  assert.match(body, /const filled = !customSrc && tone && typeof filledIconSvg === "function"/);
  assert.match(body, /"data-wk": "iconfill"/);
});
test("文件夹盖着时的小格也认实心图", () => {
  assert.match(comp, /const fill = ft && typeof filledIconSvg === "function" \? filledIconSvg\(a\.key, ft\.hue\) : "";/);
});
test("桌面上摆的 app 都有实心图", () => {
  const map = JSON.parse(core.match(/const FILLED_ICONS = (\{[\s\S]*?\});\n/)[1]);
  for (const k of ["cast", "phone", "memlib", "anon", "yanqiu", "nest", "stylelab", "dreamjournal", "fairyGarden", "companion"]) assert.ok(map[k], k);
});
test("秋秋那只画好的鸟不被实心图顶掉", () => {
  const map = JSON.parse(core.match(/const FILLED_ICONS = (\{[\s\S]*?\});\n/)[1]);
  assert.ok(!map.assistant);
  assert.match(comp, /const APP_BUILTIN_ICON = \{ assistant: "img\/qiu-icon\.png" \}/);
});
test("只在主屏用的那批线稿已删，名单里换成 FG(key)", () => {
  for (const g of ["GForum", "GCast", "GTies", "GPhone", "GLore", "GMem", "GWeekly", "GFanfic", "GDream", "GTarot", "GFocus", "GGame", "GRescue", "GLounge"]) {
    assert.ok(!new RegExp("\\b" + g + "\\b").test(core), g + " 还在 core.js");
    assert.ok(!new RegExp("\\b" + g + "\\b").test(comp), g + " 还在 components.js");
  }
  assert.match(core, /function FG\(key\)/);
  assert.match(comp, /cast: \{ kind: "app", zh: "人格档案馆", G: FG\("cast"\)/);
});
