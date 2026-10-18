// 星测好日子的光圈不套壳（她 2026-10-14：主题 CSS 写的「顶栏 > 头像」被那层壳截断，双人头像排版整块歪掉）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
const astro = (fs.readFileSync(path.join(__dirname, "../js/astro-core.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "../js/astro.js"), "utf8"));
test("顶栏头像不再包 AstroHalo，光圈挂在头像自己身上", () => {
  assert.ok(!/h\(window\.AstroHalo, \{ size: 36 \}/.test(comp));
  assert.match(comp, /halo: !!\(window\.Astro && window\.Astro\.isGoodDay && window\.Astro\.isGoodDay\(character\)\)/);
  assert.match(comp, /"data-wk": "avatar", \.\.\.haloAttr,/);
});
test("原来那圈（虚线金圈＋三颗星、慢慢转）画在头像自己的伪元素上；有图时外面是同名 data-wk 的一格", () => {
  assert.match(astro, /\[data-halo=\\"1\\"\]::before\{content:/);
  assert.match(astro, /animation:qqHaloSpin 14s linear infinite/);
  assert.match(comp, /if \(src && halo\) return h\("span", \{ "data-wk": "avatar", "data-halo": "1"/);
});
