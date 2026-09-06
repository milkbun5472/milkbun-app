// 同人文 feed 里的一篇不再是一张框（她 2026-09-03：「每一篇文显示的样式也改改吧，
// 现在还是一个个框」）。上面那排书脊已经把一版做成「抽出来翻开的一本」，
// 翻开一本书底下就该是这一本的【目录页】：编号 → 篇名 → 引导点 → 字数（页码那一格）。
// 判据同 施工规则/tabs-not-plain-pills.md：换个 app 还成立的形状＝没设计。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");

const seg = (() => {
  const a = src.indexOf("  function FicCard(props) {");
  const b = src.indexOf("\n  // ---------- 世界观分版", a);
  assert.ok(a > 0 && b > a, "找不到 FicCard");
  return src.slice(a, b);
})();

test("不是框：边是纸叠出来的，不是描上去的", () => {
  assert.ok(!/border:\s*"1px solid/.test(seg), "条目上又描了一圈边（她点名去掉的就是框）");
  assert.ok(!/borderRadius:\s*(?!2\b)\d/.test(seg.replace(/borderRadius: 1\b/g, "")), "圆角超过 2px 就又是卡片了");
  assert.ok(!/pageSkin\(/.test(seg), "条目又自己上了一层纸皮（那是页面的事）");
});

// v61.19 她：「文章本身现在还是一块平的」——一篇同人文现实里是一本订起来的薄册子
test("一篇＝一本薄册子：装订边、两枚订书钉、底下压着几层纸、自己的影", () => {
  assert.match(seg, /const binding = h\("div"/, "没有装订边");
  assert.match(seg, /const staple = function \(top\)/, "没有订书钉");
  assert.match(seg, /staple\("2\d%"\), staple\("6\d%"\)/, "订书钉没订上去");
  assert.match(seg, /const stack = /, "册子下面没有压着的纸");
  assert.match(seg, /2px 3px 0 -1px " \+ under \+ ", 4px 6px 0 -2px " \+ under/, "底下那两层纸没错开，看着还是平的");
  assert.match(seg, /0 7px 10px -7px " \+ hexA\(t\.ink, \.35\)/, "册子没有自己的影");
  assert.match(seg, /boxShadow: stack/, "两支（卷首/普通）里有一支没用上这一叠");
  assert.match(seg, /const paper = skinShade\(t\.bg2, skinIsDark\(t\.bg\) \? 0\.06 : 0\.5\)/, "册子的纸色不是从主题算的");
});

test("是目录：引导点一路点到右边那格字数", () => {
  assert.match(seg, /borderBottom:\s*"1px dotted "\s*\+\s*t\.line/, "没有目录的引导点");
  assert.match(seg, /const pageNo = /, "右边没有页码那一格");
  assert.match(seg, /fmtNum\(words\) \+ " 字"/, "页码那一格不是字数");
  // v61.19 起条目各是一本册子，之间靠间距和影分开，不再需要那道发丝线
});

test("有我＝册子上口垂下来的一根红书签带", () => {
  assert.match(seg, /const ribbon = hasMe \?/, "书签带没了");
  assert.match(seg, /background: t\.accent/);
  assert.match(seg, /clipPath: "polygon\(0 0,100% 0,100% 100%,50% 74%,0 100%\)"/, "带子末端没有开叉，就是一根方条");
  assert.ok(/ribbon/.test(seg.split("if (isLead)")[1] || ""), "卷首那一支没接书签带");
});

test("卷首靠字号和双线压屏，不是靠一块深底", () => {
  const lead = seg.slice(seg.indexOf("if (isLead)"));
  assert.match(lead, /fontSize: 24/, "卷首标题没有比别的大一截");
  assert.ok(!/background: t\.ink|background: c\.bg/.test(lead), "卷首又铺了一块深底");
  assert.match(lead, /props\.leadLabel \|\| "圈子里最上面那一篇"/);
});

test("序号还是【此刻排第几】算出来的，不存到文章上", () => {
  assert.match(seg, /const no = String\(idx \+ 1\)\.padStart\(2, "0"\);/);
  assert.doesNotMatch(src, /f\.(dark|isDark|cardTone|seq|no)\s*=/);
});

test("不写死黑白", () => {
  assert.ok(!/#(fff|ffffff|000|000000)\b/i.test(seg), "写死了黑白，换主题就废");
});

// v61.20 她：「都做吧宝宝，然后点进去做个翻页特效」
test("书口：右边那条切齐的纸白，卷首那本更厚", () => {
  assert.match(seg, /const foreEdge = h\("div"/, "没有书口");
  assert.match(seg, /repeating-linear-gradient\(90deg,/, "书口是一条渐变色带，不是一摞纸的切口");
  assert.match(seg, /width: isLead \? 7 : 5/, "卷首的书口没有更厚");
  assert.match(seg, /isLead \? ", 6px 9px 0 -3px "/, "卷首没有多压一层纸");
  assert.ok((seg.match(/foreEdge, ribbon/g) || []).length === 2, "两支里有一支没接书口");
});

test("点进去是把封面掀开：绕左边那条边转进来，且尊重「减少动态效果」", () => {
  const m = src.slice(src.indexOf("  function FicMotionStyles() {"), src.indexOf("  // ---------- 世界观分版"));
  assert.ok(m, "没有翻页动画");
  assert.match(m, /@keyframes ficOpenBook\{0%\{opacity:\.35;transform:perspective\(1400px\) rotateY\(-72deg\)\}/);
  assert.match(m, /transform-origin:left center/, "不是绕书脊那条边转——那就成了普通的翻卡片");
  assert.match(m, /@media\(prefers-reduced-motion:reduce\)/, "没给关掉动效的人留退路");
  // 挂在阅读页外面，且换一篇要重放
  assert.match(src, /h\("div", \{ key: f\.id, className: "fic-open-book relative" \}, h\(Reader, \{/);
});
