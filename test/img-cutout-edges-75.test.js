// 秋秋小球：圆角方图不能当抠图原样画成一块方（群里 2026-10-18）
const test = require("node:test"), assert = require("node:assert");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
test("抠图判定除了四角还看四边中点", () => {
  const fn = src.slice(src.indexOf("function useImgCutout"), src.indexOf("function useImgCutout") + 1800);
  assert.match(fn, /const mids = \[a\(W >> 1, 0\), a\(0, H >> 1\), a\(W - 1, H >> 1\), a\(W >> 1, H - 1\)\]/);
  assert.match(fn, /const v = corners && mids >= 2;/);
});
