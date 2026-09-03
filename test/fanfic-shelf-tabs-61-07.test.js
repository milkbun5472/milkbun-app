// 同人文的分版不许是一排药丸（.claude/rules/tabs-not-plain-pills.md）。
// 判据：这一组 tab 原样搬到别的 app 里还成立吗？成立就是写坏了。
// 这一版把它长成【书架上那一排书脊】：没选的立在架上，选中的那本被抽出来翻开，
// 底下那条搁板线在它这儿断开，直接长进这一版的 feed。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");

const seg = (() => {
  const a = src.indexOf("  function TabBar(props) {");
  const b = src.indexOf("\n  // ---------- 生成配置弹窗", a);
  assert.ok(a > 0 && b > a, "找不到 TabBar");
  return src.slice(a, b);
})();

test("不是药丸：没有 borderRadius 999 的胶囊", () => {
  assert.ok(!/borderRadius:\s*999/.test(seg), "分版又变回一排圆角药丸了");
});

test("是书脊：竖排书名 + 只有上面两个角是圆的", () => {
  assert.match(seg, /writingMode:\s*"vertical-rl"/);
  assert.match(seg, /borderRadius:\s*"4px 4px 0 0"/);
});

test("选中那本是抽出来翻开的：更高、纸色、底边敞开接进正文", () => {
  assert.match(seg, /height:\s*on\s*\?\s*SPINE_H\s*:\s*OFF_H/, "选中的不比别的高");
  assert.match(seg, /background:\s*on\s*\?\s*t\.bg\s*:/, "选中的不是纸色");
  assert.match(seg, /borderBottom:\s*on\s*\?\s*"none"/, "选中那本底边没敞开");
  assert.match(seg, /borderBottom:\s*"1px solid "\s*\+\s*t\.line/, "搁板线不见了");
});

test("选中态不只靠一个色差：高度、宽度、字重都跟着变", () => {
  assert.match(seg, /width:\s*on\s*\?/);
  assert.match(seg, /fontWeight:\s*on\s*\?/);
});

test("点得着：最矮的那一格也不低于 40px", () => {
  const m = seg.match(/SPINE_H\s*=\s*(\d+),\s*OFF_H\s*=\s*(\d+)/);
  assert.ok(m, "读不到两个高度");
  assert.ok(Number(m[1]) >= 40 && Number(m[2]) >= 40, "可点区域低于 40px");
});

test("深色主题下不许写死白色", () => {
  assert.ok(!/#fff|#ffffff/i.test(seg), "写死了白色，深色主题里会白底白字");
});
