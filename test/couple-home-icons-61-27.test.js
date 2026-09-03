// v61.27 她 2026-09-03：「情侣空间和某个人一起的主页，感觉风格不是很统一，
// 有些有 emoji 有些还是一个方框」。
//
// 两件事一起坏了：
//  ① 「最近发生」那一列每行挂一个 emoji（💌📔📅🖼️✦）装在圆角小方块里。彩色 emoji 和
//     单色符号（✦）混在一排本来就不是一套；🖼️ 这类带变体选择符的字还会渲染成豆腐块。
//  ② 「我们的档案」用汉字水印「档」，旁边「愿望板」用符号「✦」——并排两张卡两套语言。
//
// 修法照仓库自己那条：不用 Unicode 方块/爱心字符当临时图标，要么复用现成 SVG，
// 要么根本不放字符。这一页底下「收着的」那一列书脊已经有一套语言了：一条色带认一样东西。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const src = fs.readFileSync("js/screens.js", "utf8");
// 只看情侣空间那一段的【代码】，注释里出现这些字是在说明病情，不算犯规
const seg = (() => {
  const a = src.indexOf("function Us({ characters, couples,");
  const b = src.indexOf("// —— 名册视图（默认，v60.55 重做）——", a);
  return src.slice(a, b).split("\n").map(l => l.split("//")[0]).join("\n");
})();

test("情侣空间主页的代码里没有 emoji，也没有靠字体撑的符号图标", () => {
  const bad = seg.match(/[←-⯿\u{1F000}-\u{1FAFF}️]/gu) || [];
  assert.deepEqual([...new Set(bad)], [], "还留着这些字符当图标：" + [...new Set(bad)].join(" "));
});

test("最近发生那一列改用书脊色带，一个字符都不放", () => {
  assert.match(seg, /const BAND = \{ letters: "#b08d52", exdiary: "#b08a66", timeline:/);
  assert.match(seg, /background: BAND\[x\.sub\] \|\| t\.line/);
  // 老的 icon 字段整条链都不许再有
  assert.ok(seg.indexOf("icon:") < 0, "recentItems 还在挂 icon");
  assert.ok(seg.indexOf("x.icon") < 0, "还在渲染 x.icon");
});

test("能复用现成 SVG 的地方就复用（打卡、起始日）", () => {
  assert.match(seg, /h\(IHeart, \{ size: 13, color: "#c02a52", filled: true \}\), "打卡"/);
  assert.match(seg, /h\(IPencil, \{ size: 11, color: t\.tint \}\), "起始日"/);
});

test("并排那两张卡的水印是同一种东西（都是汉字）", () => {
  const idx = [...seg.matchAll(/fontSize: 82, lineHeight: 1, color: "[^"]+" \} \}, "(.)"\)/g)].map(m => m[1]);
  assert.equal(idx.length, 2, "水印不是两处了，检查一下这条还成不成立");
  idx.forEach(ch => assert.match(ch, /[一-鿿]/, "水印「" + ch + "」不是汉字"));
});
