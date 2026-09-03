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

test("选中那本是抽出来翻开的：更高、纸色、压到搁板前面", () => {
  assert.match(seg, /height:\s*on\s*\?\s*SPINE_H\s*:\s*OFF_H \+ sp\.lift/, "选中的不比别的高");
  assert.match(seg, /background:\s*on\s*\?\s*t\.bg\s*:/, "选中的不是纸色");
  assert.match(seg, /borderBottom:\s*on\s*\?\s*"none"/, "选中那本底边没敞开");
  assert.match(seg, /marginBottom:\s*on\s*\?\s*-7/, "选中那本没压到搁板前面来");
});

// v61.12：光把药丸换成竖排的字还不够（她：「现在还是很简约风，没有书架的感觉」）
test("真的画成一架子书：布面有色、上下两道烫金压线、高矮不齐、底下一块搁板", () => {
  assert.match(seg, /const sp = ficSpineTone\(tab\.name, t\);/, "书脊没有自己的布色");
  assert.match(seg, /background:\s*on\s*\?\s*t\.bg\s*:\s*rgbStr\(sp\.cloth\)/, "没选中的还是没布色");
  assert.match(seg, /rule\(\{ top: 5 \}/, "书脊上那两道烫金压线没了");
  assert.match(seg, /rule\(\{ bottom: on \? 7 : 5 \}/);
  assert.match(seg, /OFF_H \+ sp\.lift/, "一架子书切得齐平了——真书架不是这样");
  assert.match(seg, /const plank|height: 7, borderRadius: 2/, "搁板不见了");
  assert.match(seg, /boxShadow: "inset 0 2px 3px rgba\(0,0,0,\.22\), 0 2px 5px "/, "搁板没有书压出来的影和板底的厚边");
});

test("布色和字色都从主题算，同一版永远同一色", () => {
  const tone = src.slice(src.indexOf("  function ficSpineTone(name, t) {"), src.indexOf("  function TabBar(props) {"));
  assert.match(tone, /ficHash\("spine:"/, "布色不是从版名算的，换个顺序颜色就跳");
  assert.match(tone, /skinRGB\(\(seed >> 4\) % 3 === 0 \? t\.ink : t\.accent\)/, "布色没从主题派生");
  assert.match(tone, /ink: rgbStr\(shadeRGB\(cloth, dark \? 0\.84 : -0\.7\)\)/, "字色不是从布色本身推的（深布浅字/浅布深字）");
  assert.ok(!/#fff|#000/i.test(tone), "写死了黑白");
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
