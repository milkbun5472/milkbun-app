// 星测好日子的光圈不套壳（她 2026-10-14：主题 CSS 写的「顶栏 > 头像」被那层壳截断，双人头像排版整块歪掉）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
const astro = fs.readFileSync(path.join(__dirname, "../js/astro.js"), "utf8");
test("顶栏头像不再包 AstroHalo，光圈挂在头像自己身上", () => {
  assert.ok(!/h\(window\.AstroHalo, \{ size: 36 \}/.test(comp));
  assert.match(comp, /halo: !!\(window\.Astro && window\.Astro\.isGoodDay && window\.Astro\.isGoodDay\(character\)\)/);
  assert.match(comp, /"data-wk": "avatar", \.\.\.haloAttr,/);
});
test("光只用 box-shadow 画，不动尺寸位置", () => {
  assert.match(astro, /\[data-halo=\\"1\\"\]\{animation:qqHaloPulse/);
  assert.ok(!/data-halo[^}]*(width|height|position|transform)/.test(astro.slice(astro.indexOf("qq-astro-halo-css"), astro.indexOf("qq-astro-halo-css") + 900)));
});
